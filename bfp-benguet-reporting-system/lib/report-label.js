import prisma from './prisma.js';

// Human-readable name for a report in notifications and messages. Users know reports by their
// case reference number (e.g. BFP-BEN-2026-047); the internal database id means nothing to them.
export async function getReportRef(reportId) {
  try {
    const row = await prisma.report.findUnique({
      where: { id: Number(reportId) },
      select: { incident: { select: { referenceNumber: true } } },
    });
    return row?.incident?.referenceNumber || null;
  } catch {
    return null;
  }
}

// "report BFP-BEN-2026-047", or just "report" when the case has no reference yet.
export async function getReportLabel(reportId, noun = 'report') {
  const ref = await getReportRef(reportId);
  return ref ? `${noun} ${ref}` : noun;
}
