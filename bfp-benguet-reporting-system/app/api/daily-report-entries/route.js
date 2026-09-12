import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { getUserFromRequest } from '../../../lib/auth';
import { ROLES } from '../../../lib/constants';

export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Only allow INVESTIGATOR
    if (user.role !== ROLES.INVESTIGATOR) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      reportId,
      municipalityId,
      reportDate,
      residentialCount,
      nonResidentialCount,
      nonStructuralCount,
      transportCount,
      reportingOfficer,
    } = body;

    if (!reportId || !municipalityId || !reportDate || !reportingOfficer) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // RBAC: Can only create for their own municipality
    if (user.municipalityId !== parseInt(municipalityId)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // reportId is otherwise trusted as-is with no ownership check — without this, an
    // investigator could attach a daily-report entry to any arbitrary report (including one
    // submitted by someone else, in another municipality), polluting the monitoring-board
    // aggregates that get attributed to that report.
    const parsedReportId = parseInt(reportId);
    const linkedReport = await prisma.report.findUnique({
      where: { id: parsedReportId },
      select: { submittedById: true, municipalityId: true },
    });

    if (!linkedReport || linkedReport.submittedById !== user.id || linkedReport.municipalityId !== user.municipalityId) {
      return NextResponse.json(
        { error: 'reportId must refer to one of your own reports in your municipality' },
        { status: 400 }
      );
    }

    const entry = await prisma.dailyReportEntry.create({
      data: {
        reportId: parsedReportId,
        municipalityId: parseInt(municipalityId),
        reportDate: new Date(reportDate),
        residentialCount: parseInt(residentialCount) || 0,
        nonResidentialCount: parseInt(nonResidentialCount) || 0,
        nonStructuralCount: parseInt(nonStructuralCount) || 0,
        transportCount: parseInt(transportCount) || 0,
        totalCount:
          (parseInt(residentialCount) || 0) +
          (parseInt(nonResidentialCount) || 0) +
          (parseInt(nonStructuralCount) || 0) +
          (parseInt(transportCount) || 0),
        reportingOfficer,
      },
    });

    return NextResponse.json(
      { entry, message: 'Daily report entry created successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating daily report entry:', error);
    return NextResponse.json(
      { error: 'Failed to create daily report entry' },
      { status: 500 }
    );
  }
}
