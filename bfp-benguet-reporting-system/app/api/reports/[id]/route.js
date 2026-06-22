import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { ROLES, REPORT_STATUS } from '@/lib/constants';

export async function GET(request, { params }) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const report = await prisma.report.findUnique({
      where: { id: parseInt(params.id) },
      include: {
        municipality: true,
        submittedBy: true,
        reviewedBy: true,
        incident: true,
      },
    });

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    // RBAC: Investigators can only view their own reports
    if (
      user.role === ROLES.INVESTIGATOR &&
      report.submittedById !== user.id
    ) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    return NextResponse.json({ report });
  } catch (error) {
    console.error('Error fetching report:', error);
    return NextResponse.json(
      { error: 'Failed to fetch report' },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const report = await prisma.report.findUnique({
      where: { id: parseInt(params.id) },
    });

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    // Only submitter can edit DRAFT reports
    if (report.status === REPORT_STATUS.DRAFT && report.submittedById !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { content, respondingUnits, respondingOfficer, reportingOfficerRank, stationCommanderName, status } = body;

    const updatedReport = await prisma.report.update({
      where: { id: parseInt(params.id) },
      data: {
        ...(content && { content }),
        ...(respondingUnits && { respondingUnits }),
        ...(respondingOfficer && { respondingOfficer }),
        ...(reportingOfficerRank && { reportingOfficerRank }),
        ...(stationCommanderName && { stationCommanderName }),
        ...(status && { status }),
      },
      include: {
        municipality: true,
        submittedBy: true,
        incident: true,
      },
    });

    return NextResponse.json({
      report: updatedReport,
      message: 'Report updated successfully',
    });
  } catch (error) {
    console.error('Error updating report:', error);
    return NextResponse.json(
      { error: 'Failed to update report' },
      { status: 500 }
    );
  }
}
