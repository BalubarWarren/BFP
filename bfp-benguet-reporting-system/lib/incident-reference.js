import prisma from './prisma.js';

// Generate incident reference number in format: BFP-BEN-2026-001
export async function generateIncidentReference(year = new Date().getFullYear()) {
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31, 23, 59, 59);

  const incidentsThisYear = await prisma.incident.findMany({
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

// generateIncidentReference reads the last reference number and increments it with no
// DB-level lock or sequence backing it, so two submissions in the same moment can compute the
// same "next" number. Rather than serializing every incident creation to prevent that (or adding
// a dedicated sequence table), this retries with a freshly recomputed number on the rare unique
// constraint collision — the same accept-and-retry approach as any optimistic-concurrency scheme.
export async function createIncidentWithReference(data, { maxAttempts = 3, include } = {}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const referenceNumber = await generateIncidentReference();
    try {
      return await prisma.incident.create({
        data: { ...data, referenceNumber },
        ...(include && { include }),
      });
    } catch (error) {
      if (!isReferenceNumberCollision(error) || attempt === maxAttempts) throw error;
    }
  }
}

export default generateIncidentReference;
