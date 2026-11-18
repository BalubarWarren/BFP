import prisma from './prisma';
import { NOTIFICATION_TYPES, REPORT_STATUS, ROLES } from './constants';

// Requests an investigator makes about a report, decided by the Municipal Chief IIS of the
// report's municipality (table report_requests, model ReportRequest):
//
//   REOPEN        Reopen a Final Investigation Report that already has final approval. Approved,
//                 the report goes back to the investigator as RETURNED (the earlier version is kept
//                 in the Report Archive when it's revised) and must pass review again.
//   COLLABORATOR  Let another investigator of the same municipality edit the report as well, on
//                 the strength of a Letter of Order (an uploaded file). While APPROVED, that
//                 investigator can open, revise and resubmit the report like its submitter.
//
// The table is new (migration 20261118120000_add_report_requests). Every read used by existing
// screens goes through the helpers below, which treat a missing table as "no requests", so the
// rest of the app keeps working on a database the migration hasn't reached yet.

export const REQUEST_TYPES = { REOPEN: 'REOPEN', COLLABORATOR: 'COLLABORATOR' };
export const REQUEST_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  DECLINED: 'DECLINED',
  REVOKED: 'REVOKED',
  CANCELLED: 'CANCELLED',
};

export const REQUEST_DECIDER_ROLES = [ROLES.MUNICIPAL_CHIEF_IIS];

export const isFinallyApproved = (report) => report?.status === REPORT_STATUS.APPROVED && !report?.passedToId;

// "The table doesn't exist yet" (Prisma P2021) — or any other read failure — means no requests.
async function safeRead(fn, fallback) {
  try {
    return await fn();
  } catch (error) {
    if (error?.code !== 'P2021') console.warn('report_requests read failed:', error?.message);
    return fallback;
  }
}

// Ids of the reports `userId` currently co-edits through an approved COLLABORATOR request.
export async function getCollaboratingReportIds(userId) {
  return safeRead(async () => {
    const rows = await prisma.reportRequest.findMany({
      where: { type: REQUEST_TYPES.COLLABORATOR, status: REQUEST_STATUS.APPROVED, targetUserId: userId },
      select: { reportId: true },
    });
    return rows.map((row) => row.reportId);
  }, []);
}

export async function isReportCollaborator(reportId, userId) {
  return safeRead(async () => {
    const row = await prisma.reportRequest.findFirst({
      where: { type: REQUEST_TYPES.COLLABORATOR, status: REQUEST_STATUS.APPROVED, targetUserId: userId, reportId },
      select: { id: true },
    });
    return !!row;
  }, false);
}

// The submitter, or an approved co-investigator: the people who may edit/resubmit a report.
export async function canEditAsInvestigator(report, user) {
  if (!report || !user) return false;
  if (report.submittedById === user.id) return true;
  if (user.role !== ROLES.INVESTIGATOR) return false;
  return isReportCollaborator(report.id, user.id);
}

const REQUEST_INCLUDE = {
  requestedBy: { select: { id: true, name: true, rank: true } },
  targetUser: { select: { id: true, name: true, rank: true } },
  decidedBy: { select: { id: true, name: true } },
  report: {
    select: {
      id: true,
      reportType: true,
      status: true,
      passedToId: true,
      submittedById: true,
      municipalityId: true,
      incident: { select: { referenceNumber: true, barangay: true, address: true } },
    },
  },
};

export async function listRequestsForReport(reportId) {
  return safeRead(
    () => prisma.reportRequest.findMany({ where: { reportId }, include: REQUEST_INCLUDE, orderBy: { createdAt: 'desc' } }),
    []
  );
}

export async function listRequestsForDecider(user, { status } = {}) {
  return safeRead(
    () =>
      prisma.reportRequest.findMany({
        where: { municipalityId: user.municipalityId, ...(status && { status }) },
        include: REQUEST_INCLUDE,
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    []
  );
}

export async function getRequest(id) {
  return prisma.reportRequest.findUnique({ where: { id }, include: REQUEST_INCLUDE });
}

// Notifies every active Municipal Chief IIS of the municipality about a new request.
export async function notifyDeciders({ municipalityId, reportId, message }) {
  const deciders = await prisma.user.findMany({
    where: { role: { in: REQUEST_DECIDER_ROLES }, municipalityId, isActive: true },
    select: { id: true },
  });
  if (!deciders.length) return 0;
  await prisma.notification.createMany({
    data: deciders.map((decider) => ({
      userId: decider.id,
      reportId,
      type: NOTIFICATION_TYPES.REPORT_REQUEST,
      message,
    })),
  });
  return deciders.length;
}

export async function notifyUsers(userIds, { reportId, message }) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return;
  await prisma.notification.createMany({
    data: ids.map((userId) => ({ userId, reportId, type: NOTIFICATION_TYPES.REPORT_REQUEST_DECIDED, message })),
  });
}

export const REQUEST_TYPE_LABELS = {
  REOPEN: 'Reopen Final Investigation Report',
  COLLABORATOR: 'Add co-investigator',
};
