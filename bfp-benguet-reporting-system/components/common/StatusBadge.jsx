'use client';

import { getStatusColor } from '@/lib/utils';

export default function StatusBadge({ status, className = '' }) {
  const colorClass = getStatusColor(status);

  return (
    <span className={`badge ${colorClass} ${className}`}>
      {status}
    </span>
  );
}
