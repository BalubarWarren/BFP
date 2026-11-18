// Sample data for testing: turns the dashboard's placeholder numbers (the "System Seed" daily
// tallies, which have no reports behind them) into real, finally-approved sample cases — an
// incident plus its Spot report (and Progress/Final reports for finished cases), each with a
// generated PDF attached (served by /api/sample-files/...). Every number the boards show can then
// be opened down to an actual report.
//
// Everything is reversible:
//   - sample incidents use a "SAMPLE-" reference number, which is how removal finds them;
//   - replaced tallies are only relabelled (REPLACED_PREFIX in front of their reporting officer)
//     and skipped by the dashboards, never deleted, and get their original label back on removal.
//
// Which tallies are placeholders: all of them. No screen in the app records daily tallies (the
// POST /api/daily-report-entries endpoint has no caller), so every tally in the database is
// seeded/dummy data — whatever its reportingOfficer label or reportId says.
//
// Generation runs in steps (one month of seed tallies per call) so each request stays short
// on Vercel; the admin panel calls it repeatedly until it reports done.
import prisma from './prisma';
import { MUNICIPALITIES, ROLES, REPORT_STATUS, SUB_CATEGORIES } from './constants';
import { BARANGAYS } from './barangays';
import { generateQrToken } from './qr-token';

export const SAMPLE_REF_PREFIX = 'SAMPLE-';
export const REPLACED_PREFIX = '[sample-replaced] ';
// Label used by the first version of this tool, still recognised so its runs can be undone.
const LEGACY_REPLACED_OFFICER = 'System Seed [replaced by sample reports]';
const LEGACY_SEED_OFFICER = 'System Seed';
// Dashboards read daily tallies through this filter so replaced ones aren't counted twice.
export const ACTIVE_DAILY_ENTRY_WHERE = {
  NOT: [{ reportingOfficer: { startsWith: REPLACED_PREFIX } }, { reportingOfficer: LEGACY_REPLACED_OFFICER }],
};

const CURRENT_PREFIX = `${SAMPLE_REF_PREFIX}CUR-`;

const CATEGORY_FIELDS = [
  ['RESIDENTIAL', 'residentialCount'],
  ['NON_RESIDENTIAL', 'nonResidentialCount'],
  ['NON_STRUCTURAL', 'nonStructuralCount'],
  ['TRANSPORT', 'transportCount'],
];

const PLACES = ['Purok 1', 'Purok 2', 'Purok 3', 'Purok 4', 'Sitio Proper', 'Sitio Upper', 'Sitio Lower', 'near the barangay hall', 'near the public market', 'along the national road', 'near the elementary school', 'beside the chapel', 'near the basketball court', 'along the provincial road'];
const CAUSES = ['faulty electrical wiring', 'unattended cooking', 'an LPG leak', 'burning of rubbish that spread', 'a lighted cigarette', 'an overloaded extension cord', 'a vehicle engine malfunction', 'kaingin (slash-and-burn) that spread', 'children playing with matches', 'an unattended candle'];
const SAMPLE_PROPERTY_TYPE = {
  RESIDENTIAL: 'Single-family house',
  NON_RESIDENTIAL: 'Commercial establishment',
  NON_STRUCTURAL: 'Grassland / Forest',
  TRANSPORT: 'Vehicle',
};
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
  const rescues = injured + fatalities > 0 ? Math.floor(rand() * 3) : 0;

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
      // The boards count a Spot report by its report date, so it stays on the day of the fire
      // (keeping it in the same month as the tally it replaces); follow-ups are dated when filed.
      reportDate: reportType === 'SPOT_INVESTIGATION' ? date : submittedAt,
      category: reportType === 'SPOT_INVESTIGATION' ? category : null,
      content: JSON.stringify(
        reportType === 'SPOT_INVESTIGATION'
          ? {
              sample: true,
              dateOfIncident: date.toISOString().slice(0, 10),
              timeOfIncident: incident.timeOfIncident,
              description: incident.description,
              barangay,
              address,
              casualtiesInjured: injured,
              casualtiesFatalities: fatalities,
              rescueOperations: rescues,
              propertyType: SAMPLE_PROPERTY_TYPE[category],
              establishmentName: category === 'NON_RESIDENTIAL' ? `${pick(rand, LAST_NAMES)} ${subCategory}` : '',
              ownerName: `${pick(rand, FIRST_NAMES)} ${pick(rand, LAST_NAMES)}`,
              occupantName: '',
              numberOfStoreys: category === 'RESIDENTIAL' || category === 'NON_RESIDENTIAL' ? 1 + Math.floor(rand() * 3) : null,
            }
          : reportType === 'FINAL_INVESTIGATION'
          ? { sample: true, causeOfFire: incident.causeOfFire }
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

// Daily tallies still standing in for real reports (see the header comment), optionally within
// a date range. Returned oldest first.
async function findPlaceholderTallies(dateWhere = {}) {
  return prisma.dailyReportEntry.findMany({
    where: { ...ACTIVE_DAILY_ENTRY_WHERE, ...dateWhere },
    include: { municipality: { select: { id: true, name: true, code: true } } },
    orderBy: { reportDate: 'asc' },
  });
}

const tallyFires = (entry) => CATEGORY_FIELDS.reduce((n, [, field]) => n + (entry[field] || 0), 0);

// Deletes the given sample incidents with their reports (annotations cascade, notifications are
// unlinked) in one transaction.
async function deleteSampleIncidents(incidentIds) {
  if (!incidentIds.length) return 0;
  const reports = await prisma.report.findMany({ where: { incidentId: { in: incidentIds } }, select: { id: true } });
  const reportIds = reports.map((r) => r.id);
  await prisma.$transaction([
    prisma.auditLog.deleteMany({ where: { reportId: { in: reportIds } } }),
    prisma.trashItem.deleteMany({ where: { itemType: { in: ['REPORT_VERSION', 'REPORT'] }, originalId: { in: reportIds } } }),
    prisma.report.deleteMany({ where: { id: { in: reportIds } } }),
    prisma.incident.deleteMany({ where: { id: { in: incidentIds } } }),
  ]);
  return reportIds.length;
}

// Puts hidden tallies back on the dashboards with their original label.
// Plain Prisma updates, grouped by label (tallies share a handful of labels, e.g. "System Seed"),
// rather than raw SQL: the raw substr()/|| statements failed on the production database.
async function unhideTallies(ids) {
  if (!ids.length) return;
  const entries = await prisma.dailyReportEntry.findMany({
    where: { id: { in: ids }, NOT: ACTIVE_DAILY_ENTRY_WHERE },
    select: { id: true, reportingOfficer: true },
  });
  const byOriginal = new Map();
  for (const entry of entries) {
    const original =
      entry.reportingOfficer === LEGACY_REPLACED_OFFICER
        ? LEGACY_SEED_OFFICER
        : entry.reportingOfficer.slice(REPLACED_PREFIX.length);
    if (!byOriginal.has(original)) byOriginal.set(original, []);
    byOriginal.get(original).push(entry.id);
  }
  await prisma.$transaction(
    [...byOriginal].map(([original, entryIds]) =>
      prisma.dailyReportEntry.updateMany({ where: { id: { in: entryIds } }, data: { reportingOfficer: original } })
    )
  );
}

// Hides tallies (inside the generation transaction), keeping their label after REPLACED_PREFIX.
async function hideTallies(tx, entries) {
  const byLabel = new Map();
  for (const entry of entries) {
    if (!byLabel.has(entry.reportingOfficer)) byLabel.set(entry.reportingOfficer, []);
    byLabel.get(entry.reportingOfficer).push(entry.id);
  }
  for (const [label, entryIds] of byLabel) {
    // eslint-disable-next-line no-await-in-loop
    await tx.dailyReportEntry.updateMany({ where: { id: { in: entryIds } }, data: { reportingOfficer: `${REPLACED_PREFIX}${label}` } });
  }
}

// The invariant this tool relies on: a tally is hidden only while ALL of its sample cases exist.
// Sample cases carry their tally's id in the reference number ("...-E<tallyId>-<n>"). A hidden
// tally with fewer cases than fires (an interrupted removal, an older version of this tool...)
// would leave a hole in the dashboards, so it's repaired: its leftover cases are deleted and the
// tally is shown again (and becomes a placeholder that the next generation converts properly).
// With `dryRun`, only reports how many tallies need repair.
async function repairHiddenTallies({ dryRun = false } = {}) {
  const [hidden, sampleIncidents] = await Promise.all([
    prisma.dailyReportEntry.findMany({ where: { NOT: ACTIVE_DAILY_ENTRY_WHERE } }),
    prisma.incident.findMany({ where: { referenceNumber: { startsWith: SAMPLE_REF_PREFIX } }, select: { id: true, referenceNumber: true } }),
  ]);
  const casesByTally = new Map();
  for (const incident of sampleIncidents) {
    const match = /-E(\d+)-\d+$/.exec(incident.referenceNumber);
    if (!match) continue;
    const tallyId = Number(match[1]);
    if (!casesByTally.has(tallyId)) casesByTally.set(tallyId, []);
    casesByTally.get(tallyId).push(incident.id);
  }
  const broken = hidden.filter((entry) => (casesByTally.get(entry.id) || []).length < tallyFires(entry));
  if (dryRun || !broken.length) return broken.length;

  await deleteSampleIncidents(broken.flatMap((entry) => casesByTally.get(entry.id) || []));
  await unhideTallies(broken.map((entry) => entry.id));
  return broken.length;
}

export async function getSampleDataStatus() {
  const [sampleCases, sampleReports, placeholders, replaced, needRepair] = await Promise.all([
    prisma.incident.count({ where: { referenceNumber: { startsWith: SAMPLE_REF_PREFIX } } }),
    prisma.report.count({ where: { incident: { referenceNumber: { startsWith: SAMPLE_REF_PREFIX } } } }),
    findPlaceholderTallies(),
    prisma.dailyReportEntry.count({ where: { NOT: ACTIVE_DAILY_ENTRY_WHERE } }),
    repairHiddenTallies({ dryRun: true }),
  ]);
  const fires = placeholders.reduce((sum, e) => sum + CATEGORY_FIELDS.reduce((n, [, f]) => n + (e[f] || 0), 0), 0);
  return { sampleCases, sampleReports, seedRemaining: placeholders.length, firesRemaining: fires, seedReplaced: replaced, needRepair };
}

// One generation step. Returns { done, created, label } — call again until done.
export async function generateSampleStep(adminUser) {
  const now = new Date();
  // First put back any tally that's hidden without all of its sample cases (see above).
  await repairHiddenTallies();
  const people = await loadPeople(adminUser);

  // The oldest remaining month of placeholder tallies becomes one sample case per counted fire,
  // in the same municipality, month and category, so every board total stays the same.
  const placeholders = await findPlaceholderTallies();
  if (placeholders.length) {
    const month = placeholders[0].reportDate;
    const y = month.getUTCFullYear();
    const m = month.getUTCMonth();
    const entries = placeholders.filter((e) => e.reportDate.getUTCFullYear() === y && e.reportDate.getUTCMonth() === m);
    const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const lastDay = y === now.getUTCFullYear() && m === now.getUTCMonth() ? Math.max(1, now.getUTCDate()) : daysInMonth;

    const cases = [];
    for (const entry of entries) {
      const rand = rng(entry.id * 7919);
      let n = 0;
      for (const [category, field] of CATEGORY_FIELDS) {
        for (let k = 0; k < (entry[field] || 0); k += 1) {
          n += 1;
          const date = new Date(Date.UTC(y, m, 1 + Math.floor(rand() * lastDay)));
          cases.push(buildCase({
            rand,
            ref: `${SAMPLE_REF_PREFIX}${y}${pad(m + 1)}-${municipalityKey(entry.municipality)}-E${entry.id}-${n}`,
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

    const created = await insertCases(cases, (tx) => hideTallies(tx, entries));
    const label = new Date(Date.UTC(y, m, 1)).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    return { done: false, created, label };
  }

  // Last step: if the current month had no tallies at all, add a few sample cases for it so the
  // "This Month" boards have reports to open. Some are still open (no Final yet) so the
  // "Start Progress/Final Report" flow can be tried too.
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [hasCurrent, currentTallies] = await Promise.all([
    prisma.incident.findFirst({ where: { referenceNumber: { startsWith: CURRENT_PREFIX } }, select: { id: true } }),
    prisma.dailyReportEntry.count({ where: { reportDate: { gte: monthStart } } }),
  ]);
  if (hasCurrent || currentTallies) return { done: true, created: 0, label: '' };

  const municipalities = await prisma.municipality.findMany({ select: { id: true, name: true, code: true } });
  const cases = [];
  const rand = rng(now.getUTCFullYear() * 100 + now.getUTCMonth());
  for (const municipality of municipalities) {
    const count = 1 + Math.floor(rand() * 3); // 1..3 per municipality
    for (let i = 1; i <= count; i += 1) {
      const day = 1 + Math.floor(rand() * Math.max(1, now.getUTCDate() - 1));
      cases.push(buildCase({
        rand,
        ref: `${CURRENT_PREFIX}${municipalityKey(municipality)}-${i}`,
        municipality,
        category: pick(rand, ['RESIDENTIAL', 'NON_RESIDENTIAL', 'NON_STRUCTURAL', 'NON_STRUCTURAL', 'TRANSPORT']),
        date: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day)),
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

// Removes sample cases a batch at a time (each request has to finish inside Vercel's time limit;
// one transaction for thousands of reports didn't). Deletes up to REMOVE_BATCH cases with their
// reports (annotations cascade, notifications are unlinked); once none are left, puts the
// placeholder tallies back exactly as they were. Returns { done, removedReports } — call again
// until done.
const REMOVE_BATCH = 150;

export async function removeSampleBatch() {
  const incidents = await prisma.incident.findMany({
    where: { referenceNumber: { startsWith: SAMPLE_REF_PREFIX } },
    select: { id: true },
    orderBy: { id: 'asc' },
    take: REMOVE_BATCH,
  });

  if (!incidents.length) {
    // Nothing sample left: every hidden tally goes back.
    const hidden = await prisma.dailyReportEntry.findMany({ where: { NOT: ACTIVE_DAILY_ENTRY_WHERE }, select: { id: true } });
    await unhideTallies(hidden.map((entry) => entry.id));
    return { done: true, removedReports: 0 };
  }

  const removedReports = await deleteSampleIncidents(incidents.map((i) => i.id));
  // Tallies whose cases were (partly) in this batch are shown again right away, so the
  // dashboards never lose numbers part-way through a removal.
  await repairHiddenTallies();
  return { done: false, removedReports };
}
