import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { ROLES, REPORT_STATUS, NOTIFICATION_TYPES } from '@/lib/constants';
import { getDemoReportById, isDemoReportId } from '@/lib/demo-reports';

const MUNICIPAL_REVIEWER_ROLES = [
  ROLES.MUNICIPAL_CHIEF_IIS,
  ROLES.MUNICIPAL_CHIEF_OPERATION,
  ROLES.MUNICIPAL_FIRE_MARSHAL,
];

const PROVINCIAL_REVIEWER_ROLES = [
  ROLES.PROVINCIAL_CHIEF_IIS,
  ROLES.MARSHAL,
  ROLES.CHIEF_INVESTIGATOR_IIS,
];

const isReportRecipient = (report, user) => {
  if (report.passedToId === user.id) return true;
  if (report.passedToRole !== user.role) return false;
  if (PROVINCIAL_REVIEWER_ROLES.includes(user.role)) return true;
  if (MUNICIPAL_REVIEWER_ROLES.includes(user.role)) {
    return report.municipalityId === user.municipalityId;
  }
  return false;
};

export async function POST(request, { params }) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const allowedReviewers = [
      ROLES.MUNICIPAL_CHIEF_IIS,
      ROLES.MUNICIPAL_CHIEF_OPERATION,
      ROLES.MUNICIPAL_FIRE_MARSHAL,
      ROLES.PROVINCIAL_CHIEF_IIS,
      ROLES.MARSHAL, // legacy compatibility
      ROLES.CHIEF_INVESTIGATOR_IIS, // compatibility
    ];

    if (!allowedReviewers.includes(user.role)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    if (isDemoReportId(params.id)) {
      const demoReport = getDemoReportById(user, params.id);

      if (!demoReport) {
        return NextResponse.json(
          { error: 'This demo report is not assigned to your account or role' },
          { status: 403 }
        );
      }

      const body = await request.json();
      const { action, remarks } = body;

      if (!['approve', 'reject'].includes(action)) {
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
      }

      const updatedDemoReport = {
        ...demoReport,
        status: action === 'reject' ? REPORT_STATUS.RETURNED : REPORT_STATUS.APPROVED,
        remarks: remarks || demoReport.remarks,
        reviewedAt: new Date().toISOString(),
        reviewedById: user.id,
        reviewedBy: {
          id: user.id,
          name: user.email,
          role: user.role,
        },
      };

      return NextResponse.json({
        report: updatedDemoReport,
        message:
          action === 'reject'
            ? 'Demo report returned for revision'
            : 'Demo report approved successfully',
      });
    }

    const report = await prisma.report.findUnique({
      where: { id: parseInt(params.id) },
      include: {
        submittedBy: true,
        reviewedBy: true,
        municipality: true,
      },
    });

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { action, remarks } = body; // action: 'approve', 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

    if (!isReportRecipient(report, user)) {
      return NextResponse.json(
        { error: 'This report is not currently assigned to your account or role' },
        { status: 403 }
      );
    }

    let newStatus = REPORT_STATUS.SUBMITTED;
    let nextPassedToRole = null;
    let nextPassedToId = null;
    let isFinalApproval = false;

    if (action === 'reject') {
      // All reviewers return the report directly to the original investigator with corrections
      newStatus = REPORT_STATUS.RETURNED;
      nextPassedToRole = report.submittedBy.role;
      nextPassedToId = report.submittedById;
    } else {
      // approve
      newStatus = REPORT_STATUS.APPROVED;
      if ([ROLES.MUNICIPAL_CHIEF_IIS, ROLES.MUNICIPAL_CHIEF_OPERATION, ROLES.MUNICIPAL_FIRE_MARSHAL].includes(user.role)) {
        // Municipal reviewers cannot forward — they approve the report and return it to the
        // investigator. The investigator then decides to submit to the next level.
        nextPassedToRole = report.submittedBy.role;
        nextPassedToId = report.submittedById;
      } else {
        // Provincial Chief IIS / Marshal — final approver, nothing left to forward
        isFinalApproval = true;
      }
    }

    // Who the investigator should forward this approval to next
    const nextStepLabel = user.role === ROLES.MUNICIPAL_FIRE_MARSHAL
      ? 'Provincial Chief IIS'
      : 'Municipal Fire Marshal';
    const reviewerLabel = user.role === ROLES.MUNICIPAL_FIRE_MARSHAL
      ? 'Municipal Fire Marshal'
      : 'Municipal Chief IIS';

    const updatedReport = await prisma.report.update({
      where: { id: parseInt(params.id) },
      data: {
        status: newStatus,
        reviewedAt: new Date(),
        reviewedById: user.id,
        remarks: remarks || null,
        passedToRole: nextPassedToRole,
        passedToId: nextPassedToId,
      },
      include: {
        submittedBy: true,
        municipality: true,
      },
    });

    // Notify next reviewer when forwarded (only Provincial Chief IIS case now)
    if (action === 'approve' && nextPassedToId && newStatus === REPORT_STATUS.SUBMITTED) {
      await prisma.notification.create({
        data: {
          userId: nextPassedToId,
          message: `A ${updatedReport.reportType} report from ${updatedReport.municipality.name} is awaiting your review.`,
          type: NOTIFICATION_TYPES.REPORT_SUBMITTED,
          reportId: report.id,
        },
      });
    }

    // Notify original submitter: approved-pending-forward, finally approved, or returned
    if (newStatus === REPORT_STATUS.APPROVED && !isFinalApproval) {
      await prisma.notification.create({
        data: {
          userId: report.submittedById,
          message: `Your ${updatedReport.reportType} report has been approved by ${reviewerLabel}. Please submit it to the ${nextStepLabel}.`,
          type: NOTIFICATION_TYPES.REPORT_APPROVED,
          reportId: report.id,
        },
      });
    } else if (newStatus === REPORT_STATUS.APPROVED || newStatus === REPORT_STATUS.RETURNED) {
      await prisma.notification.create({
        data: {
          userId: report.submittedById,
          message:
            newStatus === REPORT_STATUS.APPROVED
              ? `Your report from ${updatedReport.municipality.name} has been approved by Provincial Chief IIS.`
              : `Your report from ${updatedReport.municipality.name} was returned for revision${remarks ? `: ${remarks}` : '.'}`,
          type:
            newStatus === REPORT_STATUS.APPROVED
              ? NOTIFICATION_TYPES.REPORT_APPROVED
              : NOTIFICATION_TYPES.REPORT_RETURNED,
          reportId: report.id,
        },
      });
    }

    return NextResponse.json({
      report: updatedReport,
      message:
        action === 'reject'
          ? 'Report returned to investigator for revision'
          : isFinalApproval
            ? 'Report approved successfully'
            : `Report approved — returned to investigator to forward to the ${nextStepLabel}`,
    });
  } catch (error) {
    console.error('Error approving/rejecting report:', error);
    return NextResponse.json(
      { error: 'Failed to process report' },
      { status: 500 }
    );
  }
}
