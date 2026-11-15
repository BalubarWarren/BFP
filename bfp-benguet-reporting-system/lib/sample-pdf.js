// A tiny, dependency-free PDF writer for the sample reports' attached files: one A4 page of plain
// Helvetica text (a title, a "SAMPLE" banner, then label/value lines and paragraphs). Enough for
// the PDF viewer/annotator to open, read and highlight like a real report.

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 56;

// Helvetica is a WinAnsi font: keep text to printable ASCII and escape PDF string syntax.
const clean = (text) =>
  String(text ?? '')
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');

// Rough word wrap by character count (Helvetica averages ~0.5em per character).
function wrap(text, size, width = PAGE_WIDTH - MARGIN * 2) {
  const maxChars = Math.max(10, Math.floor(width / (size * 0.5)));
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
export function buildSamplePdf({ title, subtitle, blocks = [] }) {
  const ops = [];
  let y = PAGE_HEIGHT - MARGIN;

  const text = (str, x, size, bold = false) => {
    ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x} ${y} Td (${clean(str)}) Tj ET`);
  };

  // Banner
  ops.push('0.93 0.27 0.27 rg');
  ops.push(`${MARGIN} ${y - 6} ${PAGE_WIDTH - MARGIN * 2} 22 re f`);
  ops.push('1 1 1 rg');
  text('SAMPLE DATA - FOR TESTING ONLY - NOT AN OFFICIAL RECORD', MARGIN + 8, 10, true);
  ops.push('0 0 0 rg');
  y -= 40;

  text('BUREAU OF FIRE PROTECTION - BENGUET PROVINCIAL OFFICE', MARGIN, 9, true);
  y -= 26;
  for (const line of wrap(title, 18)) {
    text(line, MARGIN, 18, true);
    y -= 22;
  }
  if (subtitle) {
    text(subtitle, MARGIN, 11);
    y -= 14;
  }
  ops.push('0.75 0.75 0.75 RG');
  ops.push(`${MARGIN} ${y} m ${PAGE_WIDTH - MARGIN} ${y} l S`);
  y -= 22;

  for (const block of blocks) {
    if (y < MARGIN + 20) break;
    if (block.spacer) {
      y -= 8;
    } else if (block.heading) {
      y -= 6;
      text(block.heading.toUpperCase(), MARGIN, 10, true);
      y -= 16;
    } else if (block.label) {
      text(`${block.label}:`, MARGIN, 10, true);
      const lines = wrap(block.value ?? '-', 10, PAGE_WIDTH - MARGIN * 2 - 150);
      lines.forEach((line, i) => {
        text(line, MARGIN + 150, 10);
        if (i < lines.length - 1) y -= 13;
      });
      y -= 15;
    } else if (block.paragraph) {
      for (const line of wrap(block.paragraph, 10)) {
        if (y < MARGIN + 20) break;
        text(line, MARGIN, 10);
        y -= 13;
      }
      y -= 6;
    }
  }

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
