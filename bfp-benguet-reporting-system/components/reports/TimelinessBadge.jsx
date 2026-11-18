import { Clock, CheckCircle2, AlertCircle } from 'lucide-react';

// Red / green timeliness indicator for a report row (computed server-side in GET /api/reports,
// see lib/report-timeliness.js): green "On time" or red "Delayed · 3 days" for when it was
// submitted, and for a finalized Spot/Progress report, an amber flag while its next report is due
// (7-15 / 30-45 day period) and a red one, with the days, once that report is delayed.
export default function TimelinessBadge({ report, className = '' }) {
  const timeliness = report?.timeliness;
  const followUp = report?.followUpDelay;
  if (!timeliness && !followUp) return null;

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {timeliness?.status === 'ON_TIME' && (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300"
          title={timeliness.detail}
        >
          <CheckCircle2 className="h-3 w-3" /> On time
        </span>
      )}
      {timeliness?.status === 'DELAYED' && (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-500/10 dark:text-red-300"
          title={timeliness.detail}
        >
          <AlertCircle className="h-3 w-3" /> Delayed{timeliness.late ? ` · ${timeliness.late}` : ''}
        </span>
      )}
      {followUp && (
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            followUp.level === 'due'
              ? 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/30 dark:bg-amber-500/10 dark:text-amber-300'
              : 'bg-red-600 text-white'
          }`}
          title={followUp.detail}
        >
          <Clock className="h-3 w-3" /> {followUp.label}
        </span>
      )}
    </div>
  );
}
