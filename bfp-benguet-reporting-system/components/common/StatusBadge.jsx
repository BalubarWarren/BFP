'use client';

// Plain colored text with a dot — no box/background.
const TEXT_COLORS = {
  DRAFT: 'text-gray-600 dark:text-gray-300',
  SUBMITTED: 'text-amber-700 dark:text-amber-300',
  PENDING: 'text-amber-700 dark:text-amber-300',
  CONTROLLED: 'text-amber-700 dark:text-amber-300',
  APPROVED: 'text-green-700 dark:text-green-300',
  EXTINGUISHED: 'text-green-700 dark:text-green-300',
  RETURNED: 'text-red-700 dark:text-red-300',
  ONGOING: 'text-orange-700 dark:text-orange-300',
};

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
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold ${TEXT_COLORS[status] || 'text-gray-600 dark:text-gray-300'} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_COLORS[status] || 'bg-gray-400'}`} aria-hidden="true" />
      {formatStatus(status)}
    </span>
  );
}
