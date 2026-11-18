import { AlertTriangle, Building2, MapPin, ExternalLink } from 'lucide-react';
import { parseJsonField } from '../../lib/utils';
import { getIncidentDetailRows, hasGps } from '../../lib/incident-details';

// Shared block for every report window: the Explanation Report for a late submission, the
// property involved (establishment, owner, occupant, storeys...), rescue operations, cause of fire
// and the GPS location — all recorded on the Spot/Final forms.
export default function ReportExtras({ report }) {
  if (!report) return null;
  const content = parseJsonField(report.content, {});
  const rows = getIncidentDetailRows(content);
  const cause = report.incident?.causeOfFire || content.causeOfFire;
  const gps = hasGps(content) ? { lat: Number(content.latitude), lng: Number(content.longitude) } : null;

  if (!content.lateExplanation && !rows.length && !cause && !gps) return null;

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

      {(rows.length > 0 || cause || gps) && (
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Building2 className="h-4 w-4 text-gray-400" /> Property &amp; Location
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
            {gps && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-gray-500">GPS location</dt>
                <dd className="flex flex-wrap items-center gap-2 font-semibold text-gray-900">
                  <MapPin className="h-3.5 w-3.5 text-bfp-red" />
                  {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)}
                  <a
                    href={`https://www.google.com/maps?q=${gps.lat},${gps.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-bfp-navy hover:underline dark:text-blue-400"
                  >
                    Open map <ExternalLink className="h-3 w-3" />
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}
