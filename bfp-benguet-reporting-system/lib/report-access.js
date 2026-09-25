import { ROLES, REPORT_STATUS, APPROVED_REPORTS_ROLES } from './constants';

// Shared across every report-related API route so a rule change (e.g. adding a new reviewer
// role) only needs to happen in one place instead of being kept in sync across several files.
export const MUNICIPAL_REVIEWER_ROLES = [
  ROLES.MUNICIPAL_CHIEF_IIS,
  ROLES.MUNICIPAL_CHIEF_OPERATION,
  ROLES.MUNICIPAL_FIRE_MARSHAL,
];

export const PROVINCIAL_REVIEWER_ROLES = [
  ROLES.PROVINCIAL_CHIEF_IIS,
  ROLES.MARSHAL,
  ROLES.CHIEF_INVESTIGATOR_IIS,
];

// Whether `user` is the actual recipient of `report` — either explicitly (passedToId) or by
// role match, with municipal reviewers additionally scoped to their own municipality (unlike
// provincial reviewers, who review reports from every municipality).
export const isReportRecipient = (report, user) => {
  if (report.passedToId === user.id) return true;
  if (report.passedToRole !== user.role) return false;
  if (PROVINCIAL_REVIEWER_ROLES.includes(user.role)) return true;
  if (MUNICIPAL_REVIEWER_ROLES.includes(user.role)) {
    return report.municipalityId === user.municipalityId;
  }
  return false;
};

// The review chain is a fixed three-tier ladder. Both forwarding an approved report and
// resubmitting a returned one must stay within the tier the last reviewer belongs to (or, when
// forwarding, move exactly one tier forward) — never let a client-supplied role skip ahead
// (e.g. straight from Municipal Chief IIS to Provincial Chief IIS, bypassing Fire Marshal).
export const REVIEW_TIERS = [
  [ROLES.MUNICIPAL_CHIEF_IIS, ROLES.MUNICIPAL_CHIEF_OPERATION],
  [ROLES.MUNICIPAL_FIRE_MARSHAL],
  [ROLES.PROVINCIAL_CHIEF_IIS],
];

export const tierIndexForRole = (role) => REVIEW_TIERS.findIndex((tier) => tier.includes(role));

// The roles a report may be forwarded to next, given the role of whoever last reviewed it.
// Returns null when there is no next tier (the last reviewer was already the final one).
export const nextTierRoles = (lastReviewerRole) => {
  const idx = tierIndexForRole(lastReviewerRole);
  if (idx === -1 || idx >= REVIEW_TIERS.length - 1) return null;
  return REVIEW_TIERS[idx + 1];
};

// ---------------------------------------------------------------------------
// Approved-report archive (the shared "Reports" dashboard)
// ---------------------------------------------------------------------------

// A report that has cleared the whole review ladder. The final approver (Provincial Chief IIS)
// is the only reviewer who leaves nothing to forward, so POST /api/reports/[id]/approve nulls
// passedToRole/passedToId for them while every municipal approval routes the report back to the
// investigator with both set — which makes APPROVED + no recipient the signature of a final
// approval. Kept here so the archive, the edit lock, and the delete lock all agree on it.
export const FINALLY_APPROVED_WHERE = {
  status: REPORT_STATUS.APPROVED,
  passedToId: null,
  passedToRole: null,
};

export const isFinallyApprovedReport = (report) =>
  report?.status === REPORT_STATUS.APPROVED && !report.passedToId && !report.passedToRole;

// The roles that share the approved-report archive live in lib/constants.js next to the route
// guard and the nav link, so the client and the API can never drift apart on who gets in.
// Provincial Chief IIS files the reports there by giving final approval; the two municipal
// reviewers who signed off earlier in the chain get read access to the finished record instead of
// losing sight of it once it leaves their queue.
export { APPROVED_REPORTS_ROLES };

export const canViewApprovedArchive = (user) => APPROVED_REPORTS_ROLES.includes(user?.role);

// Municipal members of the archive stay scoped to their own municipality, exactly as they are in
// every other report view — only the provincial reviewer sees all thirteen municipalities.
export const approvedArchiveWhere = (user) => {
  if (MUNICIPAL_REVIEWER_ROLES.includes(user.role)) {
    return { ...FINALLY_APPROVED_WHERE, municipalityId: user.municipalityId };
  }
  return { ...FINALLY_APPROVED_WHERE };
};

// Whether `user` may read a specific finished report through the archive.
export const canViewReportViaArchive = (report, user) => {
  if (!canViewApprovedArchive(user) || !isFinallyApprovedReport(report)) return false;
  if (MUNICIPAL_REVIEWER_ROLES.includes(user.role)) {
    return report.municipalityId === user.municipalityId;
  }
  return true;
};
