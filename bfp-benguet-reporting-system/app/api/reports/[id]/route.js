import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { ROLES, REPORT_STATUS } from '@/lib/constants';

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

    if (!isSubmitter && !isRecipient && !isSuperAdmin) {
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
    const { content, respondingUnits, respondingOfficer, reportingOfficerRank, stationCommanderName, status, passedToRole: requestedPassedToRole, passedToId: requestedPassedToId } = body;

    // Allow submitter to re-submit a returned report and optionally forward to a specific municipal role
    let updateData = {
      ...(content && { content }),
      ...(respondingUnits && { respondingUnits }),
      ...(respondingOfficer && { respondingOfficer }),
      ...(reportingOfficerRank && { reportingOfficerRank }),
      ...(stationCommanderName && { stationCommanderName }),
      ...(status && { status }),
    };

    // If investigator is re-submitting a previously returned report and requests forwarding
    if (
      user.role === ROLES.INVESTIGATOR &&
      report.status === REPORT_STATUS.RETURNED &&
      status === REPORT_STATUS.SUBMITTED &&
      requestedPassedToRole
    ) {
      // Only allow forwarding to MUNICIPAL_CHIEF_OPERATION for now
      if (requestedPassedToRole === ROLES.MUNICIPAL_CHIEF_OPERATION) {
        const munChiefOp = await prisma.user.findFirst({
          where: {
            role: ROLES.MUNICIPAL_CHIEF_OPERATION,
            municipalityId: report.municipalityId,
            isActive: true,
          },
        });

        if (!munChiefOp) {
          return NextResponse.json(
            { error: 'No Municipal Chief Operation account found for this municipality' },
            { status: 400 }
          );
        }

        updateData.passedToRole = ROLES.MUNICIPAL_CHIEF_OPERATION;
        updateData.passedToId = munChiefOp.id;
      }
    }

    // If a specific passedToId was provided (and user is allowed to set it), include it
    if (requestedPassedToId && Number.isInteger(requestedPassedToId)) {
      updateData.passedToId = requestedPassedToId;
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
            message: `A ${updatedReport.reportType} report from ${updatedReport.municipality.name} is awaiting your review.`,
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
