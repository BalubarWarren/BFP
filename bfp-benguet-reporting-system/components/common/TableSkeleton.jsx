'use client';

// Generic shimmering placeholder for a table/list that's still loading — swapped in for a
// plain "Loading..." string so the layout doesn't jump once real rows arrive.
export default function TableSkeleton({ rows = 5, columns = 5 }) {
  return (
    <div className="animate-pulse divide-y divide-gray-100" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-5 py-4">
          {Array.from({ length: columns }).map((_, c) => (
            <div
              key={c}
              className="h-4 rounded bg-gray-200"
              style={{ width: c === 0 ? '18%' : `${72 / (columns - 1)}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
