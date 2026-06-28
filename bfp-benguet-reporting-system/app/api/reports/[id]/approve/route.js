import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { ROLES, REPORT_STATUS, NOTIFICATION_TYPES } from '@/lib/constants';

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

    if (action === 'reject') {
      newStatus = REPORT_STATUS.RETURNED;

      if (user.role === ROLES.PROVINCIAL_CHIEF_IIS) {
        // Provincial Chief IIS returns to the Municipal Chief IIS of that municipality
        const munChiefIIS = await prisma.user.findFirst({
          where: {
            role: ROLES.MUNICIPAL_CHIEF_IIS,
            municipalityId: report.municipalityId,
            isActive: true,
          },
        });
        nextPassedToRole = munChiefIIS ? ROLES.MUNICIPAL_CHIEF_IIS : report.submittedBy.role;
        nextPassedToId = munChiefIIS?.id || report.submittedById;
      } else if (user.role === ROLES.MUNICIPAL_FIRE_MARSHAL && report.reviewedById && report.reviewedById !== user.id) {
        nextPassedToRole = report.reviewedBy?.role || ROLES.MUNICIPAL_CHIEF_IIS;
        nextPassedToId = report.reviewedById;
      } else {
        nextPassedToRole = report.submittedBy.role;
        nextPassedToId = report.submittedById;
      }
    } else {
      if ([ROLES.MUNICIPAL_CHIEF_IIS, ROLES.MUNICIPAL_CHIEF_OPERATION].includes(user.role)) {
        const municipalMarshal = await prisma.user.findFirst({
          where: {
            role: ROLES.MUNICIPAL_FIRE_MARSHAL,
            municipalityId: report.municipalityId,
            isActive: true,
          },
        });

        if (!municipalMarshal) {
          return NextResponse.json(
            { error: 'No Municipal Fire Marshal account found for this municipality' },
            { status: 400 }
          );
        }

        nextPassedToRole = ROLES.MUNICIPAL_FIRE_MARSHAL;
        nextPassedToId = municipalMarshal.id;
      } else if (user.role === ROLES.MUNICIPAL_FIRE_MARSHAL) {
        let provincialChief = await prisma.user.findFirst({
          where: {
            role: ROLES.PROVINCIAL_CHIEF_IIS,
            isActive: true,
          },
        });

        if (!provincialChief) {
          provincialChief = await prisma.user.findFirst({
            where: {
              role: ROLES.MARSHAL,
              isActive: true,
            },
          });
        }

        if (!provincialChief) {
          return NextResponse.json(
            { error: 'No Provincial Chief IIS account found' },
            { status: 400 }
          );
        }

        nextPassedToRole = provincialChief.role;
        nextPassedToId = provincialChief.id;
      } else {
        // Provincial role is final approver
        newStatus = REPORT_STATUS.APPROVED;
      }
    }

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

    // Notify next reviewer when forwarded
    if (action === 'approve' && nextPassedToId) {
      await prisma.notification.create({
        data: {
          userId: nextPassedToId,
          message: `A ${updatedReport.reportType} report from ${updatedReport.municipality.name} is awaiting your review.`,
          type: NOTIFICATION_TYPES.REPORT_SUBMITTED,
          reportId: report.id,
        },
      });
    }

    // Notify original submitter for final approval or return
    if (newStatus === REPORT_STATUS.APPROVED || newStatus === REPORT_STATUS.RETURNED) {
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
          ? 'Report returned for revision'
          : newStatus === REPORT_STATUS.APPROVED
            ? 'Report approved successfully'
            : 'Report reviewed and forwarded successfully',
    });
  } catch (error) {
    console.error('Error approving/rejecting report:', error);
    return NextResponse.json(
      { error: 'Failed to process report' },
      { status: 500 }
    );
  }
}
