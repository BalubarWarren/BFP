import prisma from './prisma';
import { ROLES } from './constants';
import { parseJsonField } from './utils';
import { canUserViewReport } from './report-view-access';
import { MUNICIPAL_REVIEWER_ROLES } from './report-access';

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

const isOwnItem = (item, user) => item.ownerId === user.id || item.deletedById === user.id;

// Who sees what in the archive:
// - admins: everything;
// - investigators: the earlier versions of their own reports;
// - reviewers: earlier versions of reports they are allowed to open now (same rule as
//   GET /api/reports/:id), so a reviewer can compare a resubmitted report with what they returned.
// This is the coarse database filter; filterViewableArchiveItems applies the per-report rule.
export const archiveWhereForUser = (user) => {
  if (isArchiveAdmin(user)) return {};
  if (user.role === ROLES.INVESTIGATOR) return { OR: [{ ownerId: user.id }, { deletedById: user.id }] };
  return {
    itemType: ARCHIVE_ITEM_TYPES.VERSION,
    ...(MUNICIPAL_REVIEWER_ROLES.includes(user.role) && { municipalityId: user.municipalityId }),
  };
};

// Keeps only the items `user` may open. Reviewers need the live report to still exist and be
// viewable by them; an item whose report is gone stays visible only to its owner and admins.
export async function filterViewableArchiveItems(items, user) {
  if (isArchiveAdmin(user)) return items;
  if (user.role === ROLES.INVESTIGATOR) return items.filter((item) => isOwnItem(item, user));

  const ids = [...new Set(items.map((item) => item.originalId))];
  const reports = ids.length ? await prisma.report.findMany({ where: { id: { in: ids } } }) : [];
  const viewable = new Set();
  for (const report of reports) {
    // eslint-disable-next-line no-await-in-loop
    if (await canUserViewReport(report, user)) viewable.add(report.id);
  }
  return items.filter((item) => isOwnItem(item, user) || viewable.has(item.originalId));
}

export async function canViewArchiveItem(item, user) {
  const [allowed] = await filterViewableArchiveItems([item], user);
  return !!allowed;
}

// The earlier versions of one report, newest first, for its "Revision history" panel. Only call
// this after checking the user may view the live report.
export async function listReportVersions(reportId) {
  const items = await prisma.trashItem.findMany({
    where: { itemType: ARCHIVE_ITEM_TYPES.VERSION, originalId: reportId },
    orderBy: { deletedAt: 'desc' },
  });
  return items.map((item) => {
    const { version, report } = parseJsonField(item.data, {});
    return {
      id: item.id,
      version: version || null,
      archivedAt: item.deletedAt,
      archivedByName: item.deletedByName,
      remarks: report?.remarks || null,
    };
  });
}

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
