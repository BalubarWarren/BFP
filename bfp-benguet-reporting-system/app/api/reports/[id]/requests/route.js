import { getReportLabel } from '../../../../../lib/report-label';
import { NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import { getUserFromRequest } from '../../../../../lib/auth';
import { ROLES } from '../../../../../lib/constants';
import { canUserViewReport } from '../../../../../lib/report-view-access';
import { isStoredAttachmentUrl } from '../../../../../lib/storage';
import {
  REQUEST_STATUS,
  REQUEST_TYPES,
  canEditAsInvestigator,
  isFinallyApproved,
  listRequestsForReport,
  notifyDeciders,
} from '../../../../../lib/report-requests';

const MISSING_TABLE_ERROR =
  'This feature needs a database update. Ask the administrator to run the latest migration (report_requests).';

// GET: the report's reopen / co-investigator requests (anyone who can view the report).
export async function GET(request, { params }) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const report = await prisma.report.findUnique({ where: { id: parseInt(params.id, 10) } });
  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  if (!(await canUserViewReport(report, user))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  return NextResponse.json({ requests: await listRequestsForReport(report.id) });
}

// POST { type: 'REOPEN', reason }
// POST { type: 'COLLABORATOR', targetUserId, reason?, document: { url, name } }
export async function POST(request, { params }) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== ROLES.INVESTIGATOR) {
    return NextResponse.json({ error: 'Only investigators can make this request.' }, { status: 403 });
  }

  const report = await prisma.report.findUnique({ where: { id: parseInt(params.id, 10) } });
  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 1000) : '';

  try {
    if (body.type === REQUEST_TYPES.REOPEN) {
      if (!(await canEditAsInvestigator(report, user))) {
        return NextResponse.json({ error: 'Only the investigators handling this report can ask to reopen it.' }, { status: 403 });
      }
      if (report.reportType !== 'FINAL_INVESTIGATION' || !isFinallyApproved(report)) {
        return NextResponse.json({ error: 'Only a Final Investigation Report with final approval can be reopened.' }, { status: 400 });
      }
      if (reason.length < 10) {
        return NextResponse.json({ error: 'Explain why the report needs to be reopened (at least 10 characters).' }, { status: 400 });
      }
      const pending = await prisma.reportRequest.findFirst({
        where: { reportId: report.id, type: REQUEST_TYPES.REOPEN, status: REQUEST_STATUS.PENDING },
        select: { id: true },
      });
      if (pending) return NextResponse.json({ error: 'A request to reopen this report is already waiting for a decision.' }, { status: 409 });

      const created = await prisma.reportRequest.create({
        data: {
          type: REQUEST_TYPES.REOPEN,
          reportId: report.id,
          municipalityId: report.municipalityId,
          requestedById: user.id,
          reason,
        },
      });
      await prisma.auditLog.create({
        data: { action: 'REQUEST_REOPEN_REPORT', userId: user.id, reportId: report.id, changes: JSON.stringify({ requestId: created.id, reason }) },
      });
      const notified = await notifyDeciders({
        municipalityId: report.municipalityId,
        reportId: report.id,
        message: `${user.name} asks to reopen ${await getReportLabel(report.id, 'Final Investigation Report')}: ${reason}`,
      });
      return NextResponse.json({ request: created, notified }, { status: 201 });
    }

    if (body.type === REQUEST_TYPES.COLLABORATOR) {
      if (report.submittedById !== user.id) {
        return NextResponse.json({ error: 'Only the investigator who submitted the report can add a co-investigator.' }, { status: 403 });
      }
      if (isFinallyApproved(report)) {
        return NextResponse.json({ error: 'This report already has final approval. Ask to reopen it first.' }, { status: 400 });
      }
      const targetUserId = parseInt(body.targetUserId, 10);
      const target = targetUserId
        ? await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true, name: true, role: true, isActive: true, municipalityId: true } })
        : null;
      if (!target || target.id === user.id || target.role !== ROLES.INVESTIGATOR || !target.isActive || target.municipalityId !== report.municipalityId) {
        return NextResponse.json({ error: 'Choose an active investigator from this municipality.' }, { status: 400 });
      }
      const document = body.document || {};
      if (!isStoredAttachmentUrl(document.url)) {
        return NextResponse.json({ error: 'Attach the Letter of Order.' }, { status: 400 });
      }
      const existing = await prisma.reportRequest.findFirst({
        where: {
          reportId: report.id,
          type: REQUEST_TYPES.COLLABORATOR,
          targetUserId: target.id,
          status: { in: [REQUEST_STATUS.PENDING, REQUEST_STATUS.APPROVED] },
        },
        select: { status: true },
      });
      if (existing) {
        return NextResponse.json(
          { error: existing.status === REQUEST_STATUS.APPROVED ? `${target.name} can already edit this report.` : `A request for ${target.name} is already waiting for a decision.` },
          { status: 409 }
        );
      }

      const created = await prisma.reportRequest.create({
        data: {
          type: REQUEST_TYPES.COLLABORATOR,
          reportId: report.id,
          municipalityId: report.municipalityId,
          requestedById: user.id,
          targetUserId: target.id,
          reason: reason || null,
          documentUrl: document.url,
          documentName: String(document.name || 'Letter of Order').slice(0, 200),
        },
      });
      await prisma.auditLog.create({
        data: {
          action: 'REQUEST_REPORT_COLLABORATOR',
          userId: user.id,
          reportId: report.id,
          changes: JSON.stringify({ requestId: created.id, targetUserId: target.id }),
        },
      });
      const notified = await notifyDeciders({
        municipalityId: report.municipalityId,
        reportId: report.id,
        message: `${user.name} asks to let ${target.name} co-edit ${await getReportLabel(report.id)} (Letter of Order attached).`,
      });
      return NextResponse.json({ request: created, notified }, { status: 201 });
    }

    return NextResponse.json({ error: 'Unknown request type' }, { status: 400 });
  } catch (error) {
    if (error?.code === 'P2021') return NextResponse.json({ error: MISSING_TABLE_ERROR }, { status: 503 });
    console.error('Error creating report request:', error);
    return NextResponse.json({ error: 'Could not send the request. Please try again.' }, { status: 500 });
  }
}
