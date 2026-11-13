import prisma from './prisma';
import { ROLES } from './constants';
import { parseJsonField } from './utils';

// Report Archive. Reports are never deleted. When a returned report is revised and resubmitted,
// the version the reviewer returned is saved here first, so every earlier version stays on file
// alongside the reviewer's remarks and annotations on it.
//
// Archived items are stored in the `trash_items` table (Prisma model TrashItem), which was the
// recycle bin before deletion was retired. Its columns are reused as-is so no migration is needed:
//   deletedById / deletedByName / deletedAt  -> who archived the version, and when
//   expiresAt                                -> unused; set to a far-future date (nothing expires)
// itemType tells the two kinds of entry apart:
//   REPORT_VERSION -> an earlier version of a report that was later revised
//   REPORT         -> a report removed under the old Delete feature, kept for the record
export const ARCHIVE_ITEM_TYPES = { VERSION: 'REPORT_VERSION', REMOVED: 'REPORT' };

const NEVER_EXPIRES = new Date('9999-12-31T00:00:00.000Z');

const ARCHIVE_ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN];

export const isArchiveAdmin = (user) => ARCHIVE_ADMIN_ROLES.includes(user?.role);

// Admins see the whole archive. Everyone else sees the archived versions of their own reports.
export const archiveWhereForUser = (user) =>
  isArchiveAdmin(user) ? {} : { OR: [{ ownerId: user.id }, { deletedById: user.id }] };

export const canViewArchiveItem = (item, user) =>
  isArchiveAdmin(user) || item.ownerId === user.id || item.deletedById === user.id;

const formatReportType = (type) =>
  type
    ?.replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Report';

// Saves `report` (the row as it was before the revision) into the archive. Must run inside the
// same transaction as the update that replaces it, so a version is never lost or duplicated.
export async function archiveReportVersion(tx, report, archivedBy) {
  const [annotations, municipality, earlierVersions] = await Promise.all([
    tx.annotation.findMany({ where: { reportId: report.id } }),
    tx.municipality.findUnique({ where: { id: report.municipalityId }, select: { name: true } }),
    tx.trashItem.count({ where: { itemType: ARCHIVE_ITEM_TYPES.VERSION, originalId: report.id } }),
  ]);
  const version = earlierVersions + 1;

  await tx.trashItem.create({
    data: {
      itemType: ARCHIVE_ITEM_TYPES.VERSION,
      originalId: report.id,
      label: `${formatReportType(report.reportType)} report${municipality?.name ? ` — ${municipality.name}` : ''}`,
      data: JSON.stringify({ report, annotations, version }),
      ownerId: report.submittedById,
      municipalityId: report.municipalityId,
      deletedById: archivedBy.id,
      deletedByName: archivedBy.name || null,
      expiresAt: NEVER_EXPIRES,
    },
  });

  await tx.auditLog.create({
    data: {
      action: 'ARCHIVE_REPORT_VERSION',
      userId: archivedBy.id,
      reportId: report.id,
      changes: JSON.stringify({ reportType: report.reportType, version, remarks: report.remarks || null }),
    },
  });
}

// The fields the archive list shows. The full snapshot is only sent when one item is opened.
export function summarizeArchiveItem(item) {
  const { report, incident, version } = parseJsonField(item.data, {});
  return {
    id: item.id,
    kind: item.itemType === ARCHIVE_ITEM_TYPES.VERSION ? 'VERSION' : 'REMOVED',
    originalId: item.originalId,
    label: item.label,
    version: version || null,
    archivedByName: item.deletedByName,
    archivedAt: item.deletedAt,
    report: report && {
      reportType: report.reportType,
      status: report.status,
      reportDate: report.reportDate,
      submittedAt: report.submittedAt,
      remarks: report.remarks || null,
      attachmentCount: parseJsonField(report.attachments, []).length,
    },
    referenceNumber: incident?.referenceNumber || null,
  };
}
