import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getUserFromRequest } from '../../../../lib/auth';
import { ROLES, REPORT_STATUS } from '../../../../lib/constants';
import { PROVINCIAL_REVIEWER_ROLES } from '../../../../lib/report-access';

const CATEGORY_FIELD_MAP = {
  RESIDENTIAL: 'residential',
  NON_RESIDENTIAL: 'nonResidential',
  NON_STRUCTURAL: 'nonStructural',
  TRANSPORT: 'transport',
};

const emptySubCategories = () => ({ residential: {}, nonResidential: {}, nonStructural: {}, transport: {} });

// Spot Investigation reports carry their sub-category on the linked Incident; MDFIR reports don't
// create an Incident at all, so theirs only lives inside the stored content JSON.
const getReportSubCategory = (report) => {
  if (report.incident?.subCategory) return report.incident.subCategory;
  try {
    return JSON.parse(report.content || '{}').subCategory || null;
  } catch {
    return null;
  }
};

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

    // Get all daily report entries (which contain the incident counts), plus categorized
    // Spot Investigation / MDFIR reports that have reached the provincial level
    const [dailyEntries, spotReports, allMunicipalities] = await Promise.all([
      prisma.dailyReportEntry.findMany({
        where: dateFilter,
        select: {
          reportDate: true,
          residentialCount: true,
          nonResidentialCount: true,
          nonStructuralCount: true,
          transportCount: true,
          totalCount: true,
          municipality: { select: { id: true, name: true, code: true } },
        },
        orderBy: { reportDate: 'desc' },
      }),
      // select (not include) — this is polled every 15s by the provincial dashboard across every
      // Spot/MDFIR report in the period, so it's worth not pulling attachments/respondingUnits/
      // remarks/etc. that this endpoint never reads; only `content` is kept, for the sub-category
      // JSON fallback in getReportSubCategory.
      prisma.report.findMany({
        where: {
          ...dateFilter,
          reportType: { in: ['SPOT_INVESTIGATION', 'MDFIR'] },
          category: { not: null },
          passedToRole: { in: PROVINCIAL_REVIEWER_ROLES },
        },
        select: {
          id: true,
          category: true,
          reportDate: true,
          status: true,
          content: true,
          municipality: { select: { id: true, name: true, code: true } },
          incident: { select: { referenceNumber: true, subCategory: true } },
          submittedBy: { select: { name: true } },
        },
        orderBy: { reportDate: 'desc' },
      }),
      prisma.municipality.findMany({ orderBy: { name: 'asc' } }),
    ]);

    // Seed all municipalities with zero counts first
    const monitoringData = {};
    allMunicipalities.forEach((mun) => {
      monitoringData[mun.name] = {
        municipality: mun.name,
        code: mun.code,
        municipalityId: mun.id,
        residential: 0,
        nonResidential: 0,
        nonStructural: 0,
        transport: 0,
        total: 0,
        lastUpdated: null,
        subCategories: emptySubCategories(),
      };
    });

    // Accumulate daily report entries on top
    dailyEntries.forEach((entry) => {
      const munName = entry.municipality.name;
      if (!monitoringData[munName]) {
        monitoringData[munName] = {
          municipality: entry.municipality.name,
          code: entry.municipality.code,
          municipalityId: entry.municipality.id,
          residential: 0,
          nonResidential: 0,
          nonStructural: 0,
          transport: 0,
          total: 0,
          lastUpdated: entry.reportDate,
          subCategories: emptySubCategories(),
        };
      }
      monitoringData[munName].residential += entry.residentialCount;
      monitoringData[munName].nonResidential += entry.nonResidentialCount;
      monitoringData[munName].nonStructural += entry.nonStructuralCount;
      monitoringData[munName].transport += entry.transportCount;
      monitoringData[munName].total += entry.totalCount;
      if (!monitoringData[munName].lastUpdated || entry.reportDate > monitoringData[munName].lastUpdated) {
        monitoringData[munName].lastUpdated = entry.reportDate;
      }
    });

    // Accumulate categorized Spot Investigation reports on top of daily report entries
    spotReports.forEach((report) => {
      const field = CATEGORY_FIELD_MAP[report.category];
      if (!field) return;
      const munName = report.municipality.name;
      if (!monitoringData[munName]) {
        monitoringData[munName] = {
          municipality: report.municipality.name,
          code: report.municipality.code,
          municipalityId: report.municipality.id,
          residential: 0,
          nonResidential: 0,
          nonStructural: 0,
          transport: 0,
          total: 0,
          lastUpdated: null,
          subCategories: emptySubCategories(),
        };
      }
      monitoringData[munName][field] += 1;
      monitoringData[munName].total += 1;
      if (!monitoringData[munName].lastUpdated || report.reportDate > monitoringData[munName].lastUpdated) {
        monitoringData[munName].lastUpdated = report.reportDate;
      }

      const sub = getReportSubCategory(report);
      if (sub) {
        monitoringData[munName].subCategories[field][sub] = (monitoringData[munName].subCategories[field][sub] || 0) + 1;
      }
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

    // Individually filed Spot Investigation reports that reached the provincial level, grouped
    // by category, for drill-down — the daily-tally portion of each total (totals[field] minus
    // this list's length) has no per-incident record to show, only these categorized reports do.
    const reportsByCategory = { residential: [], nonResidential: [], nonStructural: [], transport: [] };
    spotReports.forEach((report) => {
      const field = CATEGORY_FIELD_MAP[report.category];
      if (!field) return;
      reportsByCategory[field].push({
        id: report.id,
        referenceNumber: report.incident?.referenceNumber || null,
        municipality: report.municipality.name,
        reportDate: report.reportDate,
        status: report.status,
        submittedBy: report.submittedBy?.name || null,
      });
    });

    // Sub-category tallies, province-wide, per general category — only sub-categories an
    // investigator actually reported appear here (e.g. a category with only "Grass" reports
    // this period won't list "Forest" or "Rubbish" at all, let alone at zero).
    const subCategoryTotals = emptySubCategories();
    spotReports.forEach((report) => {
      const field = CATEGORY_FIELD_MAP[report.category];
      const sub = getReportSubCategory(report);
      if (!field || !sub) return;
      subCategoryTotals[field][sub] = (subCategoryTotals[field][sub] || 0) + 1;
    });

    return NextResponse.json({
      monitoringBoard,
      totals,
      reportsByCategory,
      subCategoryTotals,
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
