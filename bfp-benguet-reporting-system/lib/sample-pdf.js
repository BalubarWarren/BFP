// A tiny, dependency-free PDF writer for the demonstration reports' attached files: one A4 page
// of Helvetica text (agency line, title, label/value rows and paragraphs) plus a small footer
// marking it as a demonstration record. Enough for the PDF viewer/annotator to open, read and
// highlight like a real report.
//
// Layout is fixed so annotations can point at known lines (scripts/demo-data): page 595 x 842
// points, the first label row's baseline at y = FIRST_ROW_Y (from the bottom) and each one-line
// row ROW_STEP below the previous one.

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 56;
export const FIRST_ROW_Y = 704;
export const ROW_STEP = 15;
const LABEL_WIDTH = 118;

// Helvetica is a WinAnsi font: keep text to printable ASCII and escape PDF string syntax.
const clean = (text) =>
  String(text ?? '')
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/ñ/g, 'n')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');

// Rough word wrap by character count (Helvetica averages ~0.5em per character).
function wrap(text, size, width = PAGE_WIDTH - MARGIN * 2, avgEm = 0.5) {
  const maxChars = Math.max(10, Math.floor(width / (size * avgEm)));
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    if ((line ? `${line} ${word}` : word).length > maxChars) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

// blocks: [{ heading }, { label, value }, { paragraph }, { spacer }]
export function buildSamplePdf({ title, subtitle, blocks = [], footer = 'FireTrack - demonstration record for system testing' }) {
  const ops = [];
  let y = PAGE_HEIGHT - MARGIN;

  const text = (str, x, size, bold = false) => {
    ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x} ${y} Td (${clean(str)}) Tj ET`);
  };

  // Agency line and title
  ops.push('0.1 0.17 0.29 rg');
  text('BUREAU OF FIRE PROTECTION - BENGUET PROVINCIAL OFFICE', MARGIN, 9, true);
  y -= 24;
  text(title, MARGIN, 18, true);
  y -= 22;
  ops.push('0.35 0.4 0.47 rg');
  text(subtitle || '', MARGIN, 11);
  y -= 14;
  ops.push('0.8 0.0 0.0 RG');
  ops.push('1.2 w');
  ops.push(`${MARGIN} ${y} m ${PAGE_WIDTH - MARGIN} ${y} l S`);
  ops.push('0 0 0 rg');
  y -= 22; // = FIRST_ROW_Y

  for (const block of blocks) {
    if (y < MARGIN + 30) break;
    if (block.spacer) {
      y -= 8;
    } else if (block.heading) {
      y -= 6;
      ops.push('0.1 0.17 0.29 rg');
      text(block.heading.toUpperCase(), MARGIN, 10, true);
      ops.push('0 0 0 rg');
      y -= 16;
    } else if (block.label) {
      text(`${block.label}:`, MARGIN, 10, true);
      // Values sit in a wide column so one-line rows stay one line (annotations rely on it).
      const lines = wrap(block.value ?? '-', 10, PAGE_WIDTH - MARGIN * 2 - LABEL_WIDTH, 0.47);
      lines.forEach((line, i) => {
        text(line, MARGIN + LABEL_WIDTH, 10);
        if (i < lines.length - 1) y -= 13;
      });
      y -= ROW_STEP;
    } else if (block.paragraph) {
      for (const line of wrap(block.paragraph, 10)) {
        if (y < MARGIN + 30) break;
        text(line, MARGIN, 10);
        y -= 13;
      }
      y -= 6;
    }
  }

  // Footer
  ops.push('0.85 0.87 0.9 RG');
  ops.push('0.6 w');
  ops.push(`${MARGIN} 48 m ${PAGE_WIDTH - MARGIN} 48 l S`);
  ops.push('0.5 0.55 0.6 rg');
  y = 36;
  text(footer, MARGIN, 7.5);

  const content = ops.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}
