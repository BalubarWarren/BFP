import { DUTY_LABELS, DUTY_BADGE_CLASSES, DUTY, WEEKDAY_SHORT, formatDutyDate } from '../../lib/duty';

export default function DutyBadge({ status, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${DUTY_BADGE_CLASSES[status] || DUTY_BADGE_CLASSES.NO_SCHEDULE} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === DUTY.ON_DUTY ? 'bg-green-600' : 'bg-current opacity-60'}`} />
      {DUTY_LABELS[status] || status}
    </span>
  );
}

const DAY_CLASSES = {
  ON_DUTY: 'bg-green-700 text-white',
  OFF_DUTY: 'bg-gray-100 text-gray-600',
  ON_LEAVE: 'bg-amber-100 text-amber-800',
  UNAVAILABLE: 'bg-orange-100 text-orange-800',
  NO_SCHEDULE: 'bg-gray-100 text-gray-400',
};

// The coming days (from lib/duty.js's dutyCalendar) as small day chips — today first.
export function DutyWeek({ days }) {
  if (!days?.length) return null;
  return (
    <div className="flex flex-wrap gap-1" aria-label="Duty for the coming days">
      {days.map((day, index) => {
        const weekday = WEEKDAY_SHORT[new Date(`${day.date}T00:00:00Z`).getUTCDay()];
        return (
          <span
            key={day.date}
            title={`${formatDutyDate(day.date)}: ${DUTY_LABELS[day.status]}`}
            className={`flex w-9 flex-col items-center rounded-md py-0.5 text-[10px] font-semibold leading-tight ${DAY_CLASSES[day.status]} ${index === 0 ? 'ring-2 ring-bfp-navy/40' : ''}`}
          >
            <span>{index === 0 ? 'Today' : weekday}</span>
            <span className="text-[11px]">{Number(day.date.slice(8))}</span>
          </span>
        );
      })}
    </div>
  );
}
