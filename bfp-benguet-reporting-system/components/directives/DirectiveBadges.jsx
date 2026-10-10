'use client';

import { ASSIGNABLE_REPORT_TYPES } from '../../lib/constants';

const STATUS_STYLES = {
  PENDING: 'bg-bfp-amber/15 text-amber-800',
  ACKNOWLEDGED: 'bg-bfp-navy/10 text-bfp-navy',
  COMPLETED: 'bg-bfp-green/15 text-bfp-green',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

export function DirectiveStatusBadge({ status }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status] || STATUS_STYLES.CANCELLED}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

// "Assignment · Spot Investigation" or just "Message".
export function directiveTitle(directive) {
  if (directive.kind === 'ASSIGNMENT') {
    return `Assignment · ${ASSIGNABLE_REPORT_TYPES[directive.reportType]?.label || directive.reportType}`;
  }
  return 'Message';
}

export const isOverdue = (directive) =>
  !!directive.dueAt
  && ['PENDING', 'ACKNOWLEDGED'].includes(directive.status)
  && new Date(directive.dueAt).getTime() < Date.now();
