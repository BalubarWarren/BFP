import prisma from './prisma.js';
import { NOTIFICATION_TYPES, DEADLINES } from './constants.js';

const hoursAgo = (hours) => new Date(Date.now() - hours * 60 * 60 * 1000);
const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

// Creates the notification unless one of the same (reportId, type) already exists — each rule
// should only ever fire once per report.
async function notifyOnce({ reportId, userId, type, message }) {
  const existing = await prisma.notification.findFirst({ where: { reportId, type } });
  if (existing) return false;

  await prisma.notification.create({
    data: { userId, reportId, type, message },
  });
  return true;
}

// Rule A — the full Spot Investigation review chain should reach final approval within
// DEADLINES.SPOT_OVERDUE_HOURS of submission.
async function checkSpotApprovalSla() {
  const overdueSpotReports = await prisma.report.findMany({
    where: {
      reportType: 'SPOT_INVESTIGATION',
      status: 'SUBMITTED',
      submittedAt: { lte: hoursAgo(DEADLINES.SPOT_OVERDUE_HOURS) },
    },
  });

  let created = 0;
  for (const report of overdueSpotReports) {
    const didCreate = await notifyOnce({
      reportId: report.id,
      userId: report.submittedById,
      type: NOTIFICATION_TYPES.REPORT_SPOT_OVERDUE,
      message: `Spot Investigation report #${report.id} has not been fully approved within ${DEADLINES.SPOT_OVERDUE_HOURS} hours of submission.`,
    });
    if (didCreate) created += 1;
  }
  return created;
}

// Rule B — if a Spot report has been finally approved but neither a Progress nor a Final report
// has been submitted yet, flag it once DEADLINES.PROGRESS_OVERDUE_DAYS have passed.
// Rule C/D — the Final Investigation case-closure SLA, anchored to whichever milestone is latest
// (finally-approved Progress if one exists, else finally-approved Spot).
async function checkCaseFollowUps() {
  const finallyApprovedSpotReports = await prisma.report.findMany({
    where: {
      reportType: 'SPOT_INVESTIGATION',
      status: 'APPROVED',
      passedToId: null,
      incidentId: { not: null },
    },
  });

  let progressOverdueCreated = 0;
  let finalWarningCreated = 0;
  let finalOverdueCreated = 0;

  for (const spotReport of finallyApprovedSpotReports) {
    const caseReports = await prisma.report.findMany({
      where: {
        incidentId: spotReport.incidentId,
        id: { not: spotReport.id },
        reportType: { in: ['PROGRESS_INVESTIGATION', 'FINAL_INVESTIGATION'] },
      },
    });

    const hasFinalSubmitted = caseReports.some(
      (r) => r.reportType === 'FINAL_INVESTIGATION' && r.status !== 'DRAFT'
    );
    if (hasFinalSubmitted) continue; // case closed (or closing) — nothing left to flag

    const hasProgressSubmitted = caseReports.some(
      (r) => r.reportType === 'PROGRESS_INVESTIGATION' && r.status !== 'DRAFT'
    );
    const finallyApprovedProgress = caseReports.find(
      (r) => r.reportType === 'PROGRESS_INVESTIGATION' && r.status === 'APPROVED' && !r.passedToId
    );

    // Rule B
    if (!hasProgressSubmitted && spotReport.reviewedAt <= daysAgo(DEADLINES.PROGRESS_OVERDUE_DAYS)) {
      const didCreate = await notifyOnce({
        reportId: spotReport.id,
        userId: spotReport.submittedById,
        type: NOTIFICATION_TYPES.REPORT_PROGRESS_OVERDUE,
        message: `No Progress or Final Investigation report has been submitted ${DEADLINES.PROGRESS_OVERDUE_DAYS} days after Spot Investigation report #${spotReport.id} was approved.`,
      });
      if (didCreate) progressOverdueCreated += 1;
    }

    // Rule C/D
    const anchor = finallyApprovedProgress || spotReport;
    if (anchor.reviewedAt <= daysAgo(DEADLINES.FINAL_OVERDUE_DAYS)) {
      const didCreate = await notifyOnce({
        reportId: anchor.id,
        userId: anchor.submittedById,
        type: NOTIFICATION_TYPES.REPORT_OVERDUE,
        message: `Final Investigation report is overdue — ${DEADLINES.FINAL_OVERDUE_DAYS} days have passed since report #${anchor.id} was approved.`,
      });
      if (didCreate) finalOverdueCreated += 1;
    } else if (anchor.reviewedAt <= daysAgo(DEADLINES.FINAL_WARNING_DAYS)) {
      const didCreate = await notifyOnce({
        reportId: anchor.id,
        userId: anchor.submittedById,
        type: NOTIFICATION_TYPES.REPORT_DEADLINE_WARNING,
        message: `Final Investigation report is due soon — ${DEADLINES.FINAL_WARNING_DAYS} days have passed since report #${anchor.id} was approved.`,
      });
      if (didCreate) finalWarningCreated += 1;
    }
  }

  return { progressOverdueCreated, finalWarningCreated, finalOverdueCreated };
}

export async function runOverdueCheck() {
  const spotOverdueCreated = await checkSpotApprovalSla();
  const { progressOverdueCreated, finalWarningCreated, finalOverdueCreated } = await checkCaseFollowUps();

  return {
    spotOverdueCreated,
    progressOverdueCreated,
    finalWarningCreated,
    finalOverdueCreated,
  };
}

export default runOverdueCheck;
