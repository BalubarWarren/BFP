// One-off, additive test-data script for the "Next Report" follow-up button
// (Spot -> Progress/Final, Progress -> Final). Unlike db-seed.js, this does NOT wipe existing
// data — it just adds two fresh incidents with reports already sitting in the finally-approved
// state (reviewed by the Provincial Chief IIS, nothing left to forward), so the
// CaseFollowUpCta / getCaseFollowUp feature has something to render immediately.
//
// Run with: node lib/seed-followup-test.js
import prisma from './prisma.js';
import generateIncidentReference from './incident-reference.js';
import { GENERAL_CATEGORIES, INCIDENT_STATUS, REPORT_STATUS, REPORT_TYPES, ROLES } from './constants.js';

const sampleAttachment = JSON.stringify([
  {
    name: 'Test Follow-Up Report.pdf',
    type: 'application/pdf',
    size: 190000,
    url: '/uploads/reports/1782798103285-7336s65dm6-Classpin.pdf',
  },
]);

async function createFinallyApprovedReport({ reportType, municipality, incident, investigator, provincialChiefIIS, reportDate, remarks, content }) {
  return prisma.report.create({
    data: {
      reportType,
      status: REPORT_STATUS.APPROVED,
      municipalityId: municipality.id,
      incidentId: incident.id,
      reportDate: new Date(reportDate),
      content: JSON.stringify(content),
      respondingUnits: `${municipality.name} FS Engine 1`,
      respondingOfficer: 'FO2 Test Officer',
      reportingOfficerRank: 'Fire Officer II',
      stationCommanderName: 'SINSP Test Commander',
      remarks,
      // Finally approved: reviewed by the Provincial Chief IIS, nothing left to forward
      // (passedToRole/passedToId stay null) — this is exactly the state isFinallyApproved()
      // checks for in the dashboard pages.
      passedToRole: null,
      passedToId: null,
      submittedAt: new Date(reportDate),
      reviewedAt: new Date(),
      reviewedById: provincialChiefIIS.id,
      submittedById: investigator.id,
      attachments: sampleAttachment,
    },
  });
}

async function main() {
  const provincialChiefIIS = await prisma.user.findFirst({ where: { role: ROLES.PROVINCIAL_CHIEF_IIS } });
  if (!provincialChiefIIS) {
    throw new Error('No PROVINCIAL_CHIEF_IIS user found — run `npm run db:seed` first to create the base accounts.');
  }

  // Use the La Trinidad investigator so results show up under a familiar test login
  // (investigator.lt@bfp-benguet.gov.ph / investigator@123).
  const municipality = await prisma.municipality.findFirst({ where: { code: 'LT' } });
  const investigator = await prisma.user.findFirst({ where: { role: ROLES.INVESTIGATOR, municipalityId: municipality.id } });
  if (!investigator) {
    throw new Error('No INVESTIGATOR user found for La Trinidad — run `npm run db:seed` first.');
  }

  // ── Case 1: finally-approved Spot Investigation → should offer "Submit Progress" AND
  // "Submit Final" (submitting Final directly is a valid way to skip Progress). ──
  const spotIncident = await prisma.incident.create({
    data: {
      referenceNumber: await generateIncidentReference(),
      municipalityId: municipality.id,
      dateOfIncident: new Date(),
      timeOfIncident: '10:00 AM',
      barangay: 'Test Barangay',
      address: 'TEST DATA — Next Report button demo (Spot case)',
      generalCategory: GENERAL_CATEGORIES.RESIDENTIAL,
      subCategory: 'Single and Two-Family Dwelling',
      description: 'Seeded test incident for verifying the finally-approved Spot Investigation follow-up button.',
      estimatedAffectedArea: '10 square meters',
      status: INCIDENT_STATUS.EXTINGUISHED,
      estimatedDamage: 25000,
      causeOfFire: 'Test data',
      fireInvestigationFindings: 'Test data — safe to delete.',
      createdById: investigator.id,
    },
  });

  const spotReport = await createFinallyApprovedReport({
    reportType: REPORT_TYPES.SPOT_INVESTIGATION,
    municipality,
    incident: spotIncident,
    investigator,
    provincialChiefIIS,
    reportDate: new Date(),
    remarks: 'Approved for filing. (Test data for Next Report button.)',
    content: {
      incidentReference: spotIncident.referenceNumber,
      pointOfOrigin: 'Test data',
      preliminaryCause: 'Test data',
      investigationStatus: 'Spot investigation complete — finally approved by Provincial Chief IIS',
    },
  });

  // ── Case 2: finally-approved Progress Investigation (with its Spot already done too) →
  // should offer ONLY "Submit Final" (Progress is already submitted). ──
  const progressIncident = await prisma.incident.create({
    data: {
      referenceNumber: await generateIncidentReference(),
      municipalityId: municipality.id,
      dateOfIncident: new Date(),
      timeOfIncident: '2:00 PM',
      barangay: 'Test Barangay',
      address: 'TEST DATA — Next Report button demo (Progress case)',
      generalCategory: GENERAL_CATEGORIES.NON_RESIDENTIAL,
      subCategory: 'Business',
      description: 'Seeded test incident for verifying the finally-approved Progress Investigation follow-up button.',
      estimatedAffectedArea: '20 square meters',
      status: INCIDENT_STATUS.EXTINGUISHED,
      estimatedDamage: 60000,
      causeOfFire: 'Test data',
      fireInvestigationFindings: 'Test data — safe to delete.',
      createdById: investigator.id,
    },
  });

  const spotForProgress = await createFinallyApprovedReport({
    reportType: REPORT_TYPES.SPOT_INVESTIGATION,
    municipality,
    incident: progressIncident,
    investigator,
    provincialChiefIIS,
    reportDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    remarks: 'Approved for filing. (Test data for Next Report button.)',
    content: {
      incidentReference: progressIncident.referenceNumber,
      pointOfOrigin: 'Test data',
      preliminaryCause: 'Test data',
      investigationStatus: 'Spot investigation complete — finally approved by Provincial Chief IIS',
    },
  });

  const progressReport = await createFinallyApprovedReport({
    reportType: REPORT_TYPES.PROGRESS_INVESTIGATION,
    municipality,
    incident: progressIncident,
    investigator,
    provincialChiefIIS,
    reportDate: new Date(),
    remarks: 'Approved for filing. (Test data for Next Report button.)',
    content: {
      incidentReference: progressIncident.referenceNumber,
      containmentSummary: 'Test data',
      evidenceCollected: 'Test data',
      nextAction: 'Progress investigation complete — finally approved by Provincial Chief IIS',
    },
  });

  console.log('Test follow-up data created.');
  console.log('');
  console.log(`Log in as: ${investigator.email} / investigator@123`);
  console.log('');
  console.log(`Case 1 — ${spotIncident.referenceNumber}: Spot Investigation report #${spotReport.id} (APPROVED, finally)`);
  console.log('  Expect: "Submit Progress Investigation" AND "Submit Final Investigation" links.');
  console.log('');
  console.log(`Case 2 — ${progressIncident.referenceNumber}: Spot report #${spotForProgress.id} (APPROVED, finally),`);
  console.log(`         Progress Investigation report #${progressReport.id} (APPROVED, finally)`);
  console.log('  Expect: only "Submit Final Investigation" link on the Progress report.');
  console.log('');
  console.log('Both show up on the /municipal dashboard (My Reports) and /municipal/reports list.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error('Error seeding follow-up test data:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
