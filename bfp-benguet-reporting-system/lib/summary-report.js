// Fire Incident Summary Report (provincial dashboard, one click): a PDF of the selected period's
// statistics — incidents per municipality by fire classification, injuries, fatalities and
// rescue operations, the sub-category breakdown, and the causes of fire. Built in the browser from
// the monitoring board (counts) and the casualty board endpoint (casualties, rescues, causes).

const FIELDS = [
  ['residential', 'Residential'],
  ['nonResidential', 'Non-Residential'],
  ['nonStructural', 'Non-Structural'],
  ['transport', 'Transport'],
];

const NAVY = [26, 43, 74];

export async function downloadFireIncidentSummaryReport({ periodLabel, boardRows, boardTotals, subCategoryTotals, casualty }) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();

  const casualtyByMunicipality = new Map((casualty?.rows || []).map((row) => [row.municipality, row]));
  const ct = casualty?.totals || {};

  // Header
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageWidth, 22, 'F');
  doc.setTextColor(255);
  doc.setFontSize(15);
  doc.text('Fire Incident Summary Report', 14, 14);
  doc.setFontSize(9);
  doc.text('Bureau of Fire Protection - Benguet Provincial Office', pageWidth - 14, 14, { align: 'right' });
  doc.setTextColor(40);
  doc.setFontSize(11);
  doc.text(`Period: ${periodLabel}`, 14, 31);
  doc.setFontSize(8);
  doc.setTextColor(110);
  doc.text(`Generated ${new Date().toLocaleString('en-PH')} by FireTrack`, 14, 36);

  // Key figures
  const figures = [
    ['Total incidents', boardTotals?.total || 0],
    ['Injured', ct.injured || 0],
    ['Fatalities', ct.fatalities || 0],
    ['Rescue operations', ct.rescueOperations || 0],
  ];
  const boxWidth = (pageWidth - 28 - 3 * 4) / 4;
  figures.forEach(([label, value], index) => {
    const x = 14 + index * (boxWidth + 4);
    doc.setDrawColor(220);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, 40, boxWidth, 16, 2, 2, 'FD');
    doc.setTextColor(110);
    doc.setFontSize(8);
    doc.text(label.toUpperCase(), x + 4, 46);
    doc.setTextColor(20);
    doc.setFontSize(13);
    doc.text(String(value), x + 4, 53);
  });

  // 1. By municipality
  doc.setTextColor(20);
  doc.setFontSize(11);
  doc.text('1. Incidents, casualties and rescue operations by municipality', 14, 65);
  autoTable(doc, {
    startY: 68,
    head: [['Municipality', ...FIELDS.map(([, label]) => label), 'Total', 'Injured', 'Fatalities', 'Rescue Ops']],
    body: [
      ...boardRows.map((row) => {
        const c = casualtyByMunicipality.get(row.municipality) || {};
        return [row.municipality, ...FIELDS.map(([field]) => row[field] || 0), row.total || 0, c.injured || 0, c.fatalities || 0, c.rescueOperations || 0];
      }),
      ['TOTAL', ...FIELDS.map(([field]) => boardTotals?.[field] || 0), boardTotals?.total || 0, ct.injured || 0, ct.fatalities || 0, ct.rescueOperations || 0],
    ],
    headStyles: { fillColor: NAVY },
    styles: { fontSize: 8.5 },
    columnStyles: { 0: { fontStyle: 'bold' } },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index === boardRows.length) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [235, 239, 245];
      }
    },
  });

  // 2. By classification and sub-category
  const subRows = FIELDS.flatMap(([field, label]) => {
    const subs = Object.entries(subCategoryTotals?.[field] || {}).sort((a, b) => b[1] - a[1]);
    if (!subs.length) return [[label, '(no sub-category recorded)', boardTotals?.[field] || 0]];
    return subs.map(([sub, count], i) => [i === 0 ? label : '', sub, count]);
  });
  let y = doc.lastAutoTable.finalY + 10;
  if (y > doc.internal.pageSize.getHeight() - 40) {
    doc.addPage();
    y = 18;
  }
  doc.setFontSize(11);
  doc.text('2. Incidents by fire classification and sub-category', 14, y);
  autoTable(doc, {
    startY: y + 3,
    head: [['Classification', 'Sub-category', 'Incidents']],
    body: subRows,
    headStyles: { fillColor: NAVY },
    styles: { fontSize: 8.5 },
    tableWidth: (pageWidth - 28) / 2 - 4,
    margin: { left: 14 },
  });
  const afterSubs = doc.lastAutoTable.finalY;

  // 3. Causes of fire (beside the sub-category table)
  const causes = casualty?.causes || [];
  doc.setFontSize(11);
  doc.text('3. Causes of fire (Final Investigation Reports)', pageWidth / 2 + 4, y);
  autoTable(doc, {
    startY: y + 3,
    head: [['Cause of fire', 'Incidents']],
    body: causes.length ? causes.map((c) => [c.cause, c.count]) : [['No cause recorded yet for this period', '']],
    headStyles: { fillColor: NAVY },
    styles: { fontSize: 8.5 },
    tableWidth: (pageWidth - 28) / 2 - 4,
    margin: { left: pageWidth / 2 + 4 },
  });

  const noteY = Math.max(afterSubs, doc.lastAutoTable.finalY) + 8;
  if (noteY < doc.internal.pageSize.getHeight() - 10) {
    doc.setFontSize(7.5);
    doc.setTextColor(120);
    doc.text(
      'Incident counts follow the Fire Incident Monitoring Board for the period. Casualties, rescue operations and causes cover cases whose Spot report has final approval.',
      14,
      noteY
    );
  }

  doc.save(`fire-incident-summary-report-${periodLabel.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`);
}
