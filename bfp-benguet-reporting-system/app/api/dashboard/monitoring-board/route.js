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

    const now = new Date();
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        reportDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      };
    } else {
      // Default: current calendar month only
      dateFilter = {
        reportDate: {
          gte: new Date(now.getFullYear(), now.getMonth(), 1),
          lte: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
        },
      };
    }

    // Get all daily report entries (which contain the incident counts)
    const dailyEntries = await prisma.dailyReportEntry.findMany({
      where: dateFilter,
      include: {
        municipality: true,
      },
      orderBy: {
        reportDate: 'desc',
      },
    });

    // Group by municipality and get latest counts
    const monitoringData = {};
    dailyEntries.forEach((entry) => {
      const munName = entry.municipality.name;
      if (!monitoringData[munName]) {
        monitoringData[munName] = {
          municipality: entry.municipality.name,
          code: entry.municipality.code,
          residential: 0,
          nonResidential: 0,
          nonStructural: 0,
          transport: 0,
          total: 0,
          lastUpdated: entry.reportDate,
        };
      }
      // Add counts
      monitoringData[munName].residential += entry.residentialCount;
      monitoringData[munName].nonResidential += entry.nonResidentialCount;
      monitoringData[munName].nonStructural += entry.nonStructuralCount;
      monitoringData[munName].transport += entry.transportCount;
      monitoringData[munName].total += entry.totalCount;
    });

    const monitoringBoard = Object.values(monitoringData);

    // Calculate totals
    const totals = {
      residential: monitoringBoard.reduce((sum, m) => sum + m.residential, 0),
      nonResidential: monitoringBoard.reduce((sum, m) => sum + m.nonResidential, 0),
      nonStructural: monitoringBoard.reduce((sum, m) => sum + m.nonStructural, 0),
      transport: monitoringBoard.reduce((sum, m) => sum + m.transport, 0),
      total: monitoringBoard.reduce((sum, m) => sum + m.total, 0),
    };

    return NextResponse.json({
      monitoringBoard,
      totals,
      asOf: new Date(),
    });
  } catch (error) {
    console.error('Error fetching monitoring board:', error);
    return NextResponse.json(
      { error: 'Failed to fetch monitoring board' },
      { status: 500 }
    );
  }
}
