import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { getSubmissionTimeliness, getFollowUpDelay, getSubmissionDeadline, LATE_EXPLANATION_MIN_LENGTH } from '../../../lib/report-timeliness';
import { getCollaboratingReportIds } from '../../../lib/report-requests';
import { getUserFromRequest, PUBLIC_USER_SELECT } from '../../../lib/auth';
import { ROLES, REPORT_STATUS, REPORT_TYPES, NOTIFICATION_TYPES, MAX_REPORT_ATTACHMENTS, attachmentKindFields, canViewArchive, isMainAttachment, ASSIGNABLE_REPORT_TYPES, DIRECTIVE_KINDS, DIRECTIVE_STATUS } from '../../../lib/constants';
import { createIncidentWithReference } from '../../../lib/incident-reference';
import { filterDemoReports, getDemoReportsForUser } from '../../../lib/demo-reports';
import { saveAttachments, isStoredAttachmentUrl } from '../../../lib/storage';
import { notifyReportRecipients } from '../../../lib/report-notifications';
import { generateQrToken } from '../../../lib/qr-token';
import {
  MUNICIPAL_REVIEWER_ROLES,
  PROVINCIAL_REVIEWER_ROLES,
  canViewApprovedArchive,
  approvedArchiveWhere,
  FINALLY_APPROVED_WHERE,
} from '../../../lib/report-access';

// Safety cap on list results — orderBy is already createdAt desc, so this returns the most
// recent reports rather than silently truncating in an unpredictable order.
const MAX_LIST_RESULTS = 200;
const MAX_ATTACHMENTS = MAX_REPORT_ATTACHMENTS;

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
    const view = searchParams.get('view'); // incoming | outgoing | approved | all

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

    // The shared Reports archive: every report that cleared final (Provincial Chief IIS) approval,
    // read by the provincial reviewer plus the two municipal reviewers who signed off earlier in
    // the chain. This branch comes first because it deliberately ignores the per-role "is it
    // assigned to me" routing below — a finished report is assigned to nobody.
    if (view === 'approved') {
      // The Archive page (/archive). Investigators see their own finished reports (including ones
      // they co-investigate); reviewers and admins as scoped by approvedArchiveWhere.
      if (user.role === ROLES.INVESTIGATOR) {
        const collaboratingIds = await getCollaboratingReportIds(user.id);
        whereCondition = {
          ...FINALLY_APPROVED_WHERE,
          OR: [{ submittedById: user.id }, ...(collaboratingIds.length ? [{ id: { in: collaboratingIds } }] : [])],
        };
      } else if (canViewApprovedArchive(user) || canViewArchive(user.role)) {
        whereCondition = approvedArchiveWhere(user);
      } else {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else if (user.role === ROLES.INVESTIGATOR) {
      // RBAC: Investigators see their own reports, plus the ones they co-edit by approved Letter
      // of Order (lib/report-requests.js).
      const collaboratingIds = await getCollaboratingReportIds(user.id);
      if (collaboratingIds.length) {
        whereCondition.OR = [{ submittedById: user.id }, { id: { in: collaboratingIds } }];
      } else {
        whereCondition.submittedById = user.id;
      }
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
    // `status` is ignored for the approved archive — letting it through would overwrite the
    // status: APPROVED the archive's where clause is built on, turning a read-only archive of
    // finished reports into an unrestricted list of every report in the province.
    if (status && view !== 'approved') whereCondition.status = status;
    if (municipalityId && (PROVINCIAL_REVIEWER_ROLES.includes(user.role) || ADMIN_ROLES.includes(user.role))) {
      whereCondition.municipalityId = parseInt(municipalityId);
    }

    // select (not include) — this list is polled every 15s from the municipal/admin/provincial
    // dashboards, up to MAX_LIST_RESULTS rows at a time; `content` is dropped since nothing in any
    // list view reads it (only the single-report detail fetch, GET /api/reports/[id], does).
    // `attachments` stays: a couple of report-detail modals fall back to it from the list payload
    // while their own detail fetch is still in flight.
    const reports = await prisma.report.findMany({
      where: whereCondition,
      select: {
        id: true,
        reportType: true,
        status: true,
        municipalityId: true,
        reportDate: true,
        category: true,
        respondingUnits: true,
        respondingOfficer: true,
        reportingOfficerRank: true,
        stationCommanderName: true,
        remarks: true,
        passedToRole: true,
        passedToId: true,
        submittedAt: true,
        reviewedAt: true,
        reviewedById: true,
        submittedById: true,
        attachments: true,
        qrToken: true,
        createdAt: true,
        updatedAt: true,
        incidentId: true,
        municipality: { select: { id: true, name: true } },
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
        // dateOfIncident/barangay/address/subCategory feed the shared report search
        // (lib/report-search.js): incident date, location and classification filters.
        incident: {
          select: {
            id: true,
            referenceNumber: true,
            generalCategory: true,
            subCategory: true,
            status: true,
            dateOfIncident: true,
            timeOfIncident: true,
            barangay: true,
            address: true,
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

    // Red/green timeliness for every listed report (lib/report-timeliness.js): was it submitted
    // within its deadline, and — for a finalized Spot/Progress report — is the case's next
    // report overdue. One query for the cases' other reports.
    const incidentIds = [...new Set(reports.map((r) => r.incidentId).filter(Boolean))];
    const caseRows = incidentIds.length
      ? await prisma.report.findMany({
          where: { incidentId: { in: incidentIds } },
          select: { id: true, incidentId: true, reportType: true, status: true, passedToId: true, reviewedAt: true, submittedAt: true },
        })
      : [];
    const caseByIncident = new Map();
    for (const row of caseRows) {
      if (!caseByIncident.has(row.incidentId)) caseByIncident.set(row.incidentId, []);
      caseByIncident.get(row.incidentId).push(row);
    }
    const now = new Date();
    const withTimeliness = reports.map((report) => {
      const caseReports = (caseByIncident.get(report.incidentId) || []).filter((r) => r.id !== report.id);
      return {
        ...report,
        timeliness: getSubmissionTimeliness(report, { incident: report.incident, caseReports }),
        followUpDelay: getFollowUpDelay(report, caseReports, now),
      };
    });

    return NextResponse.json({
      reports: [...demoReports, ...withTimeliness],
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}

// A casualty count from the Spot/Final form: a whole number 0..9999, or null when not given.
const toCasualtyCount = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 9999 ? n : null;
};

// Submitting a report the Fire Marshal assigned completes that assignment (the oldest open one of
// the same report type) and tells the Fire Marshal. Never fails the submission itself.
async function completeAssignment(user, reportType, reportId) {
  if (!ASSIGNABLE_REPORT_TYPES[reportType]) return;
  try {
    const assignment = await prisma.directive.findFirst({
      where: {
        recipientId: user.id,
        kind: DIRECTIVE_KINDS.ASSIGNMENT,
        reportType,
        status: { in: [DIRECTIVE_STATUS.PENDING, DIRECTIVE_STATUS.ACKNOWLEDGED] },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, senderId: true },
    });
    if (!assignment) return;
    await prisma.directive.update({
      where: { id: assignment.id },
      data: { status: DIRECTIVE_STATUS.COMPLETED, respondedAt: new Date() },
    });
    await prisma.notification.create({
      data: {
        userId: assignment.senderId,
        reportId,
        message: `${user.name} submitted the ${ASSIGNABLE_REPORT_TYPES[reportType].label} report you assigned.`,
        type: NOTIFICATION_TYPES.DIRECTIVE_UPDATED,
      },
    });
  } catch (error) {
    console.error('Failed to complete the assignment:', error);
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

    // Multipart files are only uploaded once every other check below has passed, so a rejected
    // submission doesn't leave orphaned files behind in storage.
    const realFiles = (entries) => entries.filter((file) => file && typeof file === 'object' && file.size > 0);
    const uploadedFiles = isMultipart ? realFiles(formData.getAll('attachments')) : [];
    // Optional EMS (Emergency Medical Services) report files — kept in the same attachments array,
    // tagged kind: 'EMS' (see components/reports/AttachmentList.jsx).
    const uploadedEmsFiles = isMultipart ? realFiles(formData.getAll('emsAttachments')) : [];
    // Supporting documents (lab results, certificates...), each with its docType in the same order.
    const uploadedSupportingFiles = isMultipart ? realFiles(formData.getAll('supportingAttachments')) : [];
    const supportingDocTypes = isMultipart ? formData.getAll('supportingDocTypes').map(String) : [];
    let attachments = [];
    if (!isMultipart) {
      attachments = parseJsonField(body.attachments, []);
      // JSON submissions carry attachment objects for files the browser already uploaded straight
      // to storage (see lib/submit-report.js) — only accept ones pointing at our own bucket, since
      // reviewers open these URLs as links (a `javascript:` or phishing URL here would otherwise be
      // one click away for them).
      if (
        !Array.isArray(attachments) ||
        attachments.length > MAX_ATTACHMENTS ||
        !attachments.every((attachment) => isStoredAttachmentUrl(attachment?.url))
      ) {
        return NextResponse.json({ error: 'Invalid attachment' }, { status: 400 });
      }
      attachments = attachments.map((attachment) => ({
        name: String(attachment.name || 'attachment').slice(0, 200),
        type: String(attachment.type || 'application/octet-stream'),
        size: Number(attachment.size) || 0,
        url: attachment.url,
        ...attachmentKindFields(attachment),
      }));
    }

    // Validate required fields
    if (!reportType || !municipalityId || !reportDate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!Object.values(REPORT_TYPES).includes(reportType)) {
      return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
    }

    if (Number.isNaN(parsedMunicipalityId) || Number.isNaN(new Date(reportDate).getTime())) {
      return NextResponse.json({ error: 'Invalid municipality or report date' }, { status: 400 });
    }

    // A client-supplied incidentId must belong to the same municipality — otherwise a report
    // could be filed under another municipality's case.
    if (parsedIncidentId) {
      const incident = await prisma.incident.findUnique({
        where: { id: parsedIncidentId },
        select: { municipalityId: true },
      });
      if (!incident || incident.municipalityId !== parsedMunicipalityId) {
        return NextResponse.json({ error: 'Invalid incident for this municipality' }, { status: 400 });
      }
    }

    // Progress and Final reports continue a case opened by a Spot report, so they must be linked
    // to its incident. That link is what ties Spot -> Progress -> Final together everywhere.
    const isFollowUpReport = ['PROGRESS_INVESTIGATION', 'FINAL_INVESTIGATION'].includes(reportType);
    if (isFollowUpReport && !parsedIncidentId) {
      return NextResponse.json(
        { error: 'Select the case (from its Spot report) this report continues.' },
        { status: 400 }
      );
    }
    if (isFollowUpReport) {
      const existingFinal = await prisma.report.findFirst({
        where: { incidentId: parsedIncidentId, reportType: 'FINAL_INVESTIGATION', status: { not: REPORT_STATUS.DRAFT } },
        select: { id: true },
      });
      if (existingFinal) {
        return NextResponse.json(
          { error: 'A Final Investigation Report has already been filed for this case, so it is closed.' },
          { status: 400 }
        );
      }
      // The case must have started with a Spot report that cleared final approval — the same
      // point the "Start Progress/Final Report" button appears — so a follow-up can never be
      // filed under an incident with no (or an unapproved) Spot report.
      const approvedSpot = await prisma.report.findFirst({
        where: {
          incidentId: parsedIncidentId,
          reportType: 'SPOT_INVESTIGATION',
          status: REPORT_STATUS.APPROVED,
          passedToId: null,
        },
        select: { id: true },
      });
      if (!approvedSpot) {
        return NextResponse.json(
          { error: "This case's Spot report hasn't received final approval yet, so it can't be continued." },
          { status: 400 }
        );
      }
      // One Progress report per case, and the Final report follows it: Final is filed from the
      // Progress report once that's fully approved (or straight from the Spot report if the case
      // skipped Progress).
      const progressReports = await prisma.report.findMany({
        where: { incidentId: parsedIncidentId, reportType: 'PROGRESS_INVESTIGATION', status: { not: REPORT_STATUS.DRAFT } },
        select: { id: true, status: true, passedToId: true },
      });
      if (reportType === 'PROGRESS_INVESTIGATION' && progressReports.length) {
        return NextResponse.json(
          { error: `A Progress report (#${progressReports[0].id}) was already filed for this case. Continue from it with the Final report.` },
          { status: 400 }
        );
      }
      const pendingProgress = progressReports.find((r) => !(r.status === REPORT_STATUS.APPROVED && !r.passedToId));
      if (reportType === 'FINAL_INVESTIGATION' && pendingProgress) {
        return NextResponse.json(
          { error: `This case's Progress report (#${pendingProgress.id}) needs final approval before the Final report can be filed.` },
          { status: 400 }
        );
      }
    }

    // Submitted after its deadline (lib/report-timeliness.js): the investigator must explain the
    // delay — the Explanation Report the BFP requires — which travels with the report to every
    // reviewer (content.lateExplanation).
    if (['SPOT_INVESTIGATION', 'PROGRESS_INVESTIGATION', 'FINAL_INVESTIGATION'].includes(reportType)) {
      const deadline = getSubmissionDeadline(reportType, {
        incident: {
          dateOfIncident: parsedContent.dateOfIncident || reportDate,
          timeOfIncident: parsedContent.timeOfIncident || null,
        },
        caseReports: isFollowUpReport
          ? await prisma.report.findMany({
              where: { incidentId: parsedIncidentId },
              select: { reportType: true, status: true, passedToId: true, reviewedAt: true },
            })
          : [],
      });
      const explanation = typeof parsedContent.lateExplanation === 'string' ? parsedContent.lateExplanation.trim().slice(0, 4000) : '';
      if (deadline && new Date() > deadline) {
        if (explanation.length < LATE_EXPLANATION_MIN_LENGTH) {
          return NextResponse.json(
            {
              error: `This report is past its deadline (${deadline.toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}). Write an explanation for the late submission before submitting.`,
              code: 'LATE_EXPLANATION_REQUIRED',
              deadline,
            },
            { status: 400 }
          );
        }
        parsedContent.lateExplanation = explanation;
        parsedContent.submittedLate = true;
      } else {
        delete parsedContent.lateExplanation;
      }
    }

    // The EMS report is optional and doesn't count — the investigation report itself is required.
    if (!attachments.some(isMainAttachment) && !uploadedFiles.length) {
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

    if (isMultipart) {
      try {
        if (uploadedFiles.length + uploadedEmsFiles.length + uploadedSupportingFiles.length > MAX_ATTACHMENTS) {
          return NextResponse.json({ error: `You can attach at most ${MAX_ATTACHMENTS} files.` }, { status: 400 });
        }
        const [mainSaved, emsSaved, supportingSaved] = await Promise.all([
          saveAttachments(uploadedFiles, 'reports'),
          saveAttachments(uploadedEmsFiles, 'reports'),
          saveAttachments(uploadedSupportingFiles, 'reports'),
        ]);
        attachments = [
          ...mainSaved,
          ...emsSaved.map((attachment) => ({ ...attachment, kind: 'EMS' })),
          ...supportingSaved.map((attachment, index) => ({
            ...attachment,
            ...attachmentKindFields({ kind: 'SUPPORTING', docType: supportingDocTypes[index] }),
          })),
        ];
      } catch (uploadError) {
        return NextResponse.json({ error: uploadError.message }, { status: 400 });
      }
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
        barangay: typeof parsedContent.barangay === 'string' ? parsedContent.barangay.trim().slice(0, 100) || null : null,
        address: typeof parsedContent.address === 'string' ? parsedContent.address.trim().slice(0, 200) || null : null,
        casualtiesInjured: toCasualtyCount(parsedContent.casualtiesInjured) ?? 0,
        casualtiesFatalities: toCasualtyCount(parsedContent.casualtiesFatalities) ?? 0,
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
        // Issued the moment the investigator passes the report, and kept for life — see lib/qr-token.js.
        qrToken: generateQrToken(),
      },
      include: {
        municipality: true,
        submittedBy: { select: PUBLIC_USER_SELECT },
        incident: true,
        passedTo: { select: PUBLIC_USER_SELECT },
      },
    });

    // The Final report may correct the case's casualty counts (blank on the form = keep the Spot
    // report's numbers). They live on the incident, which feeds the Casualty Monitoring Board.
    if (reportType === 'FINAL_INVESTIGATION' && effectiveIncidentId) {
      const finalInjured = toCasualtyCount(parsedContent.casualtiesInjured);
      const finalFatalities = toCasualtyCount(parsedContent.casualtiesFatalities);
      // The cause of fire found by the investigation (dashboard "Causes of Fire").
      const causeOfFire = typeof parsedContent.causeOfFire === 'string' ? parsedContent.causeOfFire.trim().slice(0, 200) : '';
      if (finalInjured !== null || finalFatalities !== null || causeOfFire) {
        await prisma.incident.update({
          where: { id: effectiveIncidentId },
          data: {
            ...(finalInjured !== null && { casualtiesInjured: finalInjured }),
            ...(finalFatalities !== null && { casualtiesFatalities: finalFatalities }),
            ...(causeOfFire && { causeOfFire }),
          },
        });
      }
    }

    if (passedToId) {
      await notifyReportRecipients({
        report,
        message: `New ${reportType} report submitted by ${user.name}`,
        type: NOTIFICATION_TYPES.REPORT_SUBMITTED,
        excludeUserId: user.id,
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

    if (user.role === ROLES.INVESTIGATOR) {
      await completeAssignment(user, reportType, report.id);
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
