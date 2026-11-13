// Given a finally-approved report (Spot or Progress Investigation) and the full list of reports
// the current user can see, figures out what's still needed to close out the case it anchors —
// used to show "Submit Progress" / "Submit Final" prompts without a manual "skip" step
// (submitting Final directly instead of Progress *is* the skip).
//
// The anchor report is included when checking what's already been submitted for the case (not
// excluded), so calling this with a finally-approved Progress report correctly reports
// hasProgressSubmitted: true — that report *is* the progress submission — and only offers the
// Final step next, instead of re-offering Progress.
export function getCaseFollowUp(report, allReports) {
  const empty = {
    hasProgressSubmitted: false,
    hasFinalSubmitted: false,
    showProgressCta: false,
    showFinalCta: false,
  };

  if (!report?.incidentId) return empty;

  const caseReports = (allReports || []).filter((r) => r.incidentId === report.incidentId);

  const hasProgressSubmitted = caseReports.some(
    (r) => r.reportType === 'PROGRESS_INVESTIGATION' && r.status !== 'DRAFT'
  );
  const hasFinalSubmitted = caseReports.some(
    (r) => r.reportType === 'FINAL_INVESTIGATION' && r.status !== 'DRAFT'
  );

  return {
    hasProgressSubmitted,
    hasFinalSubmitted,
    showProgressCta: !hasProgressSubmitted && !hasFinalSubmitted,
    showFinalCta: !hasFinalSubmitted,
  };
}

const CASE_STEP_TYPES = ['SPOT_INVESTIGATION', 'PROGRESS_INVESTIGATION', 'FINAL_INVESTIGATION'];
const CASE_STEP_SHORT_LABEL = {
  SPOT_INVESTIGATION: 'Spot',
  PROGRESS_INVESTIGATION: 'Progress',
  FINAL_INVESTIGATION: 'Final',
};

export const isFinallyApprovedReport = (report) => report?.status === 'APPROVED' && !report?.passedToId;

// Cases a new Progress/Final report can continue: a real incident whose Spot report has cleared
// final approval and that has no Final report filed yet. Same rule the server enforces in
// POST /api/reports. Each entry carries the Spot report so the form can show what it continues.
export function getOpenCases(allReports) {
  const byIncident = new Map();
  for (const report of allReports || []) {
    if (!(report.incidentId > 0) || report.status === 'DRAFT') continue;
    if (!byIncident.has(report.incidentId)) byIncident.set(report.incidentId, []);
    byIncident.get(report.incidentId).push(report);
  }

  const cases = [];
  for (const [incidentId, reports] of byIncident) {
    const spot = reports.find((r) => r.reportType === 'SPOT_INVESTIGATION' && isFinallyApprovedReport(r));
    if (!spot) continue;
    if (reports.some((r) => r.reportType === 'FINAL_INVESTIGATION')) continue;
    cases.push({
      incidentId,
      incident: spot.incident || null,
      spot,
      progressReports: reports.filter((r) => r.reportType === 'PROGRESS_INVESTIGATION'),
    });
  }
  return cases.sort((a, b) => new Date(b.spot.submittedAt || 0) - new Date(a.spot.submittedAt || 0));
}

// The other Spot/Progress/Final reports filed under the same case as `report`, in case order
// (Spot, then Progress, then Final), for showing the link right on a report's row.
export function getLinkedCaseReports(report, allReports) {
  if (!(report?.incidentId > 0) || !CASE_STEP_TYPES.includes(report.reportType)) return [];
  return (allReports || [])
    .filter(
      (r) =>
        r.id !== report.id &&
        r.incidentId === report.incidentId &&
        r.status !== 'DRAFT' &&
        CASE_STEP_TYPES.includes(r.reportType)
    )
    .sort(
      (a, b) =>
        CASE_STEP_TYPES.indexOf(a.reportType) - CASE_STEP_TYPES.indexOf(b.reportType) ||
        new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0)
    )
    .map((r) => ({ ...r, shortLabel: CASE_STEP_SHORT_LABEL[r.reportType] }));
}

export default getCaseFollowUp;
