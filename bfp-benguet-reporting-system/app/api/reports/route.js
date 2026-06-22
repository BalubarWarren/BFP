import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { ROLES, REPORT_STATUS } from '@/lib/constants';
import generateIncidentReference from '@/lib/incident-reference';

export async function GET(request) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('reportType');
    const status = searchParams.get('status');
    const municipalityId = searchParams.get('municipalityId');

    let whereCondition = {};

    // RBAC: Investigators can only see their own reports, Marshals can see all reports they received
    if (user.role === ROLES.INVESTIGATOR) {
      whereCondition.submittedById = user.id;
    } else if (user.role === ROLES.MARSHAL) {
      // Marshal can see all reports
      whereCondition = {};
    }

    // Optional filters
    if (reportType) whereCondition.reportType = reportType;
    if (status) whereCondition.status = status;
    if (municipalityId && user.role === ROLES.MARSHAL) {
      whereCondition.municipalityId = parseInt(municipalityId);
    }

    const reports = await prisma.report.findMany({
      where: whereCondition,
      include: {
        municipality: true,
        submittedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            rank: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            name: true,
          },
        },
        incident: {
          select: {
            id: true,
            referenceNumber: true,
            generalCategory: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      reports,
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Only allow INVESTIGATOR and MARSHAL to create reports
    if (![ROLES.INVESTIGATOR, ROLES.MARSHAL].includes(user.role)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      reportType,
      municipalityId,
      incidentId,
      reportDate,
      content,
      respondingUnits,
      respondingOfficer,
      reportingOfficerRank,
      stationCommanderName,
      passedToRole,
      passedToId,
    } = body;

    // Validate required fields
    if (!reportType || !municipalityId || !reportDate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Investigators must specify who to pass the report to
    if (user.role === ROLES.INVESTIGATOR && (!passedToRole || (passedToRole && !passedToId))) {
      return NextResponse.json(
        { error: 'Investigators must specify passedToRole and passedToId' },
        { status: 400 }
      );
    }

    // Validate that passedToRole is valid if provided
    if (passedToRole && ![ROLES.CHIEF_INVESTIGATOR_IIS, ROLES.MARSHAL].includes(passedToRole)) {
      return NextResponse.json(
        { error: 'Invalid passedToRole. Must be CHIEF_INVESTIGATOR_IIS or MARSHAL' },
        { status: 400 }
      );
    }

    // RBAC: Investigator can only submit to their own municipality
    if (user.role === ROLES.INVESTIGATOR && user.municipalityId !== parseInt(municipalityId)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const report = await prisma.report.create({
      data: {
        reportType,
        municipalityId: parseInt(municipalityId),
        incidentId: incidentId ? parseInt(incidentId) : null,
        reportDate: new Date(reportDate),
        content: content || {},
        respondingUnits,
        respondingOfficer,
        reportingOfficerRank,
        stationCommanderName,
        passedToRole,
        passedToId: passedToId ? parseInt(passedToId) : null,
        status: REPORT_STATUS.DRAFT,
        submittedById: user.id,
      },
      include: {
        municipality: true,
        submittedBy: true,
        incident: true,
        passedTo: true,
      },
    });

    // Create notification for the recipient if report is being passed
    if (passedToId) {
      await prisma.notification.create({
        data: {
          userId: parseInt(passedToId),
          message: `New ${reportType} report submitted by ${user.name}`,
          type: 'REPORT_SUBMITTED',
          reportId: report.id,
        },
      });
    }

    return NextResponse.json(
      {
        report,
        message: 'Report created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating report:', error);
    return NextResponse.json(
      { error: 'Failed to create report' },
      { status: 500 }
    );
  }
}
