import { ROLES } from './constants';

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
