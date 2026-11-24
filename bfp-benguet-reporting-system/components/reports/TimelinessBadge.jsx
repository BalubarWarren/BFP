import { Clock, CheckCircle2, AlertCircle } from 'lucide-react';

// Red / green timeliness indicator for a report row (computed server-side in GET /api/reports,
// see lib/report-timeliness.js): green "On time" or red "Delayed · 3 days" for when it was
// submitted, and for a finalized Spot/Progress report, an amber flag while its next report is due
// (7-15 / 30-45 day period) and a red one, with the days, once that report is delayed.
// Shown as plain colored text (no box/background).
export default function TimelinessBadge({ report, className = '' }) {
  const timeliness = report?.timeliness;
  const followUp = report?.followUpDelay;
  if (!timeliness && !followUp) return null;

  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 ${className}`}>
      {timeliness?.status === 'ON_TIME' && (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300" title={timeliness.detail}>
          <CheckCircle2 className="h-3 w-3" /> On time
        </span>
      )}
      {timeliness?.status === 'DELAYED' && (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 dark:text-red-300" title={timeliness.detail}>
          <AlertCircle className="h-3 w-3" /> Delayed{timeliness.late ? ` · ${timeliness.late}` : ''}
        </span>
      )}
      {followUp && (
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
            followUp.level === 'due' ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300'
          }`}
          title={followUp.detail}
        >
          <Clock className="h-3 w-3" /> {followUp.label}
        </span>
      )}
    </div>
  );
}
