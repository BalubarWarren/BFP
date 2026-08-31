'use client';

import Link from 'next/link';
import { ArrowRight, Clock, CheckCircle2 } from 'lucide-react';
import { getCaseFollowUp } from '@/lib/report-workflow';

// Shown under a finally-approved Spot or Progress Investigation report row so the investigator
// can move the case forward. These render as real buttons (not text links) — easy to mistake
// for a text link if styled too subtly, and this needs to read as clearly clickable and clearly
// distinct from actions like Text Blast that don't navigate anywhere.
// From a finally-approved Spot report, submitting Final directly (skipping Progress) is just as
// valid a next step as submitting Progress, so both are offered side by side rather than forcing
// an order — Progress as the primary (expected) path, Final as the secondary (skip) option. From
// a finally-approved Progress report, only Final is offered — Progress has already been done.
export default function CaseFollowUpCta({ report, allReports }) {
  const { showProgressCta, showFinalCta, hasProgressSubmitted } = getCaseFollowUp(report, allReports);

  if (!showProgressCta && !showFinalCta) return null;

  // Demo reports (shown to give every account something to click through) use synthetic
  // negative incident ids that only exist in this in-memory demo data, not in the real
  // `incidents` table. The Progress/Final forms populate their "Linked Incident" dropdown from
  // real incidents only, so passing a demo id through would silently fail to preselect it and
  // then fail for real on submit (foreign key to an incident that doesn't exist). Real incidents
  // always have positive ids, so only carry the id forward when it's real.
  const linkedIncidentId = report.incidentId > 0 ? report.incidentId : null;
  const incidentQuery = linkedIncidentId ? `?incidentId=${linkedIncidentId}` : '';

  return (
    <div className="mt-2 rounded-lg border border-bfp-navy/15 bg-bfp-navy/5 px-3 py-2">
      <p className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-bfp-navy/70">
        <ArrowRight className="h-3 w-3" />
        Case follow-up
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {showProgressCta && (
          <Link
            href={`/municipal/reports/progress${incidentQuery}`}
            className="btn btn-primary text-sm py-1.5 px-3 inline-flex items-center gap-1.5"
          >
            <Clock className="h-3.5 w-3.5" />
            Progress Investigation
          </Link>
        )}
        {showFinalCta && (
          <Link
            href={`/municipal/reports/final${incidentQuery}`}
            className={`btn ${showProgressCta ? 'btn-secondary' : 'btn-primary'} text-sm py-1.5 px-3 inline-flex items-center gap-1.5`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Final Investigation
          </Link>
        )}
      </div>
      {hasProgressSubmitted && !showProgressCta && (
        <p className="mt-1.5 text-xs text-gray-500">Progress report pending review.</p>
      )}
    </div>
  );
}
