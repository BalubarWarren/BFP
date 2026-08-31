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

export default getCaseFollowUp;
