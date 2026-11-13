'use client';

import { getStatusColor } from '../../lib/utils';

const DOT_COLORS = {
  DRAFT: 'bg-gray-400',
  SUBMITTED: 'bg-amber-500',
  PENDING: 'bg-amber-500',
  CONTROLLED: 'bg-amber-500',
  APPROVED: 'bg-green-500',
  EXTINGUISHED: 'bg-green-500',
  RETURNED: 'bg-red-500',
  ONGOING: 'bg-orange-500',
};

// "SUBMITTED" -> "Submitted"
const formatStatus = (status) =>
  String(status || '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());

export default function StatusBadge({ status, className = '' }) {
  const colorClass = getStatusColor(status);
  const pulseClass = status === 'SUBMITTED' ? 'badge-pulse' : '';

  return (
    <span className={`badge ${colorClass} ${pulseClass} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_COLORS[status] || 'bg-gray-400'}`} aria-hidden="true" />
      {formatStatus(status)}
    </span>
  );
}
