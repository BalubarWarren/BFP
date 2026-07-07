export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatDateTime(date) {
  return new Date(date).toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  });
}

export function isAuthError(err) {
  const status = err?.response?.status;
  return status === 401 || status === 403;
}

export function getStatusColor(status) {
  const colors = {
    DRAFT: 'bg-gray-100 text-gray-800',
    SUBMITTED: 'bg-bfp-amber/20 text-amber-800',
    APPROVED: 'bg-bfp-green/15 text-bfp-green',
    RETURNED: 'bg-bfp-red/10 text-bfp-red',
    PENDING: 'bg-bfp-amber/20 text-amber-800',
    ONGOING: 'bg-orange-100 text-orange-800',
    CONTROLLED: 'bg-bfp-amber/20 text-amber-800',
    EXTINGUISHED: 'bg-bfp-green/15 text-bfp-green',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}
