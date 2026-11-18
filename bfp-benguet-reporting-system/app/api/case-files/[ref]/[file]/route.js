import { NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import { buildSamplePdf } from '../../../../../lib/sample-pdf';
import { getIncidentPlace } from '../../../../../lib/report-title';
import { parseJsonField } from '../../../../../lib/utils';

// The attached PDF of a demonstration report (scripts/demo-data/demo-seed.sql), generated on the
// fly from the case's own details so each file matches its report. Only serves reports flagged
// `"demo": true` in their content — fabricated test data, never real records. Public like a
// storage URL, because the PDF viewer loads attachments without the session token.
//
// Row order is fixed (see lib/sample-pdf.js FIRST_ROW_Y / ROW_STEP) so the demo annotations can
// highlight known lines: 0 Reference, 1 Report No., 2 Report date, 3 Place, 4 Date/time,
// 5 Classification, 6 Casualties, 7 Rescue operations, 8 Estimated damage, 9 Cause (Final).
const FILES = {
  'spot.pdf': { type: 'SPOT_INVESTIGATION', title: 'Spot Investigation Report' },
  'progress.pdf': { type: 'PROGRESS_INVESTIGATION', title: 'Progress Investigation Report' },
  'final.pdf': { type: 'FINAL_INVESTIGATION', title: 'Final Investigation Report' },
  'ems.pdf': { type: 'SPOT_INVESTIGATION', title: 'Emergency Medical Services Report' },
  'certificate.pdf': { type: 'FINAL_INVESTIGATION', title: 'Fire Incident Certificate' },
  'laboratory.pdf': { type: 'PROGRESS_INVESTIGATION', title: 'Laboratory Examination Result' },
  // The Letter of Order behind a demo co-investigator request (any report of the case).
  'letter-of-order.pdf': { type: null, title: 'Letter of Order' },
};

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }) : '-');
const label = (v) => String(v || '-').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const peso = (v) => (v != null ? `PHP ${Number(v).toLocaleString('en-US')}` : '-');

export async function GET(request, { params }) {
  const ref = decodeURIComponent(params.ref || '');
  const spec = FILES[params.file];
  if (!spec) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const incident = await prisma.incident.findUnique({
    where: { referenceNumber: ref },
    include: {
      municipality: { select: { name: true } },
      reports: {
        // Written by the app as "demo":true, by Postgres (the seed script) as "demo": true.
        where: { OR: [{ content: { contains: '"demo":true' } }, { content: { contains: '"demo": true' } }] },
        select: {
          id: true,
          reportType: true,
          reportDate: true,
          content: true,
          respondingUnits: true,
          respondingOfficer: true,
          reportingOfficerRank: true,
          stationCommanderName: true,
          submittedBy: { select: { name: true } },
        },
        orderBy: { id: 'asc' },
      },
    },
  });
  const report = spec.type ? incident?.reports?.find((r) => r.reportType === spec.type) : incident?.reports?.[0];
  if (!incident || !report) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const spot = incident.reports.find((r) => r.reportType === 'SPOT_INVESTIGATION');
  const spotContent = parseJsonField(spot?.content, {});
  const content = parseJsonField(report.content, {});
  const rescues = content.rescueOperations ?? spotContent.rescueOperations ?? 0;
  const place = `${getIncidentPlace(incident)}, ${incident.municipality.name}`;
  const casualties = `${incident.casualtiesInjured} injured, ${incident.casualtiesFatalities} ${incident.casualtiesFatalities === 1 ? 'fatality' : 'fatalities'}`;
  const officer = `${report.reportingOfficerRank || ''} ${report.respondingOfficer || ''}`.trim() || report.submittedBy?.name;

  const rows = [
    { label: 'Reference No.', value: incident.referenceNumber },
    { label: 'Report No.', value: `#${report.id}` },
    { label: 'Report date', value: fmtDate(report.reportDate) },
    { label: 'Place of incident', value: place },
    { label: 'Date / time of fire', value: `${fmtDate(incident.dateOfIncident)}, ${incident.timeOfIncident || '-'}H` },
    { label: 'Classification', value: `${label(incident.generalCategory)} - ${incident.subCategory || '-'}` },
    { label: 'Casualties', value: casualties },
    { label: 'Rescue operations', value: String(rescues) },
    { label: 'Estimated damage', value: peso(incident.estimatedDamage) },
  ];

  let blocks;
  if (params.file === 'ems.pdf') {
    blocks = [
      ...rows,
      { heading: 'Patient care' },
      {
        paragraph: `Emergency medical responders attended to ${incident.casualtiesInjured} injured person(s) at the scene and transported them to the nearest hospital for treatment.${incident.casualtiesFatalities ? ` ${incident.casualtiesFatalities} person(s) were declared dead on arrival.` : ''}`,
      },
    ];
  } else if (params.file === 'certificate.pdf') {
    blocks = [
      ...rows,
      { heading: 'Certification' },
      {
        paragraph: `This is to certify that a fire incident occurred at ${place} on ${fmtDate(incident.dateOfIncident)}. Based on the investigation conducted, the cause of the fire was determined to be: ${incident.causeOfFire || 'undetermined'}. This certification is issued upon request of the property owner for whatever legal purpose it may serve.`,
      },
      { label: 'Owner', value: spotContent.ownerName || '-' },
    ];
  } else if (params.file === 'letter-of-order.pdf') {
    const order = await prisma.reportRequest
      .findFirst({
        where: { type: 'COLLABORATOR', report: { incidentId: incident.id } },
        include: { targetUser: { select: { name: true, rank: true } }, requestedBy: { select: { name: true } } },
        orderBy: { id: 'desc' },
      })
      .catch(() => null);
    const marshal = report.stationCommanderName || 'Municipal Fire Marshal';
    const assignee = order?.targetUser ? `${order.targetUser.rank ? `${order.targetUser.rank} ` : ''}${order.targetUser.name}` : 'the designated investigator';
    blocks = [
      { label: 'Reference No.', value: incident.referenceNumber },
      { label: 'Date issued', value: fmtDate(order?.createdAt || new Date()) },
      { label: 'Subject', value: 'Designation as co-investigator' },
      { heading: 'Order' },
      {
        paragraph: `${assignee} is hereby designated to assist ${order?.requestedBy?.name || 'the investigator on case'} in the investigation of the fire incident at ${place} on ${fmtDate(incident.dateOfIncident)}, including the preparation and revision of its investigation reports, subject to the approval of the Municipal Chief, Intelligence and Investigation Section.`,
      },
      { paragraph: 'This order takes effect immediately and remains in force until the case is closed or the order is revoked.' },
      { label: 'Issued by', value: marshal },
    ];
  } else if (params.file === 'laboratory.pdf') {
    blocks = [
      ...rows,
      { heading: 'Specimens examined' },
      { paragraph: 'Fire debris samples and electrical wire remnants recovered from the area of origin were submitted for examination. Results are summarized below and support the findings of the investigation.' },
      { label: 'Fire debris', value: 'Negative for ignitable liquid residue' },
      { label: 'Electrical remnants', value: /electric|overload/i.test(incident.causeOfFire || '') ? 'Arc beads present - consistent with electrical fault' : 'No arc beads observed' },
    ];
  } else {
    blocks = [
      ...rows,
      ...(spec.type === 'FINAL_INVESTIGATION' ? [{ label: 'Cause of fire', value: incident.causeOfFire || 'Undetermined' }] : []),
      ...(spotContent.propertyType ? [{ label: 'Property type', value: spotContent.propertyType }] : []),
      ...(spotContent.establishmentName ? [{ label: 'Establishment', value: spotContent.establishmentName }] : []),
      ...(spotContent.ownerName ? [{ label: 'Owner', value: spotContent.ownerName }] : []),
      ...(spotContent.numberOfStoreys ? [{ label: 'Number of storeys', value: String(spotContent.numberOfStoreys) }] : []),
      { heading: 'Narrative' },
      { paragraph: incident.description || '-' },
      ...(spec.type === 'PROGRESS_INVESTIGATION'
        ? [{ paragraph: 'Follow-up interviews with witnesses and the property owner were conducted. Physical evidence recovered from the area of origin was submitted for laboratory examination.' }]
        : []),
      ...(spec.type === 'FINAL_INVESTIGATION'
        ? [{ paragraph: 'Based on the examination of burn patterns, witness statements and the evidence gathered, the investigation is closed with the cause stated above.' }]
        : []),
      ...(content.lateExplanation ? [{ heading: 'Explanation for late submission' }, { paragraph: content.lateExplanation }] : []),
      { heading: 'Responding personnel' },
      { label: 'Responding units', value: report.respondingUnits },
      { label: 'Reporting officer', value: officer },
      { label: 'Chief in charge', value: report.stationCommanderName },
    ];
  }

  const pdf = buildSamplePdf({ title: spec.title, subtitle: `${incident.municipality.name} Fire Station`, blocks });
  return new NextResponse(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${spec.title.replace(/\s+/g, '-')}-${ref}.pdf"`,
      'Cache-Control': 'private, max-age=300',
    },
  });
}
