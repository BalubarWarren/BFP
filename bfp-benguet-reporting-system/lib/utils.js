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

// Safely parses a value that may already be an array/object (already deserialized), a JSON
// string, or null/undefined — used for the JSON-serialized attachments/content fields the API
// returns. Previously reimplemented independently in several page components.
export function parseJsonField(value, fallback = []) {
  if (!value) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

// Only 401 means the login itself is no longer valid. A 403 means "signed in, but not allowed to
// do this" — treating it as an ended session told users to log out and back in, which never
// helped (the same account gets the same 403 again).
export function isAuthError(err) {
  return err?.response?.status === 401;
}

export function getStatusColor(status) {
  const colors = {
    DRAFT: 'bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-500/15',
    SUBMITTED: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20',
    APPROVED: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20',
    RETURNED: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20',
    PENDING: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20',
    ONGOING: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20',
    CONTROLLED: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20',
    EXTINGUISHED: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20',
  };
  return colors[status] || 'bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-500/15';
}
