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

export default generateIncidentReference;
