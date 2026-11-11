'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getCaseFollowUp } from '../../lib/report-workflow';

// The only way into the Progress and Final Investigation forms: they continue a case that an
// approved Spot (or Progress) report already opened, so instead of standalone menu entries the
// investigator presses the next step right on that report's row and lands on the form with the
// incident preselected.
// From a finalized Spot report, Progress is the expected next step, with "skip to Final" offered
// as a quieter secondary link. From a finalized Progress report, only Final is left.
export default function CaseFollowUpCta({ report, allReports }) {
  const { showProgressCta, showFinalCta, hasProgressSubmitted } = getCaseFollowUp(report, allReports);

  if (!showProgressCta && !showFinalCta) {
    return null;
  }

  // Demo reports use synthetic negative incident ids that don't exist in the real `incidents`
  // table, so only carry the id forward when it's real (positive).
  const linkedIncidentId = report.incidentId > 0 ? report.incidentId : null;
  const incidentQuery = linkedIncidentId ? `?incidentId=${linkedIncidentId}` : '';

  const primaryHref = showProgressCta ? `/municipal/reports/progress${incidentQuery}` : `/municipal/reports/final${incidentQuery}`;
  const primaryLabel = showProgressCta ? 'Start Progress Report' : 'Start Final Report';

  return (
    <div className="flex flex-col items-start gap-1">
      <Link
        href={primaryHref}
        className="btn btn-primary text-sm py-1.5 px-3 inline-flex items-center gap-1.5 whitespace-nowrap"
      >
        {primaryLabel} <ArrowRight className="h-3.5 w-3.5" />
      </Link>
      {showProgressCta && showFinalCta && (
        <Link
          href={`/municipal/reports/final${incidentQuery}`}
          className="text-xs font-semibold text-gray-500 hover:text-bfp-navy hover:underline"
        >
          or skip to Final Report
        </Link>
      )}
      {hasProgressSubmitted && !showProgressCta && report.reportType === 'SPOT_INVESTIGATION' && (
        <p className="text-xs text-gray-500">Progress report already submitted.</p>
      )}
    </div>
  );
}
