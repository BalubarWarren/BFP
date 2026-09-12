import crypto from 'crypto';
import prisma from './prisma.js';

// Generate incident reference number in format: BFP-BEN-2026-001. Accepts an optional Prisma
// client/transaction handle so callers already inside a transaction (see createIncidentWithReference
// below) read a consistent view instead of a separate, un-transacted connection.
export async function generateIncidentReference(year = new Date().getFullYear(), client = prisma) {
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31, 23, 59, 59);

  const incidentsThisYear = await client.incident.findMany({
    where: {
      createdAt: {
        gte: startOfYear,
        lte: endOfYear,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 1,
  });

  let sequence = 1;
  if (incidentsThisYear.length > 0) {
    // Extract sequence from last reference number
    const lastRef = incidentsThisYear[0].referenceNumber;
    const match = lastRef.match(/BFP-BEN-\d+-(\d+)/);
    if (match) {
      sequence = parseInt(match[1]) + 1;
    }
  }

  return `BFP-BEN-${year}-${String(sequence).padStart(3, '0')}`;
}

const isReferenceNumberCollision = (error) => {
  if (error.code !== 'P2002') return false;
  const target = error.meta?.target;
  return Array.isArray(target) ? target.includes('referenceNumber') : String(target || '').includes('referenceNumber');
};

// A genuine double-submit (double-click, or the browser silently retrying a slow/dropped
// request) resubmits the exact same form data within well under a second — 5s comfortably covers
// that while limiting how long two real, separate fires reported back-to-back in the same
// municipality/category risk being wrongly merged into one.
const DUPLICATE_SUBMIT_WINDOW_MS = 5 * 1000;

// If every optional field is blank, the identifying fields reduce to just
// municipality+category+date — the one combination genuinely likely to match two unrelated real
// fires reported minutes apart (not just a double-submitted one). Only treat a match as a
// duplicate when at least one of these was actually filled in, so a bare-bones report never gets
// silently merged into an unrelated one; the rare cost is a genuine double-submit of a
// no-detail report creating two sparse Incidents instead of one, which is a far safer failure
// mode than merging two different fires into a single case file.
const hasDistinguishingContent = (data) =>
  Boolean(data.subCategory || data.timeOfIncident || data.barangay || data.address || data.description);

const duplicateCheckWhere = (data) => ({
  createdById: data.createdById,
  municipalityId: data.municipalityId,
  generalCategory: data.generalCategory,
  subCategory: data.subCategory ?? null,
  dateOfIncident: data.dateOfIncident,
  timeOfIncident: data.timeOfIncident ?? null,
  barangay: data.barangay ?? null,
  address: data.address ?? null,
  description: data.description ?? null,
  createdAt: { gte: new Date(Date.now() - DUPLICATE_SUBMIT_WINDOW_MS) },
});

// pg_advisory_xact_lock(bigint) takes a single 64-bit key; hashing the identifying fields down to
// one gives every distinct "logical incident" its own lock key without needing a schema change.
const adviseLockKeyFor = (data) => {
  const digest = crypto.createHash('sha256').update(JSON.stringify(duplicateCheckWhere(data))).digest();
  return digest.readBigInt64BE(0);
};

// generateIncidentReference reads the last reference number and increments it with no
// DB-level lock or sequence backing it, so two submissions in the same moment can compute the
// same "next" number. Rather than serializing every incident creation to prevent that (or adding
// a dedicated sequence table), this retries with a freshly recomputed number on the rare unique
// constraint collision — the same accept-and-retry approach as any optimistic-concurrency scheme.
export async function createIncidentWithReference(data, { maxAttempts = 3, include } = {}) {
  // Guards against creating two Incident rows for what's actually the same double-submitted
  // report. A plain "check for a recent duplicate, then create if none" has the same race as any
  // check-then-insert: two truly concurrent requests can both pass the check before either has
  // committed. The advisory lock serializes anyone with the *same* identifying fields — held only
  // for the duration of this transaction, and released automatically at commit/rollback — so the
  // second of two racing submissions blocks here, then sees the first one's row once it proceeds.
  const lockKey = adviseLockKeyFor(data);

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;

    if (hasDistinguishingContent(data)) {
      const recentDuplicate = await tx.incident.findFirst({
        where: duplicateCheckWhere(data),
        ...(include && { include }),
      });
      if (recentDuplicate) return recentDuplicate;
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const referenceNumber = await generateIncidentReference(undefined, tx);
      try {
        return await tx.incident.create({
          data: { ...data, referenceNumber },
          ...(include && { include }),
        });
      } catch (error) {
        if (!isReferenceNumberCollision(error) || attempt === maxAttempts) throw error;
      }
    }
    return undefined;
  });
}

export default generateIncidentReference;
