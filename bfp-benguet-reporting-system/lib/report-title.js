// Display title for a report, with its type (Spot / Progress / Final Investigation Report, ...)
// shown underneath as the subtitle. Investigation reports take the title of their case
// (incident), so a case's Spot, Progress and Final reports all carry the same title:
//   "Mercantile Fire — Brgy. Poblacion"  or  "Residential Fire — Nov 11, 2026"
const CATEGORY_LABELS = {
  RESIDENTIAL: 'Residential',
  NON_RESIDENTIAL: 'Non-Residential',
  NON_STRUCTURAL: 'Non-Structural',
  TRANSPORT: 'Transport',
};

const REPORT_TYPE_SUBTITLES = {
  SPOT_INVESTIGATION: 'Spot Investigation Report',
  PROGRESS_INVESTIGATION: 'Progress Investigation Report',
  FINAL_INVESTIGATION: 'Final Investigation Report',
  DAILY: 'Daily Report',
  MDFIR: 'MDFIR',
};

const formatDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
};

export function getReportSubtitle(report) {
  const type = report?.reportType;
  return REPORT_TYPE_SUBTITLES[type] || (type || 'Report').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getReportTitle(report) {
  const incident = report?.incident || {};
  const kind =
    incident.subCategory ||
    CATEGORY_LABELS[incident.generalCategory] ||
    CATEGORY_LABELS[report?.category] ||
    (report?.category ? report.category.replace(/_/g, ' ') : '');

  const where = incident.barangay ? `Brgy. ${incident.barangay}` : '';
  const when = formatDate(incident.dateOfIncident || report?.reportDate);

  if (kind) return `${kind} Fire — ${where || when || `Report #${report.id}`}`;
  // Not tied to an incident (e.g. a Daily report): name it by its date.
  return `${getReportSubtitle(report)}${when ? ` — ${when}` : ''}`;
}
