// Client-side report search shared by every report list (municipal, reviewer, provincial, admin,
// archive). Works on the list payload of GET /api/reports, which carries the incident's date,
// location and classification for exactly this purpose.

export const EMPTY_REPORT_FILTERS = {
  query: '',
  incidentDate: '',
  location: '',
  classification: '',
  status: '',
};

export const CLASSIFICATION_OPTIONS = [
  { value: 'RESIDENTIAL', label: 'Residential' },
  { value: 'NON_RESIDENTIAL', label: 'Non-Residential' },
  { value: 'NON_STRUCTURAL', label: 'Non-Structural' },
  { value: 'TRANSPORT', label: 'Transport' },
];

export const STATUS_OPTIONS = [
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'RETURNED', label: 'Returned' },
  { value: 'DRAFT', label: 'Draft' },
];

export const hasActiveFilters = (filters) =>
  Object.keys(EMPTY_REPORT_FILTERS).some((key) => filters?.[key]);

// A scanned report QR code is a link to /verify/<token>; accept that link or the bare token.
export const extractQrToken = (input) => {
  const value = String(input || '').trim();
  const match = value.match(/\/verify\/([^/?#\s]+)/);
  return match ? decodeURIComponent(match[1]) : value;
};

// YYYY-MM-DD in Philippine time, to compare against an <input type="date"> value.
const toManilaDay = (date) => {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
};

const includes = (value, needle) => String(value || '').toLowerCase().includes(needle);

export function matchesReportFilters(report, filters) {
  if (!filters) return true;
  const { query, incidentDate, location, classification, status } = filters;

  if (query) {
    const needle = query.trim().toLowerCase();
    const idNeedle = needle.replace(/^#/, '');
    const qrToken = extractQrToken(query).toLowerCase();
    const matched =
      includes(report.incident?.referenceNumber, needle) ||
      String(report.id) === idNeedle ||
      (report.qrToken && qrToken && report.qrToken.toLowerCase() === qrToken) ||
      includes(report.municipality?.name, needle) ||
      includes(report.submittedBy?.name, needle) ||
      includes(report.reportType?.replace(/_/g, ' '), needle);
    if (!matched) return false;
  }

  if (incidentDate) {
    const day = toManilaDay(report.incident?.dateOfIncident) || toManilaDay(report.reportDate);
    if (day !== incidentDate) return false;
  }

  if (location) {
    const needle = location.trim().toLowerCase();
    const matched =
      includes(report.municipality?.name, needle) ||
      includes(report.incident?.barangay, needle) ||
      includes(report.incident?.address, needle);
    if (!matched) return false;
  }

  if (classification) {
    const category = report.category || report.incident?.generalCategory;
    if (category !== classification) return false;
  }

  if (status && report.status !== status) return false;

  return true;
}
