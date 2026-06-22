import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { ROLES, REPORT_STATUS } from '@/lib/constants';

export async function GET(request) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Only MARSHAL and VIEWER can access analytics
    if (![ROLES.MARSHAL, ROLES.VIEWER].includes(user.role)) {
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
