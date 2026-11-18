// Daily tallies (the dashboard's placeholder numbers) that demonstration cases stand in for are
// relabelled with REPLACED_PREFIX in front of their reporting officer by
// scripts/demo-data/demo-seed.sql — never deleted — and get their label back from
// scripts/demo-data/demo-cleanup.sql. The dashboards skip relabelled tallies so the same fires
// aren't counted twice (once as a tally, once as the demonstration cases' Spot reports).
export const REPLACED_PREFIX = '[sample-replaced] ';
// Label used by an earlier version of the sample-data tool, still recognised.
const LEGACY_REPLACED_OFFICER = 'System Seed [replaced by sample reports]';

export const ACTIVE_DAILY_ENTRY_WHERE = {
  NOT: [{ reportingOfficer: { startsWith: REPLACED_PREFIX } }, { reportingOfficer: LEGACY_REPLACED_OFFICER }],
};
