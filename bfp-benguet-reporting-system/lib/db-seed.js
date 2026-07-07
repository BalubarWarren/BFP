import prisma from './prisma.js';
import { hashPassword } from './auth.js';
import {
  GENERAL_CATEGORIES,
  INCIDENT_STATUS,
  MUNICIPALITIES,
  NOTIFICATION_TYPES,
  REPORT_STATUS,
  REPORT_TYPES,
  ROLES,
  ROLE_PERMISSIONS,
} from './constants.js';

async function createUser({ name, email, password, role, rank, municipalityId }) {
  return prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      role,
      rank,
      municipalityId: municipalityId || null,
      permissions: JSON.stringify(ROLE_PERMISSIONS[role]?.permissions || []),
    },
  });
}

async function main() {
  console.log('Seeding database...');

  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.dailyReportEntry.deleteMany();
  await prisma.report.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.user.deleteMany();
  await prisma.municipality.deleteMany();

  const createdMunicipalities = await Promise.all(
    MUNICIPALITIES.map((mun) =>
      prisma.municipality.create({
        data: {
          name: mun.name,
          code: mun.code,
        },
      })
    )
  );

  const laTrinidad = createdMunicipalities.find((m) => m.code === 'LT');

  const superAdmin = await createUser({
    name: 'System Administrator',
    email: 'admin@bfp-benguet.gov.ph',
    password: 'admin@123',
    role: ROLES.SUPER_ADMIN,
    rank: 'Administrator',
    municipalityId: laTrinidad?.id,
  });

  const provincialChiefIIS = await createUser({
    name: 'Provincial Chief IIS',
    email: 'provincial.chief.iis@bfp-benguet.gov.ph',
    password: 'provchiefiis@123',
    role: ROLES.PROVINCIAL_CHIEF_IIS,
    rank: 'Chief Fire Officer',
    municipalityId: laTrinidad?.id,
  });

  const investigators = [];
  const municipalChiefs = [];
  const municipalChiefOperations = [];
  const municipalMarshals = [];

  for (const mun of createdMunicipalities) {
    const code = mun.code.toLowerCase();

    investigators.push(
      await createUser({
        name: `${mun.name} Municipal Investigator`,
        email: `investigator.${code}@bfp-benguet.gov.ph`,
        password: 'investigator@123',
        role: ROLES.INVESTIGATOR,
        rank: 'Fire Officer III',
        municipalityId: mun.id,
      })
    );

    municipalChiefs.push(
      await createUser({
        name: `${mun.name} Municipal Chief IIS`,
        email: `chief.iis.${code}@bfp-benguet.gov.ph`,
        password: 'chiefiis@123',
        role: ROLES.MUNICIPAL_CHIEF_IIS,
        rank: 'Senior Fire Officer',
        municipalityId: mun.id,
      })
    );

    municipalChiefOperations.push(
      await createUser({
        name: `${mun.name} Municipal Chief Operation`,
        email: `chief.operation.${code}@bfp-benguet.gov.ph`,
        password: 'chiefop@123',
        role: ROLES.MUNICIPAL_CHIEF_OPERATION,
        rank: 'Senior Fire Officer',
        municipalityId: mun.id,
      })
    );

    municipalMarshals.push(
      await createUser({
        name: `${mun.name} Municipal Fire Marshal`,
        email: `marshal.${code}@bfp-benguet.gov.ph`,
        password: 'marshal@123',
        role: ROLES.MUNICIPAL_FIRE_MARSHAL,
        rank: 'Fire Marshal',
        municipalityId: mun.id,
      })
    );
  }

  const getSeedUsers = (code) => {
    const municipality = createdMunicipalities.find((m) => m.code === code);

    return {
      municipality,
      investigator: investigators.find((user) => user.municipalityId === municipality?.id),
      chiefIis: municipalChiefs.find((user) => user.municipalityId === municipality?.id),
      chiefOperation: municipalChiefOperations.find((user) => user.municipalityId === municipality?.id),
      marshal: municipalMarshals.find((user) => user.municipalityId === municipality?.id),
    };
  };

  const sampleAttachment = JSON.stringify([
    {
      name: 'Dummy Fire Investigation Report.pdf',
      type: 'application/pdf',
      size: 245760,
      url: '/uploads/reports/1782798103285-7336s65dm6-Classpin.pdf',
    },
  ]);

  const createSeedIncident = async ({
    referenceNumber,
    municipality,
    investigator,
    dateOfIncident,
    timeOfIncident,
    barangay,
    address,
    generalCategory,
    subCategory,
    description,
    estimatedAffectedArea,
    status,
    casualtiesInjured = 0,
    casualtiesFatalities = 0,
    estimatedDamage,
    causeOfFire,
    fireInvestigationFindings,
  }) =>
    prisma.incident.create({
      data: {
        referenceNumber,
        municipalityId: municipality.id,
        dateOfIncident: new Date(dateOfIncident),
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
        createdById: investigator.id,
      },
    });

  const createSeedReport = async ({
    reportType,
    status,
    municipality,
    incident,
    reportDate,
    submittedBy,
    passedToRole,
    passedTo,
    reviewedBy,
    reviewedAt,
    remarks,
    content,
    respondingUnits,
    respondingOfficer,
    reportingOfficerRank,
    stationCommanderName,
    attachment = sampleAttachment,
    submittedAt,
  }) => {
    const report = await prisma.report.create({
      data: {
        reportType,
        status,
        municipalityId: municipality.id,
        incidentId: incident?.id || null,
        reportDate: new Date(reportDate),
        content: JSON.stringify(content),
        respondingUnits,
        respondingOfficer,
        reportingOfficerRank,
        stationCommanderName,
        remarks,
        passedToRole: passedToRole || null,
        passedToId: passedTo?.id || null,
        submittedAt: submittedAt ? new Date(submittedAt) : new Date(reportDate),
        reviewedAt: reviewedAt ? new Date(reviewedAt) : null,
        reviewedById: reviewedBy?.id || null,
        submittedById: submittedBy.id,
        attachments: attachment,
      },
    });

    if (passedTo?.id) {
      await prisma.notification.create({
        data: {
          userId: passedTo.id,
          message: `Seed report: ${reportType} from ${municipality.name} is ready to open and review.`,
          type: NOTIFICATION_TYPES.REPORT_SUBMITTED,
          reportId: report.id,
        },
      });
    }

    if (status === REPORT_STATUS.APPROVED || status === REPORT_STATUS.RETURNED) {
      await prisma.notification.create({
        data: {
          userId: submittedBy.id,
          message:
            status === REPORT_STATUS.APPROVED
              ? `Seed report from ${municipality.name} has been approved.`
              : `Seed report from ${municipality.name} was returned for revision.`,
          type:
            status === REPORT_STATUS.APPROVED
              ? NOTIFICATION_TYPES.REPORT_APPROVED
              : NOTIFICATION_TYPES.REPORT_RETURNED,
          reportId: report.id,
        },
      });
    }

    return report;
  };

  const atokUsers = getSeedUsers('ATOK');
  const ltUsers = getSeedUsers('LT');
  const itogonUsers = getSeedUsers('ITOGON');
  const tubaUsers = getSeedUsers('TUBA');

  const ltMarketIncident = await createSeedIncident({
    referenceNumber: 'BFP-BEN-2026-SEED-001',
    municipality: ltUsers.municipality,
    investigator: ltUsers.investigator,
    dateOfIncident: '2026-06-24T10:25:00',
    timeOfIncident: '10:25 AM',
    barangay: 'Poblacion',
    address: 'Public Market Extension, Km. 5, La Trinidad, Benguet',
    generalCategory: GENERAL_CATEGORIES.NON_RESIDENTIAL,
    subCategory: 'Business',
    description: 'Small fire observed at a dry goods stall storage area. Responders contained the fire before spread to adjacent stalls.',
    estimatedAffectedArea: '18 square meters',
    status: INCIDENT_STATUS.EXTINGUISHED,
    estimatedDamage: 85000,
    causeOfFire: 'Overheated extension cord',
    fireInvestigationFindings: 'Combustible packaging was stored beside an overloaded outlet. No casualties reported.',
  });

  const ltResidentialIncident = await createSeedIncident({
    referenceNumber: 'BFP-BEN-2026-SEED-002',
    municipality: ltUsers.municipality,
    investigator: ltUsers.investigator,
    dateOfIncident: '2026-06-25T19:40:00',
    timeOfIncident: '7:40 PM',
    barangay: 'Balili',
    address: 'Purok 3, Balili, La Trinidad, Benguet',
    generalCategory: GENERAL_CATEGORIES.RESIDENTIAL,
    subCategory: 'Single and Two-Family Dwelling',
    description: 'Residential kitchen fire reported by neighbors. First arriving unit declared fire under control within eight minutes.',
    estimatedAffectedArea: '12 square meters',
    status: INCIDENT_STATUS.EXTINGUISHED,
    casualtiesInjured: 1,
    estimatedDamage: 45000,
    causeOfFire: 'Unattended cooking',
    fireInvestigationFindings: 'Fire originated near the cooking area. One occupant sustained minor burns.',
  });

  const itogonGrassIncident = await createSeedIncident({
    referenceNumber: 'BFP-BEN-2026-SEED-003',
    municipality: itogonUsers.municipality,
    investigator: itogonUsers.investigator,
    dateOfIncident: '2026-06-26T14:15:00',
    timeOfIncident: '2:15 PM',
    barangay: 'Ucab',
    address: 'Hillside footpath near Sitio Keystone, Itogon, Benguet',
    generalCategory: GENERAL_CATEGORIES.NON_STRUCTURAL,
    subCategory: 'Grass Fire',
    description: 'Grass fire along a hillside trail. The incident was contained with no damage to nearby homes.',
    estimatedAffectedArea: '0.3 hectare',
    status: INCIDENT_STATUS.EXTINGUISHED,
    estimatedDamage: 12000,
    causeOfFire: 'Discarded smoking material',
    fireInvestigationFindings: 'Burn pattern indicates ignition near the footpath before wind-driven spread upslope.',
  });

  const tubaTransportIncident = await createSeedIncident({
    referenceNumber: 'BFP-BEN-2026-SEED-004',
    municipality: tubaUsers.municipality,
    investigator: tubaUsers.investigator,
    dateOfIncident: '2026-06-27T06:05:00',
    timeOfIncident: '6:05 AM',
    barangay: 'Camp 6',
    address: 'Kennon Road shoulder, Camp 6, Tuba, Benguet',
    generalCategory: GENERAL_CATEGORIES.TRANSPORT,
    subCategory: 'Truck',
    description: 'Smoke and flame reported from a delivery truck engine compartment. Fire was extinguished before cargo involvement.',
    estimatedAffectedArea: 'Engine compartment only',
    status: INCIDENT_STATUS.EXTINGUISHED,
    estimatedDamage: 175000,
    causeOfFire: 'Electrical short circuit',
    fireInvestigationFindings: 'Battery cable insulation showed thermal damage consistent with short circuit ignition.',
  });

  const atokResidentialIncident = await createSeedIncident({
    referenceNumber: 'BFP-BEN-2026-SEED-005',
    municipality: atokUsers.municipality,
    investigator: atokUsers.investigator,
    dateOfIncident: '2026-06-29T05:40:00',
    timeOfIncident: '5:40 AM',
    barangay: 'Paoay',
    address: 'Sitio Sayangan, Paoay, Atok, Benguet',
    generalCategory: GENERAL_CATEGORIES.RESIDENTIAL,
    subCategory: 'Single and Two-Family Dwelling',
    description: 'Kitchen-area fire in a residential structure. The fire was contained before spreading to adjacent rooms.',
    estimatedAffectedArea: '10 square meters',
    status: INCIDENT_STATUS.EXTINGUISHED,
    estimatedDamage: 38000,
    causeOfFire: 'Unattended cooking appliance',
    fireInvestigationFindings: 'Burn marks and witness statements point to the cooking area as the origin.',
  });

  const atokGrassIncident = await createSeedIncident({
    referenceNumber: 'BFP-BEN-2026-SEED-006',
    municipality: atokUsers.municipality,
    investigator: atokUsers.investigator,
    dateOfIncident: '2026-06-30T13:20:00',
    timeOfIncident: '1:20 PM',
    barangay: 'Cattubo',
    address: 'Farm access road, Cattubo, Atok, Benguet',
    generalCategory: GENERAL_CATEGORIES.NON_STRUCTURAL,
    subCategory: 'Grass Fire',
    description: 'Grass fire near a farm access road. Responding personnel completed mop-up and perimeter checking.',
    estimatedAffectedArea: '0.15 hectare',
    status: INCIDENT_STATUS.EXTINGUISHED,
    estimatedDamage: 9000,
    causeOfFire: 'Open flame from roadside burning',
    fireInvestigationFindings: 'Fire spread from roadside vegetation toward a cleared farm boundary.',
  });

  await createSeedReport({
    reportType: REPORT_TYPES.MDFIR,
    status: REPORT_STATUS.SUBMITTED,
    municipality: atokUsers.municipality,
    incident: atokResidentialIncident,
    reportDate: '2026-06-29T07:15:00',
    submittedAt: '2026-06-29T07:45:00',
    submittedBy: atokUsers.investigator,
    passedToRole: ROLES.MUNICIPAL_CHIEF_IIS,
    passedTo: atokUsers.chiefIis,
    content: {
      incidentReference: atokResidentialIncident.referenceNumber,
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

  await createSeedReport({
    reportType: REPORT_TYPES.PROGRESS_INVESTIGATION,
    status: REPORT_STATUS.SUBMITTED,
    municipality: atokUsers.municipality,
    incident: atokResidentialIncident,
    reportDate: '2026-06-29T10:30:00',
    submittedAt: '2026-06-29T10:50:00',
    submittedBy: atokUsers.investigator,
    passedToRole: ROLES.MUNICIPAL_CHIEF_OPERATION,
    passedTo: atokUsers.chiefOperation,
    content: {
      incidentReference: atokResidentialIncident.referenceNumber,
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

  await createSeedReport({
    reportType: REPORT_TYPES.SPOT_INVESTIGATION,
    status: REPORT_STATUS.APPROVED,
    municipality: atokUsers.municipality,
    incident: atokGrassIncident,
    reportDate: '2026-06-30T15:00:00',
    submittedAt: '2026-06-30T15:25:00',
    submittedBy: atokUsers.investigator,
    passedToRole: ROLES.INVESTIGATOR,
    passedTo: atokUsers.investigator,
    reviewedBy: atokUsers.chiefIis,
    reviewedAt: '2026-06-30T16:10:00',
    remarks: 'Approved — ready to pass to the Municipal Fire Marshal.',
    content: {
      incidentReference: atokGrassIncident.referenceNumber,
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

  await createSeedReport({
    reportType: REPORT_TYPES.FINAL_INVESTIGATION,
    status: REPORT_STATUS.APPROVED,
    municipality: atokUsers.municipality,
    incident: atokResidentialIncident,
    reportDate: '2026-06-30T09:00:00',
    submittedAt: '2026-06-30T09:30:00',
    submittedBy: atokUsers.investigator,
    reviewedBy: provincialChiefIIS,
    reviewedAt: '2026-06-30T17:20:00',
    remarks: 'Approved for filing. Include access-route observation in municipal readiness review.',
    content: {
      incidentReference: atokResidentialIncident.referenceNumber,
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

  await createSeedReport({
    reportType: REPORT_TYPES.SPOT_INVESTIGATION,
    status: REPORT_STATUS.RETURNED,
    municipality: atokUsers.municipality,
    incident: atokGrassIncident,
    reportDate: '2026-06-30T14:15:00',
    submittedAt: '2026-06-30T14:40:00',
    submittedBy: atokUsers.investigator,
    passedToRole: ROLES.INVESTIGATOR,
    passedTo: atokUsers.investigator,
    reviewedBy: atokUsers.chiefIis,
    reviewedAt: '2026-06-30T15:05:00',
    remarks: 'Add wider scene photos and clarify the estimated burned area before resubmission.',
    content: {
      incidentReference: atokGrassIncident.referenceNumber,
      correctionNeeded: 'Wider scene photos and estimated burned area need revision.',
      currentStatus: 'Returned for revision',
    },
    respondingUnits: 'Atok FS Engine 1',
    respondingOfficer: 'FO2 Mara Baucas',
    reportingOfficerRank: 'Fire Officer II',
    stationCommanderName: 'SINSP Elena Fianza',
  });

  await createSeedReport({
    reportType: REPORT_TYPES.MDFIR,
    status: REPORT_STATUS.SUBMITTED,
    municipality: ltUsers.municipality,
    incident: ltMarketIncident,
    reportDate: '2026-06-24T11:30:00',
    submittedAt: '2026-06-24T12:10:00',
    submittedBy: ltUsers.investigator,
    passedToRole: ROLES.MUNICIPAL_CHIEF_IIS,
    passedTo: ltUsers.chiefIis,
    content: {
      incidentReference: ltMarketIncident.referenceNumber,
      location: 'Public Market Extension, Km. 5',
      occupancyType: 'Business stall storage',
      estimatedDamage: 'PHP 85,000',
      actionTaken: 'Fire extinguished, scene documented, owner interviewed',
      recommendation: 'For review by Municipal Chief IIS',
    },
    respondingUnits: 'La Trinidad FS Engine 1, Ambulance 1',
    respondingOfficer: 'FO3 Miguel Torres',
    reportingOfficerRank: 'Fire Officer III',
    stationCommanderName: 'SINSP Andrea Ramos',
  });

  await createSeedReport({
    reportType: REPORT_TYPES.PROGRESS_INVESTIGATION,
    status: REPORT_STATUS.SUBMITTED,
    municipality: ltUsers.municipality,
    incident: ltMarketIncident,
    reportDate: '2026-06-24T15:30:00',
    submittedAt: '2026-06-24T15:45:00',
    submittedBy: ltUsers.investigator,
    passedToRole: ROLES.MUNICIPAL_CHIEF_OPERATION,
    passedTo: ltUsers.chiefOperation,
    content: {
      incidentReference: ltMarketIncident.referenceNumber,
      operationalConcern: 'Market aisle access was partially blocked by stored goods.',
      resourcesUsed: 'One engine company, one ambulance, and two investigators',
      coordinationNeeded: 'Operations review requested for access and hydrant approach notes',
      currentStatus: 'Submitted to Municipal Chief Operation',
    },
    respondingUnits: 'La Trinidad FS Engine 1, Ambulance 1',
    respondingOfficer: 'FO3 Miguel Torres',
    reportingOfficerRank: 'Fire Officer III',
    stationCommanderName: 'SINSP Andrea Ramos',
  });

  await createSeedReport({
    reportType: REPORT_TYPES.SPOT_INVESTIGATION,
    status: REPORT_STATUS.APPROVED,
    municipality: ltUsers.municipality,
    incident: ltResidentialIncident,
    reportDate: '2026-06-25T21:00:00',
    submittedAt: '2026-06-25T21:45:00',
    submittedBy: ltUsers.investigator,
    passedToRole: ROLES.INVESTIGATOR,
    passedTo: ltUsers.investigator,
    reviewedBy: ltUsers.chiefIis,
    reviewedAt: '2026-06-26T08:20:00',
    remarks: 'Approved — ready to pass to the Municipal Fire Marshal.',
    content: {
      incidentReference: ltResidentialIncident.referenceNumber,
      pointOfOrigin: 'Kitchen counter near LPG stove',
      witnessStatement: 'Neighbor reported smoke from rear window at approximately 7:38 PM.',
      preliminaryCause: 'Unattended cooking',
      investigationStatus: 'Spot investigation complete',
    },
    respondingUnits: 'La Trinidad FS Engine 2',
    respondingOfficer: 'FO2 Clarisse Dangan',
    reportingOfficerRank: 'Fire Officer II',
    stationCommanderName: 'SINSP Andrea Ramos',
  });

  await createSeedReport({
    reportType: REPORT_TYPES.PROGRESS_INVESTIGATION,
    status: REPORT_STATUS.APPROVED,
    municipality: itogonUsers.municipality,
    incident: itogonGrassIncident,
    reportDate: '2026-06-26T16:30:00',
    submittedAt: '2026-06-26T17:05:00',
    submittedBy: itogonUsers.investigator,
    passedToRole: ROLES.INVESTIGATOR,
    passedTo: itogonUsers.investigator,
    reviewedBy: itogonUsers.marshal,
    reviewedAt: '2026-06-27T09:10:00',
    remarks: 'Approved — ready to pass to the Provincial Chief IIS.',
    content: {
      incidentReference: itogonGrassIncident.referenceNumber,
      containmentSummary: 'Perimeter checked and no rekindling observed after mop-up.',
      evidenceCollected: 'Scene photographs, witness notes, and GPS-marked burn area',
      nextAction: 'Provincial validation of findings',
    },
    respondingUnits: 'Itogon FS Engine 1, Barangay response team',
    respondingOfficer: 'FO3 Hanna Baniaga',
    reportingOfficerRank: 'Fire Officer III',
    stationCommanderName: 'INSP Paolo Dominguez',
  });

  await createSeedReport({
    reportType: REPORT_TYPES.FINAL_INVESTIGATION,
    status: REPORT_STATUS.APPROVED,
    municipality: tubaUsers.municipality,
    incident: tubaTransportIncident,
    reportDate: '2026-06-28T09:00:00',
    submittedAt: '2026-06-28T10:00:00',
    submittedBy: tubaUsers.investigator,
    reviewedBy: provincialChiefIIS,
    reviewedAt: '2026-06-29T15:30:00',
    remarks: 'Approved for filing. Notify operations for trend monitoring of vehicle electrical fires.',
    content: {
      incidentReference: tubaTransportIncident.referenceNumber,
      finalCause: 'Electrical short circuit in engine compartment',
      damageAssessment: 'PHP 175,000',
      casualties: 'None',
      disposition: 'Final report approved and archived',
    },
    respondingUnits: 'Tuba FS Engine 1',
    respondingOfficer: 'FO2 Liza Cabading',
    reportingOfficerRank: 'Fire Officer II',
    stationCommanderName: 'SINSP Noel Castro',
  });

  await createSeedReport({
    reportType: REPORT_TYPES.SPOT_INVESTIGATION,
    status: REPORT_STATUS.RETURNED,
    municipality: ltUsers.municipality,
    incident: ltMarketIncident,
    reportDate: '2026-06-24T13:00:00',
    submittedAt: '2026-06-24T13:20:00',
    submittedBy: ltUsers.investigator,
    passedToRole: ROLES.INVESTIGATOR,
    passedTo: ltUsers.investigator,
    reviewedBy: ltUsers.chiefIis,
    reviewedAt: '2026-06-24T16:05:00',
    remarks: 'Please attach clearer photos of the origin area and add the stall owner interview summary.',
    content: {
      incidentReference: ltMarketIncident.referenceNumber,
      correctionNeeded: 'Missing owner interview summary and clearer origin-area photo.',
      currentStatus: 'Returned for revision',
    },
    respondingUnits: 'La Trinidad FS Engine 1',
    respondingOfficer: 'FO3 Miguel Torres',
    reportingOfficerRank: 'Fire Officer III',
    stationCommanderName: 'SINSP Andrea Ramos',
  });

  // ── Historical fire incident data (dailyReportEntry per municipality per month) ──
  // Format: [code, residential, nonResidential, nonStructural, transport]
  const HIST_MONTHS = [
    // ── 2022 annual summary ──
    { date: '2022-06-15', rows: [['ATOK',0,0,4,0],['BAKUN',0,1,5,0],['BOKOD',0,0,7,0],['BUGUIAS',1,1,0,0],['ITOGON',5,3,18,1],['KABAYAN',0,0,2,0],['KAPANGAN',0,0,1,0],['KIBUNGAN',0,0,1,0],['LT',7,4,7,0],['MANKAYAN',0,0,6,0],['SABLAN',2,0,3,0],['TUBA',4,1,9,1],['TUBLAY',3,0,7,0]] },
    // ── 2023 annual summary ──
    { date: '2023-06-15', rows: [['ATOK',0,0,5,0],['BAKUN',0,2,9,0],['BOKOD',0,0,9,0],['BUGUIAS',2,1,0,1],['ITOGON',8,4,28,2],['KABAYAN',0,0,2,0],['KAPANGAN',0,0,2,0],['KIBUNGAN',0,0,2,0],['LT',9,5,9,0],['MANKAYAN',0,0,8,0],['SABLAN',2,0,4,0],['TUBA',5,1,11,1],['TUBLAY',4,0,10,0]] },
    // ── 2024 annual summary ──
    { date: '2024-06-15', rows: [['ATOK',0,0,4,0],['BAKUN',0,1,7,0],['BOKOD',0,0,8,0],['BUGUIAS',1,1,0,1],['ITOGON',6,3,22,1],['KABAYAN',0,0,1,0],['KAPANGAN',0,0,1,0],['KIBUNGAN',0,0,1,0],['LT',7,4,8,0],['MANKAYAN',0,0,7,0],['SABLAN',1,0,3,0],['TUBA',5,0,10,1],['TUBLAY',3,0,9,0]] },
    // ── 2025 monthly ──
    { date: '2025-01-01', rows: [['ATOK',0,0,1,0],['BAKUN',0,0,1,0],['BOKOD',0,0,2,0],['BUGUIAS',0,1,0,0],['ITOGON',1,0,4,0],['KABAYAN',0,0,0,0],['KAPANGAN',0,0,0,0],['KIBUNGAN',0,0,0,0],['LT',1,1,2,0],['MANKAYAN',0,0,1,0],['SABLAN',0,0,0,0],['TUBA',1,0,2,0],['TUBLAY',0,0,1,0]] },
    { date: '2025-02-01', rows: [['ATOK',0,0,0,0],['BAKUN',0,1,2,0],['BOKOD',0,0,2,0],['BUGUIAS',1,0,0,0],['ITOGON',1,1,5,1],['KABAYAN',0,0,0,0],['KAPANGAN',0,0,1,0],['KIBUNGAN',0,0,0,0],['LT',2,1,2,0],['MANKAYAN',0,0,1,0],['SABLAN',1,0,0,0],['TUBA',1,0,3,0],['TUBLAY',1,0,2,0]] },
    { date: '2025-03-01', rows: [['ATOK',0,0,1,0],['BAKUN',0,0,3,0],['BOKOD',0,0,3,0],['BUGUIAS',0,1,0,0],['ITOGON',2,1,8,0],['KABAYAN',0,0,1,0],['KAPANGAN',0,0,0,0],['KIBUNGAN',0,0,1,0],['LT',3,2,3,0],['MANKAYAN',0,0,2,0],['SABLAN',0,0,1,0],['TUBA',2,0,4,0],['TUBLAY',1,0,3,0]] },
    { date: '2025-04-01', rows: [['ATOK',0,0,2,0],['BAKUN',0,1,3,0],['BOKOD',0,0,4,0],['BUGUIAS',1,0,0,1],['ITOGON',2,1,10,0],['KABAYAN',0,0,0,0],['KAPANGAN',0,0,1,0],['KIBUNGAN',0,0,0,0],['LT',3,2,4,0],['MANKAYAN',0,0,3,0],['SABLAN',1,0,1,0],['TUBA',2,0,5,1],['TUBLAY',1,0,4,0]] },
    { date: '2025-05-01', rows: [['ATOK',0,0,1,0],['BAKUN',0,0,4,0],['BOKOD',0,0,4,0],['BUGUIAS',0,1,0,0],['ITOGON',3,1,12,1],['KABAYAN',0,0,1,0],['KAPANGAN',0,0,1,0],['KIBUNGAN',0,0,0,0],['LT',4,2,4,0],['MANKAYAN',0,0,3,0],['SABLAN',0,0,2,0],['TUBA',3,0,5,0],['TUBLAY',2,0,4,0]] },
    { date: '2025-06-01', rows: [['ATOK',0,0,2,0],['BAKUN',0,1,5,0],['BOKOD',0,0,5,0],['BUGUIAS',1,0,0,0],['ITOGON',3,2,14,1],['KABAYAN',0,0,1,0],['KAPANGAN',0,0,1,0],['KIBUNGAN',0,0,1,0],['LT',4,3,5,0],['MANKAYAN',0,0,4,0],['SABLAN',1,0,2,0],['TUBA',3,0,6,0],['TUBLAY',2,0,5,0]] },
    { date: '2025-07-01', rows: [['ATOK',0,0,1,0],['BAKUN',0,0,4,0],['BOKOD',0,0,4,0],['BUGUIAS',0,1,0,1],['ITOGON',3,2,12,0],['KABAYAN',0,0,0,0],['KAPANGAN',0,0,1,0],['KIBUNGAN',0,0,1,0],['LT',3,2,4,0],['MANKAYAN',0,0,3,0],['SABLAN',1,0,1,0],['TUBA',2,0,5,1],['TUBLAY',2,0,4,0]] },
    { date: '2025-08-01', rows: [['ATOK',0,0,2,0],['BAKUN',0,1,5,0],['BOKOD',0,0,5,0],['BUGUIAS',1,1,0,0],['ITOGON',4,2,16,1],['KABAYAN',0,0,1,0],['KAPANGAN',0,0,1,0],['KIBUNGAN',0,0,1,0],['LT',4,3,5,0],['MANKAYAN',0,0,4,0],['SABLAN',1,0,2,0],['TUBA',3,0,7,0],['TUBLAY',2,0,6,0]] },
    { date: '2025-09-01', rows: [['ATOK',0,0,1,0],['BAKUN',0,0,3,0],['BOKOD',0,0,3,0],['BUGUIAS',0,1,0,0],['ITOGON',2,1,10,0],['KABAYAN',0,0,1,0],['KAPANGAN',0,0,0,0],['KIBUNGAN',0,0,0,0],['LT',3,2,3,0],['MANKAYAN',0,0,2,0],['SABLAN',0,0,1,0],['TUBA',2,0,4,0],['TUBLAY',1,0,3,0]] },
    { date: '2025-10-01', rows: [['ATOK',0,0,1,0],['BAKUN',0,0,3,0],['BOKOD',0,0,4,0],['BUGUIAS',0,1,0,1],['ITOGON',2,1,11,0],['KABAYAN',0,0,0,0],['KAPANGAN',0,0,1,0],['KIBUNGAN',0,0,1,0],['LT',3,2,4,0],['MANKAYAN',0,0,3,0],['SABLAN',1,0,1,0],['TUBA',2,0,5,1],['TUBLAY',1,0,4,0]] },
    { date: '2025-11-01', rows: [['ATOK',0,0,2,0],['BAKUN',0,1,4,0],['BOKOD',0,0,5,0],['BUGUIAS',1,0,0,0],['ITOGON',3,2,13,1],['KABAYAN',0,0,1,0],['KAPANGAN',0,0,1,0],['KIBUNGAN',0,0,0,0],['LT',4,2,5,0],['MANKAYAN',0,0,3,0],['SABLAN',1,0,2,0],['TUBA',3,0,6,0],['TUBLAY',2,0,5,0]] },
    { date: '2025-12-01', rows: [['ATOK',0,0,1,0],['BAKUN',0,0,3,0],['BOKOD',0,0,4,0],['BUGUIAS',0,1,0,0],['ITOGON',2,1,9,0],['KABAYAN',0,0,0,0],['KAPANGAN',0,0,1,0],['KIBUNGAN',0,0,0,0],['LT',3,1,4,0],['MANKAYAN',0,0,2,0],['SABLAN',0,0,1,0],['TUBA',2,0,4,0],['TUBLAY',1,0,3,0]] },
    // ── 2026 monthly (Jan–May; Jun is the screenshot data seeded below) ──
    { date: '2026-01-01', rows: [['ATOK',0,0,1,0],['BAKUN',0,0,2,0],['BOKOD',0,0,2,0],['BUGUIAS',0,1,0,0],['ITOGON',1,1,5,0],['KABAYAN',0,0,1,0],['KAPANGAN',0,0,0,0],['KIBUNGAN',0,0,0,0],['LT',2,1,2,0],['MANKAYAN',0,0,1,0],['SABLAN',0,0,1,0],['TUBA',1,0,2,0],['TUBLAY',1,0,2,0]] },
    { date: '2026-02-01', rows: [['ATOK',0,0,0,0],['BAKUN',0,1,3,0],['BOKOD',0,0,3,0],['BUGUIAS',1,0,0,0],['ITOGON',2,1,8,1],['KABAYAN',0,0,0,0],['KAPANGAN',0,0,1,0],['KIBUNGAN',0,0,1,0],['LT',3,2,3,0],['MANKAYAN',0,0,2,0],['SABLAN',1,0,1,0],['TUBA',2,0,4,0],['TUBLAY',1,0,3,0]] },
    { date: '2026-03-01', rows: [['ATOK',0,0,2,0],['BAKUN',0,0,4,0],['BOKOD',0,0,4,0],['BUGUIAS',0,1,0,1],['ITOGON',3,1,12,0],['KABAYAN',0,0,1,0],['KAPANGAN',0,0,1,0],['KIBUNGAN',0,0,0,0],['LT',4,3,4,0],['MANKAYAN',0,0,3,0],['SABLAN',1,0,1,0],['TUBA',3,0,6,1],['TUBLAY',2,0,5,0]] },
    { date: '2026-04-01', rows: [['ATOK',0,0,1,0],['BAKUN',0,1,5,0],['BOKOD',0,0,5,0],['BUGUIAS',1,0,0,0],['ITOGON',3,2,15,1],['KABAYAN',0,0,0,0],['KAPANGAN',0,0,1,0],['KIBUNGAN',0,0,1,0],['LT',4,3,5,0],['MANKAYAN',0,0,4,0],['SABLAN',1,0,2,0],['TUBA',3,0,7,0],['TUBLAY',2,0,6,0]] },
    { date: '2026-05-01', rows: [['ATOK',0,0,2,0],['BAKUN',0,0,5,0],['BOKOD',0,0,6,0],['BUGUIAS',1,1,0,1],['ITOGON',4,2,20,1],['KABAYAN',0,0,1,0],['KAPANGAN',0,0,1,0],['KIBUNGAN',0,0,1,0],['LT',5,3,5,0],['MANKAYAN',0,0,4,0],['SABLAN',1,0,2,0],['TUBA',4,0,8,1],['TUBLAY',2,0,7,0]] },
  ];

  for (const month of HIST_MONTHS) {
    for (const [code, r, nr, ns, t] of month.rows) {
      const mun = createdMunicipalities.find((m) => m.code === code);
      if (!mun) continue;
      await prisma.dailyReportEntry.create({
        data: {
          reportId: 0,
          municipalityId: mun.id,
          reportDate: new Date(month.date),
          residentialCount: r,
          nonResidentialCount: nr,
          nonStructuralCount: ns,
          transportCount: t,
          totalCount: r + nr + ns + t,
          reportingOfficer: 'System Seed',
        },
      });
    }
  }

  // ── June 2026 monitoring board (from screenshot) ──
  const monitoringBoardData = [
    { code: 'ATOK',     residential: 0, nonResidential: 0, nonStructural: 2,  transport: 0, total: 2  },
    { code: 'BAKUN',    residential: 0, nonResidential: 1, nonStructural: 7,  transport: 0, total: 8  },
    { code: 'BOKOD',    residential: 0, nonResidential: 0, nonStructural: 8,  transport: 0, total: 8  },
    { code: 'BUGUIAS',  residential: 1, nonResidential: 1, nonStructural: 0,  transport: 1, total: 3  },
    { code: 'ITOGON',   residential: 4, nonResidential: 2, nonStructural: 26, transport: 1, total: 33 },
    { code: 'KAPANGAN', residential: 0, nonResidential: 0, nonStructural: 1,  transport: 0, total: 1  },
    { code: 'KIBUNGAN', residential: 0, nonResidential: 0, nonStructural: 1,  transport: 0, total: 1  },
    { code: 'LT',       residential: 5, nonResidential: 4, nonStructural: 6,  transport: 0, total: 15 },
    { code: 'MANKAYAN', residential: 0, nonResidential: 0, nonStructural: 5,  transport: 0, total: 5  },
    { code: 'SABLAN',   residential: 1, nonResidential: 0, nonStructural: 2,  transport: 0, total: 3  },
    { code: 'TUBA',     residential: 4, nonResidential: 0, nonStructural: 9,  transport: 1, total: 14 },
    { code: 'TUBLAY',   residential: 3, nonResidential: 0, nonStructural: 8,  transport: 0, total: 11 },
  ];

  for (const entry of monitoringBoardData) {
    const mun = createdMunicipalities.find((m) => m.code === entry.code);
    if (!mun) continue;
    await prisma.dailyReportEntry.create({
      data: {
        reportId: 0,
        municipalityId: mun.id,
        reportDate: new Date('2026-06-01'),
        residentialCount: entry.residential,
        nonResidentialCount: entry.nonResidential,
        nonStructuralCount: entry.nonStructural,
        transportCount: entry.transport,
        totalCount: entry.total,
        reportingOfficer: 'System Seed',
      },
    });
  }

  console.log('Seed completed.');
  console.log('');
  console.log('Test credentials:');
  console.log(`SUPER_ADMIN: ${superAdmin.email} / admin@123`);
  console.log(`PROVINCIAL_CHIEF_IIS: ${provincialChiefIIS.email} / provchiefiis@123`);
  console.log(`INVESTIGATOR (sample): ${investigators[0]?.email} / investigator@123`);
  console.log(`MUNICIPAL_CHIEF_IIS (sample): ${municipalChiefs[0]?.email} / chiefiis@123`);
  console.log(`MUNICIPAL_FIRE_MARSHAL (sample): ${municipalMarshals[0]?.email} / marshal@123`);
  console.log(`CHIEF_OPERATION (sample): ${municipalChiefOperations[0]?.email} / chiefop@123`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error('Error seeding database:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
