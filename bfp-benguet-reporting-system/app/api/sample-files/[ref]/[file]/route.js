import { NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import { SAMPLE_REF_PREFIX } from '../../../../../lib/sample-data';
import { buildSamplePdf } from '../../../../../lib/sample-pdf';
import { getIncidentPlace } from '../../../../../lib/report-title';

// The attached PDF of a sample report (lib/sample-data.js), generated on the fly from the sample
// case's own details so each file matches its report. Only ever serves SAMPLE- cases, which are
// fabricated test data — never real records. Public like a storage URL, because the PDF viewer
// loads attachments without the session token.
const FILES = {
  'spot.pdf': { type: 'SPOT_INVESTIGATION', title: 'Spot Investigation Report' },
  'progress.pdf': { type: 'PROGRESS_INVESTIGATION', title: 'Progress Investigation Report' },
  'final.pdf': { type: 'FINAL_INVESTIGATION', title: 'Final Investigation Report' },
  'ems.pdf': { type: 'SPOT_INVESTIGATION', title: 'Emergency Medical Services Report' },
};

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }) : '-');
const label = (v) => String(v || '-').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export async function GET(request, { params }) {
  const ref = decodeURIComponent(params.ref || '');
  const spec = FILES[params.file];
  if (!ref.startsWith(SAMPLE_REF_PREFIX) || !spec) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const incident = await prisma.incident.findUnique({
    where: { referenceNumber: ref },
    include: {
      municipality: { select: { name: true } },
      reports: {
        where: { reportType: spec.type },
        select: { id: true, reportDate: true, respondingUnits: true, respondingOfficer: true, reportingOfficerRank: true, stationCommanderName: true, submittedBy: { select: { name: true } } },
        take: 1,
      },
    },
  });
  const report = incident?.reports?.[0];
  if (!incident || !report) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const place = `${getIncidentPlace(incident)}, ${incident.municipality.name}, Benguet`;
  const casualties = `${incident.casualtiesInjured} injured, ${incident.casualtiesFatalities} ${incident.casualtiesFatalities === 1 ? 'fatality' : 'fatalities'}`;
  const common = [
    { label: 'Reference No.', value: incident.referenceNumber },
    { label: 'Report No.', value: `#${report.id}` },
    { label: 'Report date', value: fmtDate(report.reportDate) },
    { label: 'Place of incident', value: place },
    { label: 'Date / time of fire', value: `${fmtDate(incident.dateOfIncident)}, ${incident.timeOfIncident || '-'}` },
    { label: 'Classification', value: `${label(incident.generalCategory)} - ${incident.subCategory || '-'}` },
  ];

  let blocks;
  if (params.file === 'ems.pdf') {
    blocks = [
      ...common,
      { heading: 'Patients' },
      { label: 'Casualties', value: casualties },
      { paragraph: `Emergency medical responders attended to ${incident.casualtiesInjured} injured person(s) at the scene and transported them to the nearest hospital for treatment.${incident.casualtiesFatalities ? ` ${incident.casualtiesFatalities} person(s) were declared dead on arrival.` : ''}` },
    ];
  } else {
    blocks = [
      ...common,
      { label: 'Casualties', value: casualties },
      { label: 'Estimated damage', value: incident.estimatedDamage ? `PHP ${Number(incident.estimatedDamage).toLocaleString('en-US')}` : '-' },
      { heading: 'Narrative' },
      { paragraph: incident.description || '-' },
      ...(spec.type === 'PROGRESS_INVESTIGATION'
        ? [{ paragraph: 'Follow-up interviews with witnesses and the property owner were conducted. Physical evidence was collected from the area of origin and is pending laboratory examination.' }]
        : []),
      ...(spec.type === 'FINAL_INVESTIGATION'
        ? [
            { heading: 'Findings' },
            { label: 'Cause of fire', value: incident.causeOfFire || 'Undetermined' },
            { paragraph: 'Based on the examination of the burn patterns, witness statements and the evidence gathered, the investigation is closed with the cause stated above.' },
          ]
        : []),
      { heading: 'Responding personnel' },
      { label: 'Responding units', value: report.respondingUnits },
      { label: 'Reporting officer', value: `${report.reportingOfficerRank || ''} ${report.respondingOfficer || ''}`.trim() },
      { label: 'Chief in charge', value: report.stationCommanderName },
      { label: 'Submitted by', value: report.submittedBy?.name },
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
