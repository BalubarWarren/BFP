import prisma from './prisma';
import { ROLES } from './constants';
import { deleteAttachments } from './storage';
import { parseJsonField } from './utils';

// How long a deleted report stays restorable before it (and its attachment files) is purged.
export const TRASH_RETENTION_DAYS = 30;

const TRASH_ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN];

export const isTrashAdmin = (user) => TRASH_ADMIN_ROLES.includes(user?.role);

// Admins see every trashed item; everyone else only what they deleted themselves — so an
// investigator can undo their own mistake but can't bring back a report an admin removed.
export const trashWhereForUser = (user) => (isTrashAdmin(user) ? {} : { deletedById: user.id });

export const canManageTrashItem = (item, user) => isTrashAdmin(user) || item.deletedById === user.id;

const formatReportType = (type) =>
  type
    ?.replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Report';

class TrashConflictError extends Error {}
export class TrashRestoreError extends Error {}

// Moves a report into the trash in one transaction: the report row (and its annotations, which
// cascade) is removed and a full snapshot of it is written to trash_items. If it was the last
// report on its incident, the incident is snapshotted and removed too — same cleanup the old
// hard delete did, but reversible. Attachment files are left in storage until purge.
//
// Guarded on `report.updatedAt` exactly like the old delete, so a reviewer acting on the report
// at the same moment can't have their review trashed out from under them. Returns false on that
// conflict.
export async function moveReportToTrash(report, deletedBy) {
  try {
    await prisma.$transaction(async (tx) => {
      const annotations = await tx.annotation.findMany({ where: { reportId: report.id } });
      const municipality = await tx.municipality.findUnique({
        where: { id: report.municipalityId },
        select: { name: true },
      });

      const deleted = await tx.report.deleteMany({ where: { id: report.id, updatedAt: report.updatedAt } });
      if (deleted.count === 0) throw new TrashConflictError();

      let incident = null;
      if (report.incidentId) {
        const remainingReports = await tx.report.count({ where: { incidentId: report.incidentId } });
        if (remainingReports === 0) {
          incident = await tx.incident.findUnique({ where: { id: report.incidentId } });
          if (incident) await tx.incident.delete({ where: { id: incident.id } });
        }
      }

      const expiresAt = new Date(Date.now() + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      await tx.trashItem.create({
        data: {
          itemType: 'REPORT',
          originalId: report.id,
          label: `${formatReportType(report.reportType)} report${municipality?.name ? ` — ${municipality.name}` : ''}`,
          data: JSON.stringify({ report, annotations, incident }),
          ownerId: report.submittedById,
          municipalityId: report.municipalityId,
          deletedById: deletedBy.id,
          deletedByName: deletedBy.name || null,
          expiresAt,
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'TRASH_REPORT',
          userId: deletedBy.id,
          reportId: report.id,
          changes: JSON.stringify({ reportType: report.reportType, status: report.status }),
        },
      });
    });
    return true;
  } catch (error) {
    if (error instanceof TrashConflictError) return false;
    throw error;
  }
}

// Recreates a trashed report under its original id. References that no longer exist are handled
// the same way their onDelete rules would have: reviewer/recipient links are cleared, annotations
// by removed authors are dropped. A missing submitter or municipality can't be papered over —
// those are required — so the restore is refused with an explanation instead.
export async function restoreTrashItem(item, restoredBy) {
  const { report, annotations = [], incident } = parseJsonField(item.data, {});
  if (!report?.id) throw new TrashRestoreError('This item is damaged and cannot be restored.');

  await prisma.$transaction(async (tx) => {
    const [submitter, municipality, existing] = await Promise.all([
      tx.user.findUnique({ where: { id: report.submittedById }, select: { id: true } }),
      tx.municipality.findUnique({ where: { id: report.municipalityId }, select: { id: true } }),
      tx.report.findUnique({ where: { id: report.id }, select: { id: true } }),
    ]);
    if (existing) throw new TrashRestoreError('A report with this ID already exists.');
    if (!submitter) throw new TrashRestoreError('The account that submitted this report no longer exists, so it cannot be restored.');
    if (!municipality) throw new TrashRestoreError('This report\'s municipality no longer exists, so it cannot be restored.');

    let incidentId = report.incidentId || null;
    if (incidentId) {
      const incidentExists = await tx.incident.findUnique({ where: { id: incidentId }, select: { id: true } });
      if (!incidentExists) {
        const canRecreate = incident
          && incident.id === incidentId
          && !(await tx.incident.findUnique({ where: { referenceNumber: incident.referenceNumber }, select: { id: true } }))
          && (await tx.user.findUnique({ where: { id: incident.createdById }, select: { id: true } }));
        if (canRecreate) {
          const { updatedAt: _incidentUpdatedAt, ...incidentData } = incident;
          await tx.incident.create({ data: incidentData });
        } else {
          incidentId = null;
        }
      }
    }

    const userIdsToCheck = [report.passedToId, report.reviewedById, ...annotations.map((a) => a.authorId)].filter(Boolean);
    const liveUserIds = new Set(
      (await tx.user.findMany({ where: { id: { in: userIdsToCheck } }, select: { id: true } })).map((u) => u.id)
    );

    const qrTaken = report.qrToken
      ? await tx.report.findUnique({ where: { qrToken: report.qrToken }, select: { id: true } })
      : null;

    // updatedAt is left to Prisma so any tab still holding the pre-delete copy gets a 409 instead
    // of acting on a stale version.
    const { updatedAt: _reportUpdatedAt, ...reportData } = report;
    await tx.report.create({
      data: {
        ...reportData,
        incidentId,
        passedToId: liveUserIds.has(report.passedToId) ? report.passedToId : null,
        reviewedById: liveUserIds.has(report.reviewedById) ? report.reviewedById : null,
        qrToken: qrTaken ? null : report.qrToken,
      },
    });

    const restorableAnnotations = annotations.filter((a) => liveUserIds.has(a.authorId));
    if (restorableAnnotations.length) {
      await tx.annotation.createMany({
        data: restorableAnnotations.map((a) => ({ ...a, reportId: report.id })),
        skipDuplicates: true,
      });
    }

    await tx.trashItem.delete({ where: { id: item.id } });

    await tx.auditLog.create({
      data: {
        action: 'RESTORE_REPORT',
        userId: restoredBy.id,
        reportId: report.id,
        changes: JSON.stringify({ reportType: report.reportType }),
      },
    });
  });

  return report.id;
}

// Permanently removes trash items and the attachment files they were keeping alive. The rows go
// first; a file left behind by a storage hiccup is harmless, a row pointing at deleted files isn't.
export async function purgeTrashItems(items, purgedBy = null) {
  if (!items.length) return 0;

  const { count } = await prisma.trashItem.deleteMany({ where: { id: { in: items.map((item) => item.id) } } });

  const attachments = items.flatMap((item) => parseJsonField(parseJsonField(item.data, {}).report?.attachments, []));
  await deleteAttachments(attachments);

  if (purgedBy) {
    await prisma.auditLog.createMany({
      data: items.map((item) => ({
        action: 'PURGE_REPORT',
        userId: purgedBy.id,
        reportId: item.originalId,
        changes: JSON.stringify({ label: item.label }),
      })),
    });
  }

  return count;
}

// Best-effort sweep of items past their retention window — run whenever the trash is listed and
// by the scheduled overdue check, so nothing depends on a dedicated cron job.
export async function purgeExpiredTrash() {
  try {
    const expired = await prisma.trashItem.findMany({
      where: { expiresAt: { lte: new Date() } },
      select: { id: true, originalId: true, label: true, data: true },
      take: 200,
    });
    return await purgeTrashItems(expired);
  } catch (error) {
    console.error('Failed to purge expired trash:', error);
    return 0;
  }
}
