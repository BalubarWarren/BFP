import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { getUserFromRequest } from '../../../lib/auth';
import { ROLES, REPORT_STATUS, NOTIFICATION_TYPES } from '../../../lib/constants';
import { createIncidentWithReference } from '../../../lib/incident-reference';
import { filterDemoReports, getDemoReportsForUser } from '../../../lib/demo-reports';
import { saveAttachments } from '../../../lib/storage';
import { MUNICIPAL_REVIEWER_ROLES, PROVINCIAL_REVIEWER_ROLES } from '../../../lib/report-access';

// Safety cap on list results — orderBy is already createdAt desc, so this returns the most
// recent reports rather than silently truncating in an unpredictable order.
const MAX_LIST_RESULTS = 200;

const INVESTIGATION_REPORT_TYPES = [
  'MDFIR',
  'SPOT_INVESTIGATION',
  'PROGRESS_INVESTIGATION',
  'FINAL_INVESTIGATION',
];

const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN];

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

// `excludeUserId` keeps a reviewer-tier submitter (Chief IIS, Fire Marshal, etc.) from ever being
// resolved as their own report's recipient — without it, a municipality with only one holder of a
// role could route a report straight back to whoever just submitted it.
const resolveRecipientByRole = async (role, municipalityId, excludeUserId) => {
  const notSelf = excludeUserId ? { id: { not: excludeUserId } } : {};

  if (MUNICIPAL_REVIEWER_ROLES.includes(role)) {
    return prisma.user.findFirst({
      where: {
        role,
        municipalityId,
        isActive: true,
        ...notSelf,
      },
    });
  }

  if (role === ROLES.PROVINCIAL_CHIEF_IIS) {
    return prisma.user.findFirst({
      where: {
        role: ROLES.PROVINCIAL_CHIEF_IIS,
        isActive: true,
        ...notSelf,
      },
    });
  }

  if (role === ROLES.MARSHAL || role === ROLES.CHIEF_INVESTIGATOR_IIS) {
    return prisma.user.findFirst({
      where: {
        role,
        isActive: true,
        ...notSelf,
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

    // A reviewer's "reviewed" copy needs to survive later reviewers touching the same report —
    // see the AuditLog write in POST /api/reports/[id]/approve for why this can't just be
    // Report.reviewedById (which is intentionally overwritten by every subsequent review).
    let reviewedReportIds = null;
    if (view === 'outgoing' && (MUNICIPAL_REVIEWER_ROLES.includes(user.role) || PROVINCIAL_REVIEWER_ROLES.includes(user.role))) {
      const reviewLogs = await prisma.auditLog.findMany({
        where: { userId: user.id, action: { in: ['APPROVE_REPORT', 'RETURN_REPORT'] } },
        select: { reportId: true },
        distinct: ['reportId'],
      });
      reviewedReportIds = reviewLogs.map((log) => log.reportId).filter((id) => id !== null);
    }

    let whereCondition = {};

    // RBAC: Investigators can only see their own reports
    if (user.role === ROLES.INVESTIGATOR) {
      whereCondition.submittedById = user.id;
    } else if (ADMIN_ROLES.includes(user.role)) {
      // Admins see ALL reports — no where filter (view=all returns everything)
      whereCondition = {};
    } else if (MUNICIPAL_REVIEWER_ROLES.includes(user.role)) {
      // Municipal reviewers: show outgoing reports they reviewed, or incoming reports assigned to
      // their account/role in their municipality.
      if (view === 'outgoing') {
        whereCondition.id = { in: reviewedReportIds };
      } else {
        whereCondition.OR = [
          {
            AND: [
              { municipalityId: user.municipalityId },
              {
                OR: [
                  { passedToId: user.id },
                  { passedToRole: user.role },
                ],
              },
            ],
          },
          {
            notifications: {
              some: {
                userId: user.id,
                type: NOTIFICATION_TYPES.REPORT_TEXT_BLAST,
              },
            },
          },
        ];
      }
    } else if (PROVINCIAL_REVIEWER_ROLES.includes(user.role)) {
      // Provincial/legacy reviewers: show outgoing or reports passed to them by id OR passed to their role
      if (view === 'outgoing') {
        whereCondition.id = { in: reviewedReportIds };
      } else {
        whereCondition.OR = [
          { passedToId: user.id },
          { passedToRole: user.role },
          {
            notifications: {
              some: {
                userId: user.id,
                type: NOTIFICATION_TYPES.REPORT_TEXT_BLAST,
              },
            },
          },
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
    if (municipalityId && (PROVINCIAL_REVIEWER_ROLES.includes(user.role) || ADMIN_ROLES.includes(user.role))) {
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
            role: true,
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
      take: MAX_LIST_RESULTS,
    });

    const demoReports = filterDemoReports(
      getDemoReportsForUser(user),
      { reportType, status, view }
    );

    return NextResponse.json({
      reports: [...demoReports, ...reports],
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
      category,
      subCategory,
      respondingUnits,
      respondingOfficer,
      reportingOfficerRank,
      stationCommanderName,
      passedToRole: requestedPassedToRole,
    } = body;

    const parsedMunicipalityId = parseInt(municipalityId);
    const parsedIncidentId = incidentId ? parseInt(incidentId) : null;
    const parsedContent = parseJsonField(content, {});

    let attachments;
    if (isMultipart) {
      try {
        attachments = await saveAttachments(formData.getAll('attachments'), 'reports');
      } catch (uploadError) {
        return NextResponse.json({ error: uploadError.message }, { status: 400 });
      }
    } else {
      attachments = parseJsonField(body.attachments, []);
    }

    // Validate required fields
    if (!reportType || !municipalityId || !reportDate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!attachments.length) {
      return NextResponse.json(
        { error: 'At least one attachment is required.' },
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

    // The recipient is always resolved server-side from a role — a raw client-supplied
    // passedToId is never trusted, since nothing would otherwise stop a reviewer-tier submitter
    // (Chief IIS, Fire Marshal, etc.) from routing a report straight to their own account and
    // self-approving it via /approve.
    let passedToRole = null;
    let passedToId = null;

    const defaultRecipientRole = user.role === ROLES.INVESTIGATOR ? ROLES.MUNICIPAL_CHIEF_IIS : null;
    const targetRecipientRole = requestedPassedToRole || defaultRecipientRole;

    if (targetRecipientRole) {
      const recipient = await resolveRecipientByRole(targetRecipientRole, parsedMunicipalityId, user.id);

      if (!recipient || !canReceiveRoleInMunicipality(recipient, parsedMunicipalityId)) {
        return NextResponse.json(
          { error: `No ${targetRecipientRole} account is available for this report` },
          { status: 400 }
        );
      }

      passedToRole = targetRecipientRole;
      passedToId = recipient.id;
    }

    // A Spot Investigation is the entry point into a case — auto-create the linked Incident
    // from the same fields the form already collects, so later Progress/Final reports (and the
    // overdue-check job) have a stable case to hang off of.
    let effectiveIncidentId = parsedIncidentId;
    if (reportType === 'SPOT_INVESTIGATION' && !effectiveIncidentId) {
      const incident = await createIncidentWithReference({
        municipalityId: parsedMunicipalityId,
        dateOfIncident: new Date(parsedContent.dateOfIncident || reportDate),
        timeOfIncident: parsedContent.timeOfIncident || null,
        generalCategory: category,
        subCategory: subCategory || null,
        description: parsedContent.description || null,
        createdById: user.id,
      });
      effectiveIncidentId = incident.id;
    }

    const report = await prisma.report.create({
      data: {
        reportType,
        municipalityId: parsedMunicipalityId,
        incidentId: effectiveIncidentId,
        reportDate: new Date(reportDate),
        content: JSON.stringify(parsedContent),
        category: category || null,
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
