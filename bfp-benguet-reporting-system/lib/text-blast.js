// The Text Blast page (app/(dashboard)/municipal/reports/text-blast) is a small Word-like editor
// that starts with this template typed in. Its content is sent as `lines`: each line is a list of
// text runs, and each run says whether it's bold or blue — a structured format rather
// than HTML, so nothing an investigator types can be rendered as markup for the recipients.
//   lines: [[{ t: 'Fire Station: ' }, { t: 'La Trinidad', c: 'blue', b: true }], ...]
// (Highlighting was offered briefly; `h: true` runs from that time still display, but new blasts
// can't set it.)

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

export const TEXT_BLAST_TEMPLATE_LINES = TEXT_BLAST_TEMPLATE_LABELS.map((label) => [{ t: `${label}: ` }]);

// Shared by the editor, the notification list and the email so all three show the same colours.
export const TEXT_BLAST_BLUE = '#1d4ed8';
export const TEXT_BLAST_HIGHLIGHT = '#fef08a';

export const TEXT_BLAST_MAX_CHARACTERS = 4000;
export const TEXT_BLAST_MAX_LINES = 120;
const MAX_RUNS_PER_LINE = 60;

export const lineText = (line) => line.map((run) => run.t).join('');

// A template line nobody filled in ("Fire Station:" with nothing after it) means "not applicable".
export const isUnfilledTemplateLine = (line) => /^[^:]*:\s*$/.test(lineText(line));

// What counts toward TEXT_BLAST_MAX_CHARACTERS: only the lines that will actually be sent, so the
// page's counter starts near 0 instead of at the length of all the template labels.
export const sentCharacterCount = (lines) =>
  lines.reduce((total, line) => (isUnfilledTemplateLine(line) ? total : total + lineText(line).length), 0);

// Validates and normalises `lines` from the request. Returns null when the shape is wrong or the
// content to be sent is too long, so the API can reject it. Unfilled template lines and trailing blank lines
// are dropped; adjacent runs with the same formatting are merged.
export function cleanTextBlastLines(lines) {
  if (!Array.isArray(lines) || lines.length > TEXT_BLAST_MAX_LINES) return null;

  const cleaned = [];
  // A loose cap on everything received (unfilled template lines included), so an oversized
  // request is rejected before any further work; the real limit is checked on what's sent below.
  let receivedCharacters = 0;
  for (const line of lines) {
    if (!Array.isArray(line) || line.length > MAX_RUNS_PER_LINE) return null;
    const runs = [];
    for (const run of line) {
      const text = String(run?.t ?? '').replace(/[\r\n\t]+/g, ' ');
      if (!text) continue;
      const clean = {
        t: text,
        ...(run.b ? { b: true } : {}),
        ...(run.c === 'blue' ? { c: 'blue' } : {}),
      };
      const previous = runs[runs.length - 1];
      if (previous && !!previous.b === !!clean.b && previous.c === clean.c) {
        previous.t += clean.t;
      } else {
        runs.push(clean);
      }
      receivedCharacters += text.length;
    }
    if (receivedCharacters > TEXT_BLAST_MAX_CHARACTERS * 3) return null;
    if (runs.length && isUnfilledTemplateLine(runs)) continue;
    cleaned.push(runs);
  }

  while (cleaned.length && !lineText(cleaned[cleaned.length - 1]).trim()) cleaned.pop();
  while (cleaned.length && !lineText(cleaned[0]).trim()) cleaned.shift();
  if (sentCharacterCount(cleaned) > TEXT_BLAST_MAX_CHARACTERS) return null;
  return cleaned;
}

// Everything a stored text-blast payload has to show, as lines — also covers blasts sent before
// the editor existed: the field list from the earlier template version, and a plain `note`.
export function textBlastLinesFromPayload(payload) {
  const lines = Array.isArray(payload?.lines) ? [...payload.lines] : [];
  if (Array.isArray(payload?.fields)) {
    for (const field of payload.fields) {
      const style = { ...(field.style === 'blue' ? { c: 'blue' } : {}), ...(field.style === 'highlight' ? { h: true } : {}) };
      lines.push([{ t: `${field.label}: `, b: true, ...style }, { t: String(field.value ?? ''), ...style }]);
    }
  }
  if (payload?.note) {
    for (const text of String(payload.note).split('\n')) lines.push([{ t: text }]);
  }
  return lines;
}
