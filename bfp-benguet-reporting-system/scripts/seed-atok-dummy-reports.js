const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'prisma', 'dev.db');
const db = new Database(dbPath);

const get = (sql, params = []) => db.prepare(sql).get(params);

const atok = get('SELECT id FROM municipalities WHERE code = ?', ['ATOK']);
const provincialChief = get(
  'SELECT id, role FROM users WHERE email = ?',
  ['provincial.chief.iis@bfp-benguet.gov.ph']
);
const investigator = get('SELECT id FROM users WHERE email = ?', ['investigator.atok@bfp-benguet.gov.ph']);
const chiefIis = get('SELECT id FROM users WHERE email = ?', ['chief.iis.atok@bfp-benguet.gov.ph']);
const chiefOperation = get('SELECT id FROM users WHERE email = ?', ['chief.operation.atok@bfp-benguet.gov.ph']);
const marshal = get('SELECT id FROM users WHERE email = ?', ['marshal.atok@bfp-benguet.gov.ph']);

if (!atok || !provincialChief || !investigator || !chiefIis || !chiefOperation || !marshal) {
  throw new Error('Missing seeded Atok users. Run the main database seed first.');
}

const attachment = JSON.stringify([
  {
    name: 'Dummy Fire Investigation Report.pdf',
    type: 'application/pdf',
    size: 245760,
    url: '/uploads/reports/1782798103285-7336s65dm6-Classpin.pdf',
  },
]);

const insertIncident = db.prepare(`
  INSERT INTO incidents (
    referenceNumber,
    municipalityId,
    dateOfIncident,
    timeOfIncident,
    barangay,
    address,
    generalCategory,
    subCategory,
    description,
    estimatedAffectedArea,
    status,
    casualtiesInjured,
    casualtiesFatalities,
    estimatedDamage,
    causeOfFire,
    fireInvestigationFindings,
    createdById,
    createdAt,
    updatedAt
  ) VALUES (
    @referenceNumber,
    @municipalityId,
    @dateOfIncident,
    @timeOfIncident,
    @barangay,
    @address,
    @generalCategory,
    @subCategory,
    @description,
    @estimatedAffectedArea,
    @status,
    @casualtiesInjured,
    @casualtiesFatalities,
    @estimatedDamage,
    @causeOfFire,
    @fireInvestigationFindings,
    @createdById,
    @createdAt,
    @updatedAt
  )
`);

const insertReport = db.prepare(`
  INSERT INTO reports (
    reportType,
    status,
    municipalityId,
    incidentId,
    reportDate,
    content,
    respondingUnits,
    respondingOfficer,
    reportingOfficerRank,
    stationCommanderName,
    remarks,
    passedToRole,
    passedToId,
    submittedAt,
    reviewedAt,
    reviewedById,
    submittedById,
    attachments,
    createdAt,
    updatedAt
  ) VALUES (
    @reportType,
    @status,
    @municipalityId,
    @incidentId,
    @reportDate,
    @content,
    @respondingUnits,
    @respondingOfficer,
    @reportingOfficerRank,
    @stationCommanderName,
    @remarks,
    @passedToRole,
    @passedToId,
    @submittedAt,
    @reviewedAt,
    @reviewedById,
    @submittedById,
    @attachments,
    @createdAt,
    @updatedAt
  )
`);

const insertNotification = db.prepare(`
  INSERT INTO notifications (userId, message, type, isRead, reportId, createdAt)
  VALUES (@userId, @message, @type, 0, @reportId, @createdAt)
`);

const now = new Date().toISOString();

const createIncident = (incident) => {
  const existing = get('SELECT id FROM incidents WHERE referenceNumber = ?', [incident.referenceNumber]);
  if (existing) return existing.id;

  const result = insertIncident.run({
    municipalityId: atok.id,
    createdById: investigator.id,
    casualtiesInjured: 0,
    casualtiesFatalities: 0,
    createdAt: now,
    updatedAt: now,
    ...incident,
  });

  return Number(result.lastInsertRowid);
};

const createReport = (report) => {
  const existing = get(
    'SELECT id FROM reports WHERE municipalityId = ? AND reportType = ? AND reportDate = ? AND submittedById = ?',
    [atok.id, report.reportType, report.reportDate, investigator.id]
  );

  if (existing) return existing.id;

  const result = insertReport.run({
    municipalityId: atok.id,
    submittedById: investigator.id,
    attachments: attachment,
    createdAt: now,
    updatedAt: now,
    reviewedAt: null,
    reviewedById: null,
    remarks: null,
    passedToRole: null,
    passedToId: null,
    ...report,
    content: JSON.stringify(report.content),
  });

  const reportId = Number(result.lastInsertRowid);

  if (report.passedToId) {
    insertNotification.run({
      userId: report.passedToId,
      message: `Seed report: ${report.reportType} from Atok is ready to open and review.`,
      type: 'REPORT_SUBMITTED',
      reportId,
      createdAt: now,
    });
  }

  if (report.status === 'APPROVED' || report.status === 'RETURNED') {
    insertNotification.run({
      userId: investigator.id,
      message:
        report.status === 'APPROVED'
          ? 'Seed report from Atok has been approved.'
          : 'Seed report from Atok was returned for revision.',
      type: report.status === 'APPROVED' ? 'REPORT_APPROVED' : 'REPORT_RETURNED',
      reportId,
      createdAt: now,
    });
  }

  return reportId;
};

const transaction = db.transaction(() => {
  const residentialIncidentId = createIncident({
    referenceNumber: 'BFP-BEN-2026-SEED-005',
    dateOfIncident: '2026-06-29T05:40:00.000Z',
    timeOfIncident: '5:40 AM',
    barangay: 'Paoay',
    address: 'Sitio Sayangan, Paoay, Atok, Benguet',
    generalCategory: 'RESIDENTIAL',
    subCategory: 'Single and Two-Family Dwelling',
    description: 'Kitchen-area fire in a residential structure. The fire was contained before spreading to adjacent rooms.',
    estimatedAffectedArea: '10 square meters',
    status: 'EXTINGUISHED',
    estimatedDamage: 38000,
    causeOfFire: 'Unattended cooking appliance',
    fireInvestigationFindings: 'Burn marks and witness statements point to the cooking area as the origin.',
  });

  const grassIncidentId = createIncident({
    referenceNumber: 'BFP-BEN-2026-SEED-006',
    dateOfIncident: '2026-06-30T13:20:00.000Z',
    timeOfIncident: '1:20 PM',
    barangay: 'Cattubo',
    address: 'Farm access road, Cattubo, Atok, Benguet',
    generalCategory: 'NON_STRUCTURAL',
    subCategory: 'Grass Fire',
    description: 'Grass fire near a farm access road. Responding personnel completed mop-up and perimeter checking.',
    estimatedAffectedArea: '0.15 hectare',
    status: 'EXTINGUISHED',
    estimatedDamage: 9000,
    causeOfFire: 'Open flame from roadside burning',
    fireInvestigationFindings: 'Fire spread from roadside vegetation toward a cleared farm boundary.',
  });

  createReport({
    reportType: 'MDFIR',
    status: 'SUBMITTED',
    incidentId: residentialIncidentId,
    reportDate: '2026-06-29T07:15:00.000Z',
    submittedAt: '2026-06-29T07:45:00.000Z',
    passedToRole: 'MUNICIPAL_CHIEF_IIS',
    passedToId: chiefIis.id,
    content: {
      incidentReference: 'BFP-BEN-2026-SEED-005',
      location: 'Sitio Sayangan, Paoay',
      occupancyType: 'Residential dwelling',
      estimatedDamage: 'PHP 38,000',
      actionTaken: 'Scene documented, occupant interviewed, and appliance area photographed',
      recommendation: 'For Municipal Chief IIS review',
    },
    respondingUnits: 'Atok FS Engine 1',
    respondingOfficer: 'FO3 Carlo Bay-an',
    reportingOfficerRank: 'Fire Officer III',
    stationCommanderName: 'SINSP Elena Fianza',
  });

  createReport({
    reportType: 'PROGRESS_INVESTIGATION',
    status: 'SUBMITTED',
    incidentId: residentialIncidentId,
    reportDate: '2026-06-29T10:30:00.000Z',
    submittedAt: '2026-06-29T10:50:00.000Z',
    passedToRole: 'MUNICIPAL_CHIEF_OPERATION',
    passedToId: chiefOperation.id,
    content: {
      incidentReference: 'BFP-BEN-2026-SEED-005',
      operationalConcern: 'Steep access road delayed positioning of the first responding apparatus.',
      resourcesUsed: 'One engine company and local barangay responders',
      coordinationNeeded: 'Operations review requested for access-route notes',
      currentStatus: 'Submitted to Municipal Chief Operation',
    },
    respondingUnits: 'Atok FS Engine 1, Barangay Paoay responders',
    respondingOfficer: 'FO3 Carlo Bay-an',
    reportingOfficerRank: 'Fire Officer III',
    stationCommanderName: 'SINSP Elena Fianza',
  });

  createReport({
    reportType: 'SPOT_INVESTIGATION',
    status: 'APPROVED',
    incidentId: grassIncidentId,
    reportDate: '2026-06-30T15:00:00.000Z',
    submittedAt: '2026-06-30T15:25:00.000Z',
    passedToRole: 'INVESTIGATOR',
    passedToId: investigator.id,
    reviewedById: chiefIis.id,
    reviewedAt: '2026-06-30T16:10:00.000Z',
    remarks: 'Approved — ready to pass to the Municipal Fire Marshal.',
    content: {
      incidentReference: 'BFP-BEN-2026-SEED-006',
      pointOfOrigin: 'Roadside vegetation beside the farm access road',
      witnessStatement: 'Farm worker noticed smoke after roadside burning activity.',
      preliminaryCause: 'Open flame from roadside burning',
      investigationStatus: 'Spot investigation complete',
    },
    respondingUnits: 'Atok FS Engine 1',
    respondingOfficer: 'FO2 Mara Baucas',
    reportingOfficerRank: 'Fire Officer II',
    stationCommanderName: 'SINSP Elena Fianza',
  });

  createReport({
    reportType: 'FINAL_INVESTIGATION',
    status: 'APPROVED',
    incidentId: residentialIncidentId,
    reportDate: '2026-06-30T09:00:00.000Z',
    submittedAt: '2026-06-30T09:30:00.000Z',
    reviewedById: provincialChief.id,
    reviewedAt: '2026-06-30T17:20:00.000Z',
    remarks: 'Approved for filing. Include access-route observation in municipal readiness review.',
    content: {
      incidentReference: 'BFP-BEN-2026-SEED-005',
      finalCause: 'Unattended cooking appliance',
      damageAssessment: 'PHP 38,000',
      casualties: 'None',
      disposition: 'Final report approved',
    },
    respondingUnits: 'Atok FS Engine 1',
    respondingOfficer: 'FO3 Carlo Bay-an',
    reportingOfficerRank: 'Fire Officer III',
    stationCommanderName: 'SINSP Elena Fianza',
  });

  createReport({
    reportType: 'SPOT_INVESTIGATION',
    status: 'RETURNED',
    incidentId: grassIncidentId,
    reportDate: '2026-06-30T14:15:00.000Z',
    submittedAt: '2026-06-30T14:40:00.000Z',
    passedToRole: 'INVESTIGATOR',
    passedToId: investigator.id,
    reviewedById: chiefIis.id,
    reviewedAt: '2026-06-30T15:05:00.000Z',
    remarks: 'Add wider scene photos and clarify the estimated burned area before resubmission.',
    content: {
      incidentReference: 'BFP-BEN-2026-SEED-006',
      correctionNeeded: 'Wider scene photos and estimated burned area need revision.',
      currentStatus: 'Returned for revision',
    },
    respondingUnits: 'Atok FS Engine 1',
    respondingOfficer: 'FO2 Mara Baucas',
    reportingOfficerRank: 'Fire Officer II',
    stationCommanderName: 'SINSP Elena Fianza',
  });
});

transaction();

const rows = db.prepare(`
  SELECT r.id, r.reportType, r.status, u.email AS passedTo
  FROM reports r
  LEFT JOIN users u ON u.id = r.passedToId
  WHERE r.municipalityId = ?
  ORDER BY r.id
`).all(atok.id);

console.log(`Seeded Atok dummy reports. Atok report count: ${rows.length}`);
console.table(rows);

db.close();
