import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { NOTIFICATION_TYPES, ROLES, REPORT_STATUS } from '@/lib/constants';
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

export async function GET(request, { params }) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (isDemoReportId(params.id)) {
      const demoReport = getDemoReportById(user, params.id);

      if (!demoReport) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      return NextResponse.json({ report: demoReport });
    }

    const report = await prisma.report.findUnique({
      where: { id: parseInt(params.id) },
      include: {
        municipality: true,
        submittedBy: true,
        reviewedBy: true,
        incident: true,
      },
    });

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    // RBAC: Investigators can only view their own reports
    if (user.role === ROLES.INVESTIGATOR && report.submittedById !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Reviewers and other users may only view a report if they are the explicit recipient
    // or the original submitter. Super admins may view all.
    const isSubmitter = report.submittedById === user.id;
    const isRecipient = isReportRecipient(report, user);
    const isSuperAdmin = user.role === ROLES.SUPER_ADMIN;
    const hasTextBlastAccess = await prisma.notification.findFirst({
      where: {
        userId: user.id,
        reportId: report.id,
        type: NOTIFICATION_TYPES.REPORT_TEXT_BLAST,
      },
      select: {
        id: true,
      },
    });

    if (!isSubmitter && !isRecipient && !isSuperAdmin && !hasTextBlastAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ report });
  } catch (error) {
    console.error('Error fetching report:', error);
    return NextResponse.json(
      { error: 'Failed to fetch report' },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const report = await prisma.report.findUnique({
      where: { id: parseInt(params.id) },
    });

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    // Only submitter can edit DRAFT reports
    if (report.status === REPORT_STATUS.DRAFT && report.submittedById !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { content, category, respondingUnits, respondingOfficer, reportingOfficerRank, stationCommanderName, status, passedToRole: requestedPassedToRole, passedToId: requestedPassedToId } = body;

    // Allow submitter to re-submit a returned report and optionally forward to a specific municipal role
    let updateData = {
      ...(content && { content }),
      ...(category && { category }),
      ...(respondingUnits && { respondingUnits }),
      ...(respondingOfficer && { respondingOfficer }),
      ...(reportingOfficerRank && { reportingOfficerRank }),
      ...(stationCommanderName && { stationCommanderName }),
      ...(status && { status }),
    };

    // Investigator re-submitting a RETURNED report → auto-route back to whoever returned it
    if (
      user.role === ROLES.INVESTIGATOR &&
      report.status === REPORT_STATUS.RETURNED &&
      status === REPORT_STATUS.SUBMITTED
    ) {
      if (report.reviewedById) {
        const lastReviewer = await prisma.user.findUnique({
          where: { id: report.reviewedById },
          select: { id: true, role: true, isActive: true },
        });
        if (lastReviewer && lastReviewer.isActive) {
          updateData.passedToRole = lastReviewer.role;
          updateData.passedToId = lastReviewer.id;
        }
      }
    }

    // Investigator forwarding an approved (but not yet finally approved) report → determine next level from last reviewer
    if (
      user.role === ROLES.INVESTIGATOR &&
      report.status === REPORT_STATUS.APPROVED &&
      status === REPORT_STATUS.SUBMITTED
    ) {
      if (!report.reviewedById) {
        return NextResponse.json(
          { error: 'Cannot determine next step: report has no reviewer on record' },
          { status: 400 }
        );
      }

      const lastReviewer = await prisma.user.findUnique({
        where: { id: report.reviewedById },
        select: { role: true },
      });

      // Investigator may explicitly choose the next recipient; otherwise fall back
      // to the automatic escalation path based on who last reviewed the report.
      const allowedNextRoles = [ROLES.MUNICIPAL_FIRE_MARSHAL, ROLES.PROVINCIAL_CHIEF_IIS];
      let targetRole = allowedNextRoles.includes(requestedPassedToRole) ? requestedPassedToRole : null;

      if (!targetRole) {
        if (lastReviewer?.role === ROLES.MUNICIPAL_CHIEF_IIS || lastReviewer?.role === ROLES.MUNICIPAL_CHIEF_OPERATION) {
          targetRole = ROLES.MUNICIPAL_FIRE_MARSHAL;
        } else if (lastReviewer?.role === ROLES.MUNICIPAL_FIRE_MARSHAL) {
          targetRole = ROLES.PROVINCIAL_CHIEF_IIS;
        } else {
          return NextResponse.json(
            { error: 'Invalid report state: cannot determine next forwarding step' },
            { status: 400 }
          );
        }
      }

      if (targetRole === ROLES.MUNICIPAL_FIRE_MARSHAL) {
        const marshal = await prisma.user.findFirst({
          where: {
            role: ROLES.MUNICIPAL_FIRE_MARSHAL,
            municipalityId: report.municipalityId,
            isActive: true,
          },
        });
        if (!marshal) {
          return NextResponse.json(
            { error: 'No Municipal Fire Marshal account found for this municipality' },
            { status: 400 }
          );
        }
        updateData.passedToRole = ROLES.MUNICIPAL_FIRE_MARSHAL;
        updateData.passedToId = marshal.id;
      } else {
        const provChief = await prisma.user.findFirst({
          where: { role: ROLES.PROVINCIAL_CHIEF_IIS, isActive: true },
        });
        if (!provChief) {
          return NextResponse.json(
            { error: 'No Provincial Chief IIS account found' },
            { status: 400 }
          );
        }
        updateData.passedToRole = ROLES.PROVINCIAL_CHIEF_IIS;
        updateData.passedToId = provChief.id;
      }
    }

    const updatedReport = await prisma.report.update({
      where: { id: parseInt(params.id) },
      data: updateData,
      include: {
        municipality: true,
        submittedBy: true,
        incident: true,
      },
    });

    // Notify next reviewer when report is forwarded after resubmission
    try {
      if (status === REPORT_STATUS.SUBMITTED && updatedReport.passedToId) {
        await prisma.notification.create({
          data: {
            userId: updatedReport.passedToId,
            message: `A ${updatedReport.reportType} report from ${updatedReport.municipality?.name} is awaiting your review.`,
            type: 'REPORT_SUBMITTED',
            reportId: updatedReport.id,
          },
        });
      }
    } catch (e) {
      console.warn('Failed to create forward notification:', e);
    }

    return NextResponse.json({
      report: updatedReport,
      message: 'Report updated successfully',
    });
  } catch (error) {
    console.error('Error updating report:', error);
    return NextResponse.json(
      { error: 'Failed to update report' },
      { status: 500 }
    );
  }
}
