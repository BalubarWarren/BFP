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
