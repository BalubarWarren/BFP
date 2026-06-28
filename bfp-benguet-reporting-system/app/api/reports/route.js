import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { ROLES, REPORT_STATUS, NOTIFICATION_TYPES } from '@/lib/constants';
import generateIncidentReference from '@/lib/incident-reference';

const INVESTIGATION_REPORT_TYPES = [
  'MDFIR',
  'SPOT_INVESTIGATION',
  'PROGRESS_INVESTIGATION',
  'FINAL_INVESTIGATION',
];

const MUNICIPAL_REVIEWER_ROLES = [
  ROLES.MUNICIPAL_CHIEF_IIS,
  ROLES.MUNICIPAL_CHIEF_OPERATION,
  ROLES.MUNICIPAL_FIRE_MARSHAL,
];

const PROVINCIAL_REVIEWER_ROLES = [
  ROLES.PROVINCIAL_CHIEF_IIS,
  ROLES.MARSHAL,
  ROLES.CHIEF_INVESTIGATOR_IIS,
];

const canReceiveRoleInMunicipality = (user, reportMunicipalityId) => {
  if (PROVINCIAL_REVIEWER_ROLES.includes(user.role)) return true;
  return user.municipalityId === reportMunicipalityId;
};

const parseJsonField = (value, fallback = {}) => {
  if (!value) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const sanitizeFileName = (fileName) =>
  fileName.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');

const saveReportAttachments = async (files) => {
  const validFiles = files.filter((file) => file && file.size > 0);
  if (!validFiles.length) return [];

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'reports');
  await mkdir(uploadDir, { recursive: true });

  return Promise.all(
    validFiles.map(async (file) => {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const storedName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${sanitizeFileName(file.name)}`;
      const filePath = path.join(uploadDir, storedName);

      await writeFile(filePath, buffer);

      return {
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        url: `/uploads/reports/${storedName}`,
      };
    })
  );
};

const getInvestigationRecipientWhere = (municipalityId) => ({
  isActive: true,
  OR: [
    { role: ROLES.PROVINCIAL_CHIEF_IIS },
    { role: ROLES.MARSHAL },
    { role: ROLES.MUNICIPAL_CHIEF_IIS, municipalityId },
    { role: ROLES.MUNICIPAL_FIRE_MARSHAL, municipalityId },
    { role: ROLES.MUNICIPAL_CHIEF_OPERATION, municipalityId },
  ].filter((condition) => condition.role),
});

const resolveRecipientByRole = async (role, municipalityId) => {
  if (MUNICIPAL_REVIEWER_ROLES.includes(role)) {
    return prisma.user.findFirst({
      where: {
        role,
        municipalityId,
        isActive: true,
      },
    });
  }

  if (role === ROLES.PROVINCIAL_CHIEF_IIS) {
    return prisma.user.findFirst({
      where: {
        role: ROLES.PROVINCIAL_CHIEF_IIS,
        isActive: true,
      },
    });
  }

  if (role === ROLES.MARSHAL || role === ROLES.CHIEF_INVESTIGATOR_IIS) {
    return prisma.user.findFirst({
      where: {
        role,
        isActive: true,
      },
    });
  }

  return null;
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

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('reportType');
    const status = searchParams.get('status');
    const municipalityId = searchParams.get('municipalityId');
    const view = searchParams.get('view'); // incoming | outgoing | all

    let whereCondition = {};

    // RBAC: Investigators can only see their own reports
    if (user.role === ROLES.INVESTIGATOR) {
      whereCondition.submittedById = user.id;
    } else if (MUNICIPAL_REVIEWER_ROLES.includes(user.role)) {
      // Municipal reviewers: show outgoing reports they reviewed, or incoming reports assigned to
      // their account/role in their municipality.
      if (view === 'outgoing') {
        whereCondition.reviewedById = user.id;
      } else {
        whereCondition.OR = [
          { passedToId: user.id },
          { passedToRole: user.role },
        ];
      }
      whereCondition.municipalityId = user.municipalityId;
    } else if (PROVINCIAL_REVIEWER_ROLES.includes(user.role)) {
      // Provincial/legacy reviewers: show outgoing or reports passed to them by id OR passed to their role
      if (view === 'outgoing') {
        whereCondition.reviewedById = user.id;
      } else {
        whereCondition.OR = [
          { passedToId: user.id },
          { passedToRole: user.role },
        ];
      }
    } else {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Optional filters
    if (reportType) whereCondition.reportType = reportType;
    if (status) whereCondition.status = status;
    if (municipalityId && PROVINCIAL_REVIEWER_ROLES.includes(user.role)) {
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

    // Allowed workflow submitters
    if (![ROLES.INVESTIGATOR, ROLES.MUNICIPAL_CHIEF_IIS, ROLES.MUNICIPAL_CHIEF_OPERATION, ROLES.MUNICIPAL_FIRE_MARSHAL, ROLES.PROVINCIAL_CHIEF_IIS, ROLES.MARSHAL].includes(user.role)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const contentType = request.headers.get('content-type') || '';
    const isMultipart = contentType.includes('multipart/form-data');
    const formData = isMultipart ? await request.formData() : null;
    const body = isMultipart
      ? Object.fromEntries(formData.entries())
      : await request.json();

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
      passedToRole: requestedPassedToRole,
      passedToId: requestedPassedToId,
    } = body;

    const parsedMunicipalityId = parseInt(municipalityId);
    const parsedIncidentId = incidentId ? parseInt(incidentId) : null;
    const parsedContent = parseJsonField(content, {});
    const attachments = isMultipart
      ? await saveReportAttachments(formData.getAll('attachments'))
      : parseJsonField(body.attachments, []);

    // Validate required fields
    if (!reportType || !municipalityId || !reportDate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Municipal roles can only submit for their own municipality
    if (
      [ROLES.INVESTIGATOR, ROLES.MUNICIPAL_CHIEF_IIS, ROLES.MUNICIPAL_CHIEF_OPERATION, ROLES.MUNICIPAL_FIRE_MARSHAL].includes(user.role) &&
      user.municipalityId !== parsedMunicipalityId
    ) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    let passedToRole = requestedPassedToRole || null;
    let passedToId = requestedPassedToId ? parseInt(requestedPassedToId) : null;

    const defaultRecipientRole = user.role === ROLES.INVESTIGATOR ? ROLES.MUNICIPAL_CHIEF_IIS : null;
    const targetRecipientRole = requestedPassedToRole || defaultRecipientRole;

    if (targetRecipientRole) {
      const recipient = await resolveRecipientByRole(targetRecipientRole, parsedMunicipalityId);

      if (!recipient || !canReceiveRoleInMunicipality(recipient, parsedMunicipalityId)) {
        return NextResponse.json(
          { error: `No ${targetRecipientRole} account is available for this report` },
          { status: 400 }
        );
      }

      passedToRole = targetRecipientRole;
      passedToId = recipient.id;
    }

    const report = await prisma.report.create({
      data: {
        reportType,
        municipalityId: parsedMunicipalityId,
        incidentId: parsedIncidentId,
        reportDate: new Date(reportDate),
        content: JSON.stringify(parsedContent),
        respondingUnits,
        respondingOfficer,
        reportingOfficerRank,
        stationCommanderName,
        attachments: attachments.length ? JSON.stringify(attachments) : null,
        passedToRole,
        passedToId,
        status: REPORT_STATUS.SUBMITTED,
        submittedById: user.id,
      },
      include: {
        municipality: true,
        submittedBy: true,
        incident: true,
        passedTo: true,
      },
    });

    if (passedToId) {
      await prisma.notification.create({
        data: {
          userId: parseInt(passedToId),
          message: `New ${reportType} report submitted by ${user.name}`,
          type: NOTIFICATION_TYPES.REPORT_SUBMITTED,
          reportId: report.id,
        },
      });
    } else if (user.role === ROLES.INVESTIGATOR && INVESTIGATION_REPORT_TYPES.includes(reportType)) {
        const recipients = await prisma.user.findMany({
          where: getInvestigationRecipientWhere(parsedMunicipalityId),
          select: { id: true },
        });
        const uniqueRecipientIds = [...new Set(recipients.map((recipient) => recipient.id))];

        if (uniqueRecipientIds.length) {
          await prisma.notification.createMany({
            data: uniqueRecipientIds.map((userId) => ({
              userId,
              message: `New ${reportType} report submitted by ${user.name}`,
              type: NOTIFICATION_TYPES.REPORT_SUBMITTED,
              reportId: report.id,
            })),
          });
        }
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
