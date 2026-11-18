import { AlertTriangle, Building2 } from 'lucide-react';
import { parseJsonField } from '../../lib/utils';
import { getIncidentDetailRows } from '../../lib/incident-details';

// Shared block for every report window: the Explanation Report for a late submission, the
// property involved (establishment, owner, occupant, storeys...), rescue operations and cause of
// fire — all recorded on the Spot/Final forms.
export default function ReportExtras({ report }) {
  if (!report) return null;
  const content = parseJsonField(report.content, {});
  const rows = getIncidentDetailRows(content);
  const cause = report.incident?.causeOfFire || content.causeOfFire;

  if (!content.lateExplanation && !rows.length && !cause) return null;

  return (
    <div className="space-y-3">
      {content.lateExplanation && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10">
          <p className="flex items-center gap-2 text-sm font-semibold text-red-800 dark:text-red-200">
            <AlertTriangle className="h-4 w-4" /> Submitted late · Explanation Report
          </p>
          <p className="mt-1 whitespace-pre-line text-sm text-red-700 dark:text-red-300">{content.lateExplanation}</p>
        </div>
      )}

      {(rows.length > 0 || cause) && (
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Building2 className="h-4 w-4 text-gray-400" /> Property Involved
          </p>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {cause && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-gray-500">Cause of fire</dt>
                <dd className="font-semibold text-gray-900">{cause}</dd>
              </div>
            )}
            {rows.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-gray-500">{label}</dt>
                <dd className="font-semibold text-gray-900">{String(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
