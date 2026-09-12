import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getUserFromRequest } from '../../../../lib/auth';
import { ROLES } from '../../../../lib/constants';
import { PROVINCIAL_REVIEWER_ROLES } from '../../../../lib/report-access';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const CATEGORY_LABEL_MAP = {
  RESIDENTIAL: 'Residential',
  NON_RESIDENTIAL: 'Non-Residential',
  NON_STRUCTURAL: 'Non-Structural',
  TRANSPORT: 'Transport',
};

// Builds a (start, end) -> category totals function over data already pulled into memory once —
// dailyEntries and categorizedReports are each fetched a single time up front, so every
// month/year bucket this is called for (12 months + 5 years + N comparison years + N*12
// comparison months) is a synchronous in-memory filter instead of its own DB round trip.
const makeGetPeriodTotals = (dailyEntries, categorizedReports) => (start, end) => {
  const totals = {
    Residential: 0,
    'Non-Residential': 0,
    'Non-Structural': 0,
    Transport: 0,
    total: 0,
  };

  dailyEntries.forEach((entry) => {
    if (entry.reportDate < start || entry.reportDate > end) return;
    totals.Residential += entry.residentialCount;
    totals['Non-Residential'] += entry.nonResidentialCount;
    totals['Non-Structural'] += entry.nonStructuralCount;
    totals.Transport += entry.transportCount;
    totals.total += entry.totalCount;
  });

  categorizedReports.forEach((report) => {
    if (report.reportDate < start || report.reportDate > end) return;
    const label = CATEGORY_LABEL_MAP[report.category];
    if (!label) return;
    totals[label] += 1;
    totals.total += 1;
  });

  return totals;
};

const getHighestPeriod = (rows) =>
  rows.reduce((highest, row) => {
    if (!highest || row.total > highest.total) return row;
    return highest;
  }, null);

export async function GET(request) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Allow provincial, municipal workflow viewers, and admins
    if (![ROLES.MARSHAL, ROLES.PROVINCIAL_CHIEF_IIS, ROLES.CHIEF_INVESTIGATOR_IIS, ROLES.MUNICIPAL_CHIEF_IIS, ROLES.MUNICIPAL_FIRE_MARSHAL, ROLES.MUNICIPAL_CHIEF_OPERATION, ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(user.role)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentYear = new Date(now.getFullYear(), 0, 1);
    const currentYear2 = now.getFullYear();

    // Pulled once and reused for every month/year bucket below — this is the fix for what was
    // previously ~80+ separate dailyReportEntry.aggregate() calls (one per month/year/comparison
    // bucket), each a full DB round trip on an endpoint polled every 15s by the provincial
    // dashboard.
    const [categorizedReports, dailyEntries] = await Promise.all([
      prisma.report.findMany({
        where: {
          reportType: { in: ['SPOT_INVESTIGATION', 'MDFIR'] },
          category: { not: null },
          passedToRole: { in: PROVINCIAL_REVIEWER_ROLES },
        },
        select: { reportDate: true, category: true },
      }),
      prisma.dailyReportEntry.findMany({
        select: {
          reportDate: true,
          residentialCount: true,
          nonResidentialCount: true,
          nonStructuralCount: true,
          transportCount: true,
          totalCount: true,
        },
      }),
    ]);
    const getPeriodTotals = makeGetPeriodTotals(dailyEntries, categorizedReports);

    // KPI: Total incidents this month / this year / with casualties, plus the municipality and
    // category groupBys, all still run as their own targeted queries (they're already single
    // round trips, not loops).
    const [
      thisMonthIncidents,
      thisYearIncidents,
      municipalityStats,
      categoryStats,
      incidentsWithCasualties,
      incidentsPerMun,
      incidentsByCategory,
      currentMonthByCategory,
      trendIncidentDates,
    ] = await Promise.all([
      prisma.incident.count({ where: { createdAt: { gte: currentMonth, lte: now } } }),
      prisma.incident.count({ where: { createdAt: { gte: currentYear, lte: now } } }),
      prisma.incident.groupBy({
        by: ['municipalityId'],
        _count: true,
        orderBy: { _count: { municipalityId: 'desc' } },
        take: 1,
      }),
      prisma.incident.groupBy({
        by: ['generalCategory'],
        _count: true,
        orderBy: { _count: { generalCategory: 'desc' } },
        take: 1,
      }),
      prisma.incident.count({
        where: { OR: [{ casualtiesInjured: { gt: 0 } }, { casualtiesFatalities: { gt: 0 } }] },
      }),
      prisma.incident.groupBy({ by: ['municipalityId'], _count: true }),
      prisma.incident.groupBy({ by: ['generalCategory'], _count: true }),
      prisma.incident.groupBy({
        by: ['generalCategory'],
        where: { dateOfIncident: { gte: currentMonth, lte: now } },
        _count: true,
      }),
      // Replaces 12 (monthlyTrend) + 5 (yearlyTrend) separate incident.count() calls — every
      // incident in the trend window, bucketed in memory below instead of one COUNT per bucket.
      prisma.incident.findMany({
        where: { dateOfIncident: { gte: new Date(currentYear2 - 4, 0, 1), lte: new Date(currentYear2, 11, 31, 23, 59, 59) } },
        select: { dateOfIncident: true },
      }),
    ]);

    let mostActiveMunicipality = 'N/A';
    let incidentsPerMunData = [];
    if (municipalityStats.length > 0 || incidentsPerMun.length > 0) {
      // One batched lookup for every municipality referenced by either groupBy, instead of a
      // separate findUnique per row (the N+1 this replaces).
      const municipalityIds = [...new Set([
        ...municipalityStats.map((s) => s.municipalityId),
        ...incidentsPerMun.map((s) => s.municipalityId),
      ])];
      const municipalities = await prisma.municipality.findMany({
        where: { id: { in: municipalityIds } },
        select: { id: true, name: true },
      });
      const municipalityNameById = new Map(municipalities.map((m) => [m.id, m.name]));

      if (municipalityStats.length > 0) {
        mostActiveMunicipality = municipalityNameById.get(municipalityStats[0].municipalityId) || 'N/A';
      }
      incidentsPerMunData = incidentsPerMun.map((stat) => ({
        municipality: municipalityNameById.get(stat.municipalityId),
        count: stat._count,
      }));
    }

    const mostCommonCategory = categoryStats.length > 0 ? categoryStats[0].generalCategory : 'N/A';

    const incidentsByCategoryData = incidentsByCategory.map((stat) => ({
      category: stat.generalCategory,
      count: stat._count,
    }));

    const monthlyTrend = MONTHS.map((label, idx) => {
      const count = trendIncidentDates.filter(
        (inc) => inc.dateOfIncident.getFullYear() === currentYear2 && inc.dateOfIncident.getMonth() === idx
      ).length;
      return { month: label, incidents: count };
    });

    const yearlyTrend = [0, 1, 2, 3, 4].map((offset) => {
      const year = currentYear2 - (4 - offset);
      const count = trendIncidentDates.filter((inc) => inc.dateOfIncident.getFullYear() === year).length;
      return { year: String(year), incidents: count };
    });

    const monthlyByCategory = MONTHS.map((label, idx) => {
      const start = new Date(now.getFullYear(), idx, 1);
      const end = new Date(now.getFullYear(), idx + 1, 0, 23, 59, 59);
      return { month: label, ...getPeriodTotals(start, end) };
    });

    const yearlyByCategory = [0, 1, 2, 3, 4].map((offset) => {
      const year = currentYear2 - (4 - offset);
      const start = new Date(year, 0, 1);
      const end = new Date(year, 11, 31, 23, 59, 59);
      return { year: String(year), ...getPeriodTotals(start, end) };
    });

    const availableYears = [...new Set([
      ...dailyEntries.map((entry) => entry.reportDate.getFullYear()),
      ...categorizedReports.map((report) => report.reportDate.getFullYear()),
    ])].sort((a, b) => a - b);
    const comparisonYears = availableYears.length ? availableYears : [currentYear2];

    const yearlyComparison = comparisonYears.map((year) => ({
      period: String(year),
      year,
      ...getPeriodTotals(new Date(year, 0, 1), new Date(year, 11, 31, 23, 59, 59)),
    }));

    const monthlyComparisonByYear = Object.fromEntries(
      comparisonYears.map((year) => [
        String(year),
        MONTHS.map((month, index) => ({
          period: `${month} ${year}`,
          month,
          monthNumber: index + 1,
          year,
          ...getPeriodTotals(new Date(year, index, 1), new Date(year, index + 1, 0, 23, 59, 59)),
        })),
      ])
    );

    return NextResponse.json({
      kpis: {
        thisMonth: thisMonthIncidents,
        thisYear: thisYearIncidents,
        mostActiveMunicipality,
        mostCommonCategory,
        incidentsWithCasualties,
      },
      charts: {
        incidentsPerMunicipality: incidentsPerMunData,
        incidentsByCategory: incidentsByCategoryData,
        monthlyTrend,
        yearlyTrend,
        currentMonthByCategory: currentMonthByCategory.map((s) => ({
          category: s.generalCategory,
          count: s._count,
        })),
        monthlyByCategory,
        yearlyByCategory,
        comparison: {
          availableYears: comparisonYears,
          yearly: yearlyComparison,
          monthlyByYear: monthlyComparisonByYear,
          highestYear: getHighestPeriod(yearlyComparison),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
