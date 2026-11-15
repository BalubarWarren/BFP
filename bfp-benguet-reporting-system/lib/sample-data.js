// Sample data for testing: turns the dashboard's placeholder numbers (the "System Seed" daily
// tallies, which have no reports behind them) into real, finally-approved sample cases — an
// incident plus its Spot report (and Progress/Final reports for finished cases), each with a
// generated PDF attached (served by /api/sample-files/...). Every number the boards show can then
// be opened down to an actual report.
//
// Everything is reversible:
//   - sample incidents use a "SAMPLE-" reference number, which is how removal finds them;
//   - replaced seed tallies are only relabelled (SEED_REPLACED_OFFICER) and skipped by the
//     dashboards, never deleted, and get their original label back on removal.
//
// Generation runs in steps (one month of seed tallies per call) so each request stays short
// on Vercel; the admin panel calls it repeatedly until it reports done.
import prisma from './prisma';
import { MUNICIPALITIES, ROLES, REPORT_STATUS, SUB_CATEGORIES } from './constants';
import { BARANGAYS } from './barangays';
import { generateQrToken } from './qr-token';

export const SAMPLE_REF_PREFIX = 'SAMPLE-';
export const SEED_OFFICER = 'System Seed';
export const SEED_REPLACED_OFFICER = 'System Seed [replaced by sample reports]';
// Dashboards read daily tallies through this filter so replaced ones aren't counted twice.
export const ACTIVE_DAILY_ENTRY_WHERE = { reportingOfficer: { not: SEED_REPLACED_OFFICER } };

const CURRENT_PREFIX = `${SAMPLE_REF_PREFIX}CUR-`;

const CATEGORY_FIELDS = [
  ['RESIDENTIAL', 'residentialCount'],
  ['NON_RESIDENTIAL', 'nonResidentialCount'],
  ['NON_STRUCTURAL', 'nonStructuralCount'],
  ['TRANSPORT', 'transportCount'],
];

const PLACES = ['Purok 1', 'Purok 2', 'Purok 3', 'Purok 4', 'Sitio Proper', 'Sitio Upper', 'Sitio Lower', 'near the barangay hall', 'near the public market', 'along the national road', 'near the elementary school', 'beside the chapel', 'near the basketball court', 'along the provincial road'];
const CAUSES = ['faulty electrical wiring', 'unattended cooking', 'an LPG leak', 'burning of rubbish that spread', 'a lighted cigarette', 'an overloaded extension cord', 'a vehicle engine malfunction', 'kaingin (slash-and-burn) that spread', 'children playing with matches', 'an unattended candle'];
const FIRST_NAMES = ['Juan', 'Maria', 'Jose', 'Ana', 'Pedro', 'Rosa', 'Mark', 'Grace', 'Ramon', 'Liza', 'Carlo', 'Joy'];
const LAST_NAMES = ['Dela Cruz', 'Bautista', 'Kiwas', 'Bayang', 'Tamang', 'Calpito', 'Dumalo', 'Lumbaya', 'Pacio', 'Sacla', 'Ayochok', 'Dangwa'];

// Small deterministic RNG so the same seed tally always becomes the same sample cases.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rand, list) => list[Math.floor(rand() * list.length)];
const addDays = (date, days) => new Date(date.getTime() + days * 86400000);
const pad = (n, len = 2) => String(n).padStart(len, '0');

function municipalityKey(municipality) {
  const known = MUNICIPALITIES.find((m) => m.code === municipality.code || m.name === municipality.name);
  return (known?.code || municipality.code || municipality.name).slice(0, 4).toUpperCase();
}

async function loadPeople(adminUser) {
  const [investigators, reviewer] = await Promise.all([
    prisma.user.findMany({ where: { role: ROLES.INVESTIGATOR, municipalityId: { not: null } }, select: { id: true, name: true, municipalityId: true }, orderBy: { id: 'asc' } }),
    prisma.user.findFirst({ where: { role: ROLES.PROVINCIAL_CHIEF_IIS }, select: { id: true }, orderBy: { id: 'asc' } }),
  ]);
  const investigatorByMunicipality = new Map();
  for (const inv of investigators) {
    if (!investigatorByMunicipality.has(inv.municipalityId)) investigatorByMunicipality.set(inv.municipalityId, inv);
  }
  return {
    submitterFor: (municipalityId) => investigatorByMunicipality.get(municipalityId) || { id: adminUser.id, name: adminUser.name },
    reviewerId: reviewer?.id || adminUser.id,
  };
}

// One sample case: the incident row and the (finally approved) reports to file under it.
function buildCase({ rand, ref, municipality, category, date, now, finished, withProgress, people }) {
  const subCategory = pick(rand, SUB_CATEGORIES[category] || ['Other']);
  const barangays = BARANGAYS[municipality.name] || ['Poblacion'];
  const barangay = pick(rand, barangays);
  const address = pick(rand, PLACES);
  const severity = category === 'RESIDENTIAL' || category === 'NON_RESIDENTIAL' ? 1.6 : category === 'TRANSPORT' ? 1.3 : 0.6;
  const injured = rand() < 0.22 * severity ? 1 + Math.floor(rand() * 3) : 0;
  const fatalities = rand() < 0.06 * severity ? 1 + Math.floor(rand() * 2) : 0;
  const hour = 6 + Math.floor(rand() * 16);
  const cause = pick(rand, CAUSES);
  const officer = `${pick(rand, FIRST_NAMES)} ${pick(rand, LAST_NAMES)}`;
  const submitter = people.submitterFor(municipality.id);
  const damage = Math.round((5 + rand() * 495) * 1000);

  const incident = {
    referenceNumber: ref,
    municipalityId: municipality.id,
    dateOfIncident: date,
    timeOfIncident: `${pad(hour)}:${pad(Math.floor(rand() * 60))}`,
    barangay,
    address,
    generalCategory: category,
    subCategory,
    description: `Sample case: fire involving a ${subCategory.toLowerCase()} at ${address}, Brgy. ${barangay}, ${municipality.name}, believed to be caused by ${cause}.`,
    status: finished ? 'EXTINGUISHED' : 'CONTROLLED',
    casualtiesInjured: injured,
    casualtiesFatalities: fatalities,
    estimatedDamage: damage,
    causeOfFire: finished ? cause : null,
    createdById: submitter.id,
  };

  const clamp = (d) => (d > now ? now : d);
  const steps = [['SPOT_INVESTIGATION', 'spot', 1]];
  if (withProgress) steps.push(['PROGRESS_INVESTIGATION', 'progress', 10]);
  if (finished) steps.push(['FINAL_INVESTIGATION', 'final', 30]);

  const reports = steps.map(([reportType, file, offset]) => {
    const submittedAt = clamp(addDays(date, offset));
    const files = [{ name: `${reportType === 'SPOT_INVESTIGATION' ? 'Spot' : reportType === 'PROGRESS_INVESTIGATION' ? 'Progress' : 'Final'} Investigation Report - ${ref}.pdf`, type: 'application/pdf', size: 4096, url: `/api/sample-files/${ref}/${file}.pdf` }];
    if (reportType === 'SPOT_INVESTIGATION' && injured + fatalities > 0) {
      files.push({ name: `EMS Report - ${ref}.pdf`, type: 'application/pdf', size: 3072, url: `/api/sample-files/${ref}/ems.pdf`, kind: 'EMS' });
    }
    return {
      reportType,
      status: REPORT_STATUS.APPROVED,
      municipalityId: municipality.id,
      reportDate: submittedAt,
      category: reportType === 'SPOT_INVESTIGATION' ? category : null,
      content: JSON.stringify(
        reportType === 'SPOT_INVESTIGATION'
          ? { sample: true, dateOfIncident: date.toISOString().slice(0, 10), timeOfIncident: incident.timeOfIncident, description: incident.description, barangay, address, casualtiesInjured: injured, casualtiesFatalities: fatalities }
          : { sample: true }
      ),
      respondingUnits: `${municipality.name} FS Engine ${1 + Math.floor(rand() * 2)}`,
      respondingOfficer: officer,
      reportingOfficerRank: 'FO2',
      stationCommanderName: `SINSP ${pick(rand, LAST_NAMES)}`,
      attachments: JSON.stringify(files),
      passedToRole: null,
      passedToId: null,
      submittedById: submitter.id,
      submittedAt,
      reviewedAt: clamp(addDays(submittedAt, 2)),
      reviewedById: people.reviewerId,
      remarks: 'Approved (sample data).',
      qrToken: generateQrToken(),
      _ref: ref,
    };
  });

  return { incident, reports };
}

// Inserts the cases (incidents, then their reports) and runs `alsoInTx` in the same transaction,
// so a step either fully happens or not at all and can simply be retried.
async function insertCases(cases, alsoInTx) {
  await prisma.$transaction(async (tx) => {
    if (alsoInTx) await alsoInTx(tx);
    if (!cases.length) return;
    await tx.incident.createMany({ data: cases.map((c) => c.incident) });
    const created = await tx.incident.findMany({
      where: { referenceNumber: { in: cases.map((c) => c.incident.referenceNumber) } },
      select: { id: true, referenceNumber: true },
    });
    const idByRef = new Map(created.map((i) => [i.referenceNumber, i.id]));
    const reports = cases.flatMap((c) => c.reports).map(({ _ref, ...report }) => ({ ...report, incidentId: idByRef.get(_ref) }));
    await tx.report.createMany({ data: reports });
  }, { timeout: 45000 });
  return cases.length;
}

export async function getSampleDataStatus() {
  const [sampleCases, sampleReports, seedRemaining, seedReplaced] = await Promise.all([
    prisma.incident.count({ where: { referenceNumber: { startsWith: SAMPLE_REF_PREFIX } } }),
    prisma.report.count({ where: { incident: { referenceNumber: { startsWith: SAMPLE_REF_PREFIX } } } }),
    prisma.dailyReportEntry.count({ where: { reportingOfficer: SEED_OFFICER } }),
    prisma.dailyReportEntry.count({ where: { reportingOfficer: SEED_REPLACED_OFFICER } }),
  ]);
  return { sampleCases, sampleReports, seedRemaining, seedReplaced };
}

// One generation step. Returns { done, created, label } — call again until done.
export async function generateSampleStep(adminUser) {
  const now = new Date();
  const municipalities = await prisma.municipality.findMany({ select: { id: true, name: true, code: true } });
  const people = await loadPeople(adminUser);

  // Step 1: this month's sample cases (the seed has no tallies for the current month), so the
  // "This Month" boards have something to open. Some cases are still open (no Final yet) so the
  // "Start Progress/Final Report" flow can be tried too.
  const hasCurrent = await prisma.incident.findFirst({ where: { referenceNumber: { startsWith: CURRENT_PREFIX } }, select: { id: true } });
  if (!hasCurrent) {
    const cases = [];
    const rand = rng(now.getFullYear() * 100 + now.getMonth());
    for (const municipality of municipalities) {
      const count = 1 + Math.floor(rand() * 3); // 1..3 per municipality
      for (let i = 1; i <= count; i += 1) {
        const day = 1 + Math.floor(rand() * Math.max(1, now.getDate() - 1));
        const category = pick(rand, ['RESIDENTIAL', 'NON_RESIDENTIAL', 'NON_STRUCTURAL', 'NON_STRUCTURAL', 'TRANSPORT']);
        cases.push(buildCase({
          rand,
          ref: `${CURRENT_PREFIX}${municipalityKey(municipality)}-${i}`,
          municipality,
          category,
          date: new Date(Date.UTC(now.getFullYear(), now.getMonth(), day)),
          now,
          finished: false,
          withProgress: rand() < 0.4,
          people,
        }));
      }
    }
    const created = await insertCases(cases);
    return { done: false, created, label: 'This month' };
  }

  // Step 2+: the oldest remaining month of seed tallies becomes one sample case per counted fire.
  const first = await prisma.dailyReportEntry.findFirst({ where: { reportingOfficer: SEED_OFFICER }, orderBy: { reportDate: 'asc' }, select: { reportDate: true } });
  if (!first) return { done: true, created: 0, label: '' };

  const month = first.reportDate;
  const monthStart = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1));
  const entries = await prisma.dailyReportEntry.findMany({
    where: { reportingOfficer: SEED_OFFICER, reportDate: { gte: monthStart, lt: monthEnd } },
    include: { municipality: { select: { id: true, name: true, code: true } } },
  });

  const daysInMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
  const cases = [];
  for (const entry of entries) {
    const rand = rng(entry.id * 7919);
    let n = 0;
    for (const [category, field] of CATEGORY_FIELDS) {
      for (let k = 0; k < (entry[field] || 0); k += 1) {
        n += 1;
        const date = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1 + Math.floor(rand() * daysInMonth)));
        cases.push(buildCase({
          rand,
          ref: `${SAMPLE_REF_PREFIX}${month.getUTCFullYear()}${pad(month.getUTCMonth() + 1)}-${municipalityKey(entry.municipality)}-E${entry.id}-${n}`,
          municipality: entry.municipality,
          category,
          date,
          now,
          finished: addDays(date, 30) <= now,
          withProgress: rand() < 0.35,
          people,
        }));
      }
    }
  }

  const created = await insertCases(cases, (tx) =>
    tx.dailyReportEntry.updateMany({
      where: { id: { in: entries.map((e) => e.id) } },
      data: { reportingOfficer: SEED_REPLACED_OFFICER },
    })
  );
  const label = monthStart.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return { done: false, created, label };
}

// Deletes every sample case and its reports (annotations cascade, notifications are unlinked)
// and puts the placeholder seed tallies back.
export async function removeSampleData() {
  const sampleWhere = { incident: { referenceNumber: { startsWith: SAMPLE_REF_PREFIX } } };
  const reports = await prisma.report.findMany({ where: sampleWhere, select: { id: true } });
  const reportIds = reports.map((r) => r.id);
  await prisma.$transaction(async (tx) => {
    if (reportIds.length) {
      await tx.auditLog.deleteMany({ where: { reportId: { in: reportIds } } });
      await tx.trashItem.deleteMany({ where: { itemType: { in: ['REPORT_VERSION', 'REPORT'] }, originalId: { in: reportIds } } });
      await tx.report.deleteMany({ where: { id: { in: reportIds } } });
    }
    await tx.incident.deleteMany({ where: { referenceNumber: { startsWith: SAMPLE_REF_PREFIX } } });
    await tx.dailyReportEntry.updateMany({ where: { reportingOfficer: SEED_REPLACED_OFFICER }, data: { reportingOfficer: SEED_OFFICER } });
  }, { timeout: 60000 });
  return { removedReports: reportIds.length };
}
