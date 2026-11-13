'use client';

import { Link2 } from 'lucide-react';
import { getLinkedCaseReports } from '../../lib/report-workflow';

// Under a report's reference number in the report tables: the other Spot/Progress/Final reports
// of the same case, each clickable to open it, so a case's reports read as one chain rather than
// unrelated rows.
export default function CaseLinks({ report, allReports, onOpen }) {
  const linked = getLinkedCaseReports(report, allReports);
  if (!linked.length) return null;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-gray-500">
      <Link2 className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
      <span className="sr-only">Linked reports:</span>
      {linked.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => onOpen?.(r)}
          className="rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-700 hover:bg-bfp-navy/10 hover:text-bfp-navy dark:hover:text-blue-300"
          title={`Open the ${r.shortLabel} report of this case`}
        >
          {r.shortLabel} #{r.id}
        </button>
      ))}
    </div>
  );
}
