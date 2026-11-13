import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getUserFromRequest } from '../../../../lib/auth';
import { approvedArchiveWhere, canViewApprovedArchive, MUNICIPAL_REVIEWER_ROLES } from '../../../../lib/report-access';

// Casualty Monitoring Board on the Reports page: injured and fatalities per municipality for a
// period (default: the current month), counted by incident date. A case counts once its Spot
// report has final approval — the same "official record" rule as the Reports archive, and the
// same scoping: municipal reviewers see their own municipality, the Provincial Chief IIS all.
// The numbers live on the case's incident: entered on the Spot report, updated by the Final report.
export async function GET(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canViewApprovedArchive(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const now = new Date();
    const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
    // A date-only end ("2026-11-30") means through the end of that day.
    const end = endDate
      ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(endDate) ? `${endDate}T23:59:59.999Z` : endDate)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
    }

    const isMunicipal = MUNICIPAL_REVIEWER_ROLES.includes(user.role);

    const [incidents, municipalities] = await Promise.all([
      prisma.incident.findMany({
        where: {
          dateOfIncident: { gte: start, lte: end },
          reports: { some: { ...approvedArchiveWhere(user), reportType: 'SPOT_INVESTIGATION' } },
        },
        select: {
          id: true,
          referenceNumber: true,
          dateOfIncident: true,
          barangay: true,
          address: true,
          casualtiesInjured: true,
          casualtiesFatalities: true,
          municipalityId: true,
        },
        orderBy: { dateOfIncident: 'desc' },
      }),
      prisma.municipality.findMany({
        where: isMunicipal ? { id: user.municipalityId } : {},
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const rows = municipalities.map((m) => ({
      municipalityId: m.id,
      municipality: m.name,
      code: m.code,
      incidents: 0,
      injured: 0,
      fatalities: 0,
      total: 0,
      cases: [],
    }));
    const byId = new Map(rows.map((row) => [row.municipalityId, row]));

    for (const incident of incidents) {
      const row = byId.get(incident.municipalityId);
      if (!row) continue;
      const injured = incident.casualtiesInjured || 0;
      const fatalities = incident.casualtiesFatalities || 0;
      row.incidents += 1;
      row.injured += injured;
      row.fatalities += fatalities;
      row.total += injured + fatalities;
      if (injured + fatalities > 0) {
        row.cases.push({
          id: incident.id,
          referenceNumber: incident.referenceNumber,
          dateOfIncident: incident.dateOfIncident,
          barangay: incident.barangay,
          address: incident.address,
          injured,
          fatalities,
        });
      }
    }

    const totals = rows.reduce(
      (sum, row) => ({
        incidents: sum.incidents + row.incidents,
        injured: sum.injured + row.injured,
        fatalities: sum.fatalities + row.fatalities,
        total: sum.total + row.total,
      }),
      { incidents: 0, injured: 0, fatalities: 0, total: 0 }
    );

    return NextResponse.json({ rows, totals, asOf: new Date() });
  } catch (error) {
    console.error('Error fetching casualty board:', error);
    return NextResponse.json({ error: 'Failed to fetch casualty board' }, { status: 500 });
  }
}
