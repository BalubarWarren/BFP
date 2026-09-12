'use client';

import { getStatusColor } from '../../lib/utils';

export default function StatusBadge({ status, className = '' }) {
  const colorClass = getStatusColor(status);
  const pulseClass = status === 'SUBMITTED' ? 'badge-pulse' : '';

  return (
    <span className={`badge ${colorClass} ${pulseClass} ${className}`}>
      {status}
    </span>
  );
}
