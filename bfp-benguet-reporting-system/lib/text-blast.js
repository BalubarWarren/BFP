// The fill-in template on the Text Blast page (app/(dashboard)/municipal/reports/text-blast) and
// the rules POST /api/reports/text-blast applies to it. Each field is a label, the value the
// investigator typed, and a style that recipients see in the notification and the email.

export const TEXT_BLAST_TEMPLATE_LABELS = [
  'Fire Station',
  'Occurrence',
  'Date & Time Reported (DTR)',
  'Date & Time Engine Dispatched (TED)',
  'Date & Time Arrived at Scene (DTAS)',
  'Response Time (RT)',
  'Distance to Incident Location',
  'Involved',
  'No. of Family/ies Affected',
  'No. of Individuals Affected',
  'No. of Structures Burned',
  'No. of Transport Burned',
  'Affected Estimated Floor Area (FA)',
  'Responders',
  'Operational Status',
  'Alarm Status',
  'Fire Under Control',
  'Fire Out',
  'Casualty',
  'Injured',
  'Fatality',
  'Incident Command Post',
  'Fire Arson Investigator',
  'FCOS',
];

export const TEXT_BLAST_STYLES = {
  NORMAL: 'normal',
  BLUE: 'blue',
  HIGHLIGHT: 'highlight',
};

export const TEXT_BLAST_NOTE_MAX_LENGTH = 1000;
export const TEXT_BLAST_MAX_FIELDS = 60;
export const TEXT_BLAST_LABEL_MAX_LENGTH = 80;
export const TEXT_BLAST_VALUE_MAX_LENGTH = 300;

const STYLE_VALUES = Object.values(TEXT_BLAST_STYLES);

// Keeps only filled-in fields (an empty line in the template just means "not applicable"),
// trimmed and capped, with an unknown style falling back to normal. Returns null if the input is
// unusable (not an array, or too many fields) so the API can reject it.
export function cleanTextBlastFields(fields) {
  if (fields === undefined || fields === null) return [];
  if (!Array.isArray(fields) || fields.length > TEXT_BLAST_MAX_FIELDS) return null;
  return fields
    .map((field) => ({
      label: String(field?.label || '').trim().slice(0, TEXT_BLAST_LABEL_MAX_LENGTH),
      value: String(field?.value || '').trim().slice(0, TEXT_BLAST_VALUE_MAX_LENGTH),
      style: STYLE_VALUES.includes(field?.style) ? field.style : TEXT_BLAST_STYLES.NORMAL,
    }))
    .filter((field) => field.label && field.value);
}
