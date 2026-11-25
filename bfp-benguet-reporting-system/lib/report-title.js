// Display title for a report, with its type (Spot / Progress / Final Investigation Report, ...)
// shown underneath as the subtitle. Investigation reports take the title of their case
// (incident), so a case's Spot, Progress and Final reports all carry the same title: the place of
// the fire, e.g. "Purok 3, Brgy. Poblacion" (older cases without one: "Mercantile Fire").
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

export function getReportSubtitle(report) {
  const type = report?.reportType;
  return REPORT_TYPE_SUBTITLES[type] || (type || 'Report').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// Where the fire happened, e.g. "Purok 3, near the public market, Brgy. Poblacion".
export function getIncidentPlace(incident) {
  if (!incident) return '';
  const barangay = incident.barangay ? `Brgy. ${incident.barangay.replace(/^(brgy\.?|barangay)\s+/i, '')}` : '';
  return [incident.address, barangay].filter(Boolean).join(', ');
}

export function getReportTitle(report) {
  const incident = report?.incident || {};

  // The title is the place of the fire (entered on the Spot report, shared by the whole case).
  const place = getIncidentPlace(incident);
  if (place) return place;

  // Cases filed before the location was asked for: the kind of fire, e.g. "Hotel Fire".
  // No date in the title; the date has its own column.
  const kind =
    incident.subCategory ||
    CATEGORY_LABELS[incident.generalCategory] ||
    CATEGORY_LABELS[report?.category] ||
    (report?.category ? report.category.replace(/_/g, ' ') : '');

  if (kind) return `${kind} Fire`;
  // Not tied to an incident (e.g. a Daily report).
  return 'Fire Incident';
}
