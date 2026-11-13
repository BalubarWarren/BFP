import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getUserFromRequest, PUBLIC_USER_SELECT } from '../../../../lib/auth';
import { NOTIFICATION_TYPES, ROLES, REPORT_STATUS } from '../../../../lib/constants';
import { getDemoReportById, isDemoReportId } from '../../../../lib/demo-reports';
import {
  MUNICIPAL_REVIEWER_ROLES,
  PROVINCIAL_REVIEWER_ROLES,
  tierIndexForRole,
  nextTierRoles,
  REVIEW_TIERS,
} from '../../../../lib/report-access';
import { archiveReportVersion, listReportVersions } from '../../../../lib/archive';
import { notifyReportRecipients } from '../../../../lib/report-notifications';
import { canUserViewReport } from '../../../../lib/report-view-access';
import { generateQrToken } from '../../../../lib/qr-token';
import { isStoredAttachmentUrl } from '../../../../lib/storage';
import { parseJsonField } from '../../../../lib/utils';

// Same cap as POST /api/reports.
const MAX_ATTACHMENTS = 10;

// Attachment objects from the client are only accepted when they point at our own storage bucket
// (reviewers open them as links), and are reduced to the known fields.
const normalizeAttachments = (value, existingUrls = new Set()) => {
  const list = parseJsonField(value, null);
  if (
    !Array.isArray(list) ||
    !list.length ||
    list.length > MAX_ATTACHMENTS ||
    !list.every((attachment) => existingUrls.has(attachment?.url) || isStoredAttachmentUrl(attachment?.url))
  ) {
    return null;
  }
  return list.map((attachment) => ({
    name: String(attachment.name || 'attachment').slice(0, 200),
    type: String(attachment.type || 'application/octet-stream'),
    size: Number(attachment.size) || 0,
    url: attachment.url,
    ...(attachment.kind === 'EMS' && { kind: 'EMS' }),
  }));
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
        submittedBy: { select: PUBLIC_USER_SELECT },
        reviewedBy: { select: PUBLIC_USER_SELECT },
        passedTo: { select: PUBLIC_USER_SELECT },
        incident: true,
      },
    });

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    if (!(await canUserViewReport(report, user))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // The other reports filed under the same case (Spot -> Progress -> Final), so every report
    // view can show how it connects to the rest. Only type/status, never their content.
    const caseReports = report.incidentId
      ? await prisma.report.findMany({
          where: {
            incidentId: report.incidentId,
            OR: [{ status: { not: REPORT_STATUS.DRAFT } }, { id: report.id }],
          },
          select: { id: true, reportType: true, status: true, submittedAt: true, passedToId: true, passedToRole: true },
          orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
        })
      : [];

    // Earlier versions of this report (it was returned and revised), kept in the Report Archive.
    const archivedVersions = await listReportVersions(report.id);

    return NextResponse.json({ report: { ...report, caseReports, archivedVersions } });
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
    const { content, category, respondingUnits, respondingOfficer, reportingOfficerRank, stationCommanderName, status, passedToRole: requestedPassedToRole, attachments: requestedAttachments } = body;

    // The only status transition this endpoint may perform is re-submitting; approvals/returns
    // must go through /approve so reviewedById/reviewedAt/remarks stay accurate.
    if (status && status !== REPORT_STATUS.SUBMITTED) {
      return NextResponse.json(
        { error: 'Invalid status transition' },
        { status: 400 }
      );
    }

    // Content may only change while the report is back in the submitter's hands for correction.
    // Otherwise a report could be edited while a reviewer is looking at it, or after a municipal
    // approval and before forwarding — so the next tier would review content the earlier
    // reviewer never approved.
    const isEditingFields = [content, category, respondingUnits, respondingOfficer, reportingOfficerRank, stationCommanderName, requestedAttachments]
      .some((value) => value !== undefined);
    if (isEditingFields && ![REPORT_STATUS.RETURNED, REPORT_STATUS.DRAFT].includes(report.status)) {
      return NextResponse.json(
        { error: 'Report details can only be edited while the report is returned for revision' },
        { status: 400 }
      );
    }

    // A revision may replace the report's files (e.g. a corrected PDF). The previous file list is
    // kept with the archived version below, and the old files themselves stay in storage.
    let revisedAttachments = null;
    if (requestedAttachments !== undefined) {
      // Files the report already had are accepted as-is; new ones must be in our bucket.
      const existingUrls = new Set(parseJsonField(report.attachments, []).map((attachment) => attachment?.url));
      revisedAttachments = normalizeAttachments(requestedAttachments, existingUrls);
      if (!revisedAttachments) {
        return NextResponse.json({ error: 'Invalid attachments' }, { status: 400 });
      }
      if (!revisedAttachments.some((attachment) => attachment.kind !== 'EMS')) {
        return NextResponse.json({ error: 'At least one attachment is required.' }, { status: 400 });
      }
    }

    // Allow submitter to re-submit a returned report and optionally forward to a specific municipal role
    let updateData = {
      ...(revisedAttachments && { attachments: JSON.stringify(revisedAttachments) }),
      ...(content && { content }),
      ...(category && { category }),
      ...(respondingUnits && { respondingUnits }),
      ...(respondingOfficer && { respondingOfficer }),
      ...(reportingOfficerRank && { reportingOfficerRank }),
      ...(stationCommanderName && { stationCommanderName }),
      ...(status && { status }),
      // Keeps the report's existing QR code through returns and corrections — only a report that
      // somehow doesn't have one yet (e.g. passed before QR codes were issued at submission) gets
      // one here, as it's passed on again.
      ...(status === REPORT_STATUS.SUBMITTED && !report.qrToken && { qrToken: generateQrToken() }),
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
      } else if (lastReviewer) {
        // The reviewer who returned it has since been deactivated — hand it to another active
        // holder of the same role instead of leaving it assigned to the investigator, where
        // nobody could ever review it.
        const replacement = await prisma.user.findFirst({
          where: {
            role: lastReviewer.role,
            isActive: true,
            ...(MUNICIPAL_REVIEWER_ROLES.includes(lastReviewer.role) && { municipalityId: report.municipalityId }),
          },
        });
        if (!replacement) {
          return NextResponse.json(
            { error: `No active ${lastReviewer.role.replace(/_/g, ' ')} account is available to receive this report` },
            { status: 400 }
          );
        }
        updateData.passedToRole = replacement.role;
        updateData.passedToId = replacement.id;
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

    // Revising a returned report replaces its content, so the version the reviewer returned is
    // saved to the Report Archive first (see lib/archive.js). Reports are never deleted: every
    // earlier version stays on file with the remarks it was returned with.
    const archivesPreviousVersion = isEditingFields && report.status === REPORT_STATUS.RETURNED;

    // Guarded on the exact version just read: a double-clicked Forward/Resubmit, or the same
    // report open in two tabs, would otherwise both pass the status checks above and both apply
    // (sending every reviewer duplicate notifications). Only the first write wins; the other
    // gets a 409 instead of re-routing a report that has already moved on. The archive copy is
    // written in the same transaction, so it exists exactly when the revision does.
    const updatedCount = await prisma.$transaction(async (tx) => {
      const guarded = await tx.report.updateMany({
        where: { id: report.id, status: report.status, updatedAt: report.updatedAt },
        data: updateData,
      });
      if (guarded.count > 0 && archivesPreviousVersion) {
        await archiveReportVersion(tx, report, user);
      }
      return guarded.count;
    });
    if (updatedCount === 0) {
      return NextResponse.json(
        { error: 'This report was changed in the meantime. Refresh to see its current status.' },
        { status: 409 }
      );
    }

    const updatedReport = await prisma.report.findUnique({
      where: { id: report.id },
      include: {
        municipality: true,
        submittedBy: { select: PUBLIC_USER_SELECT },
        incident: true,
      },
    });

    // Notify every reviewer who can act on the report when it's forwarded or resubmitted
    try {
      if (status === REPORT_STATUS.SUBMITTED && updatedReport.passedToId) {
        await notifyReportRecipients({
          report: updatedReport,
          message: `A ${updatedReport.reportType} report from ${updatedReport.municipality?.name} is awaiting your review.`,
          type: NOTIFICATION_TYPES.REPORT_SUBMITTED,
          excludeUserId: user.id,
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

// There is deliberately no DELETE handler: reports are part of the official record and cannot be
// deleted. Earlier versions of revised reports are kept in the Report Archive (lib/archive.js).
