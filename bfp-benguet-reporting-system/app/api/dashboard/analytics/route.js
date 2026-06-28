import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { ROLES } from '@/lib/constants';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const getDailyReportTotals = async (start, end) => {
  const agg = await prisma.dailyReportEntry.aggregate({
    where: { reportDate: { gte: start, lte: end } },
    _sum: {
      residentialCount: true,
      nonResidentialCount: true,
      nonStructuralCount: true,
      transportCount: true,
      totalCount: true,
    },
  });

  return {
    Residential: agg._sum.residentialCount ?? 0,
    'Non-Residential': agg._sum.nonResidentialCount ?? 0,
    'Non-Structural': agg._sum.nonStructuralCount ?? 0,
    Transport: agg._sum.transportCount ?? 0,
    total: agg._sum.totalCount ?? 0,
  };
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
    if (![ROLES.MARSHAL, ROLES.PROVINCIAL_CHIEF_IIS, ROLES.CHIEF_INVESTIGATOR_IIS, ROLES.MUNICIPAL_CHIEF_IIS, ROLES.MUNICIPAL_FIRE_MARSHAL, ROLES.MUNICIPAL_CHIEF_OPERATION, ROLES.VIEWER, ROLES.SUPER_ADMIN].includes(user.role)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let dateFilter = {};
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentYear = new Date(now.getFullYear(), 0, 1);

    if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      };
    }

    // KPI: Total incidents this month
    const thisMonthIncidents = await prisma.incident.count({
      where: {
        createdAt: {
          gte: currentMonth,
          lte: now,
        },
      },
    });

    // KPI: Total incidents this year
    const thisYearIncidents = await prisma.incident.count({
      where: {
        createdAt: {
          gte: currentYear,
          lte: now,
        },
      },
    });

    // KPI: Most active municipality
    const municipalityStats = await prisma.incident.groupBy({
      by: ['municipalityId'],
      _count: true,
      orderBy: {
        _count: {
          municipalityId: 'desc',
        },
      },
      take: 1,
    });

    let mostActiveMunicipality = 'N/A';
    if (municipalityStats.length > 0) {
      const mun = await prisma.municipality.findUnique({
        where: { id: municipalityStats[0].municipalityId },
      });
      mostActiveMunicipality = mun?.name || 'N/A';
    }

    // KPI: Most common category
    const categoryStats = await prisma.incident.groupBy({
      by: ['generalCategory'],
      _count: true,
      orderBy: {
        _count: {
          generalCategory: 'desc',
        },
      },
      take: 1,
    });

    const mostCommonCategory = categoryStats.length > 0 ? categoryStats[0].generalCategory : 'N/A';

    // KPI: Incidents with casualties
    const incidentsWithCasualties = await prisma.incident.count({
      where: {
        OR: [
          { casualtiesInjured: { gt: 0 } },
          { casualtiesFatalities: { gt: 0 } },
        ],
      },
    });

    // Data for bar chart: Incidents per municipality
    const incidentsPerMun = await prisma.incident.groupBy({
      by: ['municipalityId'],
      _count: true,
    });

    const incidentsPerMunData = await Promise.all(
      incidentsPerMun.map(async (stat) => {
        const mun = await prisma.municipality.findUnique({
          where: { id: stat.municipalityId },
        });
        return {
          municipality: mun?.name,
          count: stat._count,
        };
      })
    );

    // Data for pie chart: Incidents by category
    const incidentsByCategory = await prisma.incident.groupBy({
      by: ['generalCategory'],
      _count: true,
    });

    const incidentsByCategoryData = incidentsByCategory.map((stat) => ({
      category: stat.generalCategory,
      count: stat._count,
    }));

    // Monthly trend: count per month for the current year
    const monthlyTrend = await Promise.all(
      MONTHS.map(async (label, idx) => {
        const start = new Date(now.getFullYear(), idx, 1);
        const end = new Date(now.getFullYear(), idx + 1, 0, 23, 59, 59);
        const count = await prisma.incident.count({
          where: { dateOfIncident: { gte: start, lte: end } },
        });
        return { month: label, incidents: count };
      })
    );

    // Yearly trend: count per year for the last 5 years
    const currentYear2 = now.getFullYear();
    const yearlyTrend = await Promise.all(
      [0, 1, 2, 3, 4].map(async (offset) => {
        const year = currentYear2 - (4 - offset);
        const start = new Date(year, 0, 1);
        const end = new Date(year, 11, 31, 23, 59, 59);
        const count = await prisma.incident.count({
          where: { dateOfIncident: { gte: start, lte: end } },
        });
        return { year: String(year), incidents: count };
      })
    );

    // Category breakdown for current month
    const currentMonthByCategory = await prisma.incident.groupBy({
      by: ['generalCategory'],
      where: { dateOfIncident: { gte: currentMonth, lte: now } },
      _count: true,
    });

    // Monthly category breakdown from dailyReportEntry (current year, stacked chart)
    const monthlyByCategory = await Promise.all(
      MONTHS.map(async (label, idx) => {
        const start = new Date(now.getFullYear(), idx, 1);
        const end = new Date(now.getFullYear(), idx + 1, 0, 23, 59, 59);
        const totals = await getDailyReportTotals(start, end);
        return {
          month: label,
          ...totals,
        };
      })
    );

    // Yearly category breakdown from dailyReportEntry (last 5 years, stacked chart)
    const yearlyByCategory = await Promise.all(
      [0, 1, 2, 3, 4].map(async (offset) => {
        const year = currentYear2 - (4 - offset);
        const start = new Date(year, 0, 1);
        const end = new Date(year, 11, 31, 23, 59, 59);
        const totals = await getDailyReportTotals(start, end);
        return {
          year: String(year),
          ...totals,
        };
      })
    );

    const dailyReportDates = await prisma.dailyReportEntry.findMany({
      select: { reportDate: true },
      orderBy: { reportDate: 'asc' },
    });
    const availableYears = [...new Set(dailyReportDates.map((entry) => entry.reportDate.getFullYear()))];
    const comparisonYears = availableYears.length ? availableYears : [currentYear2];

    const yearlyComparison = await Promise.all(
      comparisonYears.map(async (year) => {
        const totals = await getDailyReportTotals(
          new Date(year, 0, 1),
          new Date(year, 11, 31, 23, 59, 59)
        );

        return {
          period: String(year),
          year,
          ...totals,
        };
      })
    );

    const monthlyComparisonByYearEntries = await Promise.all(
      comparisonYears.map(async (year) => {
        const monthlyRows = await Promise.all(
          MONTHS.map(async (month, index) => {
            const totals = await getDailyReportTotals(
              new Date(year, index, 1),
              new Date(year, index + 1, 0, 23, 59, 59)
            );

            return {
              period: `${month} ${year}`,
              month,
              monthNumber: index + 1,
              year,
              ...totals,
            };
          })
        );

        return [String(year), monthlyRows];
      })
    );

    const monthlyComparisonByYear = Object.fromEntries(monthlyComparisonByYearEntries);

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
