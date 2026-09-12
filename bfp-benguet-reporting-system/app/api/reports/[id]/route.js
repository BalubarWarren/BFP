import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getUserFromRequest } from '../../../../lib/auth';
import { NOTIFICATION_TYPES, ROLES, REPORT_STATUS } from '../../../../lib/constants';
import { getDemoReportById, isDemoReportId } from '../../../../lib/demo-reports';
import { MUNICIPAL_REVIEWER_ROLES, PROVINCIAL_REVIEWER_ROLES, isReportRecipient, tierIndexForRole, nextTierRoles, REVIEW_TIERS } from '../../../../lib/report-access';
import { deleteAttachments } from '../../../../lib/storage';
import { parseJsonField } from '../../../../lib/utils';

const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN];

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

    // This endpoint only supports the submitter editing/resubmitting/forwarding their own
    // report (reviewers act through /approve instead) — reject anyone else outright.
    if (report.submittedById !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Once a report has received final approval (Provincial Chief IIS, nothing left to forward)
    // it's the official record — DELETE already refuses to remove one at this point, but PATCH
    // had no equivalent lock, so the submitter could still silently edit its content afterward.
    if (report.status === REPORT_STATUS.APPROVED && !report.passedToId) {
      return NextResponse.json(
        { error: 'This report has received final approval and can no longer be edited.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { content, category, respondingUnits, respondingOfficer, reportingOfficerRank, stationCommanderName, status, passedToRole: requestedPassedToRole } = body;

    // The only status transition this endpoint may perform is re-submitting; approvals/returns
    // must go through /approve so reviewedById/reviewedAt/remarks stay accurate.
    if (status && status !== REPORT_STATUS.SUBMITTED) {
      return NextResponse.json(
        { error: 'Invalid status transition' },
        { status: 400 }
      );
    }

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

    // Investigator re-submitting a RETURNED report → they may pick a lateral alternative within
    // the SAME tier that returned it (e.g. Municipal Chief Operation instead of Chief IIS), but
    // never a later tier — that would skip the exact reviewer who flagged the correction, which
    // defeats the point of the return. Falls back to auto-routing back to whoever returned it.
    if (
      user.role === ROLES.INVESTIGATOR &&
      report.status === REPORT_STATUS.RETURNED &&
      status === REPORT_STATUS.SUBMITTED
    ) {
      const lastReviewer = report.reviewedById
        ? await prisma.user.findUnique({
            where: { id: report.reviewedById },
            select: { id: true, role: true, isActive: true },
          })
        : null;

      const tierIdx = tierIndexForRole(lastReviewer?.role);
      const sameTierRoles = tierIdx >= 0 ? REVIEW_TIERS[tierIdx] : MUNICIPAL_REVIEWER_ROLES;

      if (requestedPassedToRole && sameTierRoles.includes(requestedPassedToRole)) {
        const recipient = MUNICIPAL_REVIEWER_ROLES.includes(requestedPassedToRole)
          ? await prisma.user.findFirst({
              where: { role: requestedPassedToRole, municipalityId: report.municipalityId, isActive: true },
            })
          : await prisma.user.findFirst({
              where: { role: ROLES.PROVINCIAL_CHIEF_IIS, isActive: true },
            });

        if (!recipient) {
          return NextResponse.json(
            { error: `No ${requestedPassedToRole} account is available for this report` },
            { status: 400 }
          );
        }

        updateData.passedToRole = requestedPassedToRole;
        updateData.passedToId = recipient.id;
      } else if (lastReviewer && lastReviewer.isActive) {
        updateData.passedToRole = lastReviewer.role;
        updateData.passedToId = lastReviewer.id;
      }
    }

    // Investigator forwarding an approved (but not yet finally approved) report → the next tier
    // is fully determined by who last approved it. This is never taken from the client — a
    // client-chosen role previously let a report approved only by the Municipal Chief IIS jump
    // straight to the Provincial Chief IIS, skipping the Fire Marshal review entirely (and
    // Provincial approval is final, so that skip could never be caught afterward).
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

      const nextRoles = nextTierRoles(lastReviewer?.role);
      if (!nextRoles) {
        return NextResponse.json(
          { error: 'Invalid report state: cannot determine next forwarding step' },
          { status: 400 }
        );
      }
      const targetRole = nextRoles[0];

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

// Lets the original submitter retract their own report, or an admin remove any report. Once a
// report has received final approval (APPROVED with nothing left to forward), it's treated as
// part of the official record and only an admin can remove it.
export async function DELETE(request, { params }) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isDemoReportId(params.id)) {
      return NextResponse.json({ error: 'Demo reports cannot be deleted' }, { status: 400 });
    }

    const reportId = parseInt(params.id);
    const report = await prisma.report.findUnique({ where: { id: reportId } });

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const isAdmin = ADMIN_ROLES.includes(user.role);
    const isOwner = report.submittedById === user.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const isFinallyApproved = report.status === REPORT_STATUS.APPROVED && !report.passedToId;

    // A report an intermediate reviewer already approved-and-bounced-back (status APPROVED,
    // passedToId pointing back at the submitter to forward it on) isn't "finally approved" yet,
    // so the check above alone would let the owner delete it — silently destroying that
    // reviewer's AuditLog-backed "Reports Reviewed" history along with it. Once any reviewer has
    // actually acted on a report, only an admin may remove it, regardless of its current status.
    const hasBeenReviewed = await prisma.auditLog.findFirst({
      where: { reportId, action: { in: ['APPROVE_REPORT', 'RETURN_REPORT'] } },
      select: { id: true },
    });

    if (!isAdmin && (isFinallyApproved || hasBeenReviewed)) {
      return NextResponse.json(
        {
          error: hasBeenReviewed
            ? 'This report has already been reviewed and can no longer be deleted. Contact an admin if it needs to be removed.'
            : 'This report has received final approval and can no longer be deleted.',
        },
        { status: 400 }
      );
    }

    await deleteAttachments(parseJsonField(report.attachments, []));
    await prisma.report.delete({ where: { id: reportId } });

    return NextResponse.json({ message: 'Report deleted successfully' });
  } catch (error) {
    console.error('Error deleting report:', error);
    return NextResponse.json({ error: 'Failed to delete report' }, { status: 500 });
  }
}
