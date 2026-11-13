'use client';

const ACCENTS = {
  red: 'bg-red-50 text-bfp-red dark:bg-red-950/40 dark:text-red-400',
  green: 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  navy: 'bg-blue-50 text-bfp-navy dark:bg-blue-950/40 dark:text-blue-300',
};

// Tremor-style KPI tile: muted label, large tabular number, icon chip, optional caption.
export default function StatCard({ icon: Icon, label, value, caption, accent = 'navy', valueClassName = '' }) {
  return (
    <div className="card card-hover-lift p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        {Icon && (
          <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md ${ACCENTS[accent] || ACCENTS.navy}`}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className={`mt-2 truncate font-semibold tabular-nums tracking-tight text-gray-900 dark:text-white ${valueClassName || 'text-3xl'}`}>
        {value}
      </p>
      {caption && <p className="mt-1 text-xs text-gray-500">{caption}</p>}
    </div>
  );
}
