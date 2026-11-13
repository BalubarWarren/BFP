import prisma from './prisma';
import { ROLES, NOTIFICATION_TYPES } from './constants';
import { isReportRecipient, canViewReportViaArchive } from './report-access';

const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN];

// Who may open a single report — shared by GET /api/reports/[id] and POST
// /api/reports/[id]/qr so the QR code is available to exactly the people who can see the report.
export async function canUserViewReport(report, user) {
  // Investigators can only view their own reports
  if (user.role === ROLES.INVESTIGATOR) return report.submittedById === user.id;

  // Reviewers and other users may only view a report if they are the explicit recipient
  // or the original submitter. Super admins may view all.
  if (report.submittedById === user.id) return true;
  if (isReportRecipient(report, user)) return true;
  // Both admin roles track every report (Report Tracking → View Details).
  if (ADMIN_ROLES.includes(user.role)) return true;
  // Final approval clears passedToRole/passedToId, so the reviewers who signed off along the way
  // stop being "recipients" of the finished report. The shared Reports archive gives the three
  // archive roles read access to it (municipal ones still only within their own municipality).
  if (canViewReportViaArchive(report, user)) return true;

  const hasTextBlastAccess = await prisma.notification.findFirst({
    where: { userId: user.id, reportId: report.id, type: NOTIFICATION_TYPES.REPORT_TEXT_BLAST },
    select: { id: true },
  });
  if (hasTextBlastAccess) return true;

  // A reviewer's "Reports Reviewed" list (GET /api/reports?view=outgoing) is built from these
  // AuditLog rows — without the same check here, opening a report from that list 403s as soon
  // as the report has moved on to the next reviewer.
  const hasReviewedReport = await prisma.auditLog.findFirst({
    where: { userId: user.id, reportId: report.id, action: { in: ['APPROVE_REPORT', 'RETURN_REPORT'] } },
    select: { id: true },
  });
  if (hasReviewedReport) return true;

  // Spot -> Progress -> Final are one case: a reviewer who has (or had) any report of the case in
  // front of them can read the case's other reports, e.g. the Spot report a Progress report
  // continues. Only direct recipient/review links count here (no recursion through the case).
  if (report.incidentId) {
    const caseReports = await prisma.report.findMany({
      where: { incidentId: report.incidentId, id: { not: report.id } },
      select: { id: true, passedToId: true, passedToRole: true, municipalityId: true, submittedById: true },
    });
    if (caseReports.some((r) => r.submittedById === user.id || isReportRecipient(r, user))) return true;
    if (caseReports.length) {
      const reviewedInCase = await prisma.auditLog.findFirst({
        where: {
          userId: user.id,
          reportId: { in: caseReports.map((r) => r.id) },
          action: { in: ['APPROVE_REPORT', 'RETURN_REPORT'] },
        },
        select: { id: true },
      });
      if (reviewedInCase) return true;
    }
  }
  return false;
}
