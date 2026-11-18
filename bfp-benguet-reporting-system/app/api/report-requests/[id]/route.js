import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getUserFromRequest } from '../../../../lib/auth';
import { REPORT_STATUS } from '../../../../lib/constants';
import {
  REQUEST_DECIDER_ROLES,
  REQUEST_STATUS,
  REQUEST_TYPES,
  getRequest,
  isFinallyApproved,
  notifyUsers,
} from '../../../../lib/report-requests';

// PATCH { action, note? }
//   APPROVE / DECLINE  the Municipal Chief IIS of the request's municipality, while PENDING
//   REVOKE             an approved co-investigator: that Chief IIS, or the report's submitter
//   CANCEL             the requester withdraws a PENDING request
export async function PATCH(request, { params }) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let req;
  try {
    req = await getRequest(parseInt(params.id, 10));
  } catch (error) {
    if (error?.code === 'P2021') return NextResponse.json({ error: 'Requests are not set up on this database yet.' }, { status: 503 });
    throw error;
  }
  if (!req) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : '';
  const isDecider = REQUEST_DECIDER_ROLES.includes(user.role) && user.municipalityId === req.municipalityId;
  const reportLabel = `report #${req.reportId}`;

  try {
    if (body.action === 'APPROVE' || body.action === 'DECLINE') {
      if (!isDecider) return NextResponse.json({ error: 'Only the Municipal Chief IIS can decide this request.' }, { status: 403 });
      if (req.status !== REQUEST_STATUS.PENDING) {
        return NextResponse.json({ error: 'This request has already been decided.' }, { status: 409 });
      }

      if (body.action === 'DECLINE') {
        await prisma.reportRequest.update({
          where: { id: req.id },
          data: { status: REQUEST_STATUS.DECLINED, decidedById: user.id, decidedAt: new Date(), decisionNote: note || null },
        });
        await prisma.auditLog.create({
          data: { action: 'DECLINE_REPORT_REQUEST', userId: user.id, reportId: req.reportId, changes: JSON.stringify({ requestId: req.id, type: req.type, note }) },
        });
        await notifyUsers([req.requestedById], {
          reportId: req.reportId,
          message: `Your request (${req.type === REQUEST_TYPES.REOPEN ? 'reopen' : `add ${req.targetUser?.name} as co-investigator`}) for ${reportLabel} was declined${note ? `: ${note}` : '.'}`,
        });
        return NextResponse.json({ ok: true });
      }

      // APPROVE
      if (req.type === REQUEST_TYPES.REOPEN) {
        const report = await prisma.report.findUnique({ where: { id: req.reportId } });
        if (!report || !isFinallyApproved(report)) {
          return NextResponse.json({ error: 'This report is no longer in its finalized state, so it cannot be reopened.' }, { status: 409 });
        }
        // Back to the investigator as RETURNED, with the Chief IIS as the reviewer of record, so
        // the revision is resubmitted to this tier and climbs the whole review chain again.
        // Revising it archives the finalized version first (PATCH /api/reports/[id]).
        await prisma.$transaction([
          prisma.report.update({
            where: { id: report.id },
            data: {
              status: REPORT_STATUS.RETURNED,
              passedToRole: 'INVESTIGATOR',
              passedToId: report.submittedById,
              reviewedById: user.id,
              reviewedAt: new Date(),
              remarks: `Reopened at the investigator's request: ${req.reason}${note ? ` (Chief IIS: ${note})` : ''}`,
            },
          }),
          prisma.reportRequest.update({
            where: { id: req.id },
            data: { status: REQUEST_STATUS.APPROVED, decidedById: user.id, decidedAt: new Date(), decisionNote: note || null },
          }),
          prisma.auditLog.create({
            data: { action: 'REOPEN_REPORT', userId: user.id, reportId: report.id, changes: JSON.stringify({ requestId: req.id, reason: req.reason, note }) },
          }),
        ]);
        await notifyUsers([req.requestedById, report.submittedById], {
          reportId: report.id,
          message: `Final Investigation Report #${report.id} was reopened. Revise it and resubmit it for review.`,
        });
        return NextResponse.json({ ok: true });
      }

      await prisma.reportRequest.update({
        where: { id: req.id },
        data: { status: REQUEST_STATUS.APPROVED, decidedById: user.id, decidedAt: new Date(), decisionNote: note || null },
      });
      await prisma.auditLog.create({
        data: { action: 'APPROVE_REPORT_COLLABORATOR', userId: user.id, reportId: req.reportId, changes: JSON.stringify({ requestId: req.id, targetUserId: req.targetUserId, note }) },
      });
      await notifyUsers([req.requestedById], {
        reportId: req.reportId,
        message: `${req.targetUser?.name} can now edit ${reportLabel} with you.`,
      });
      await notifyUsers([req.targetUserId], {
        reportId: req.reportId,
        message: `You were added as co-investigator on ${reportLabel} by Letter of Order. It now appears in My Reports.`,
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'REVOKE') {
      const canRevoke = isDecider || req.report?.submittedById === user.id;
      if (!canRevoke) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      if (req.type !== REQUEST_TYPES.COLLABORATOR || req.status !== REQUEST_STATUS.APPROVED) {
        return NextResponse.json({ error: 'Only an active co-investigator can be removed.' }, { status: 400 });
      }
      await prisma.reportRequest.update({
        where: { id: req.id },
        data: { status: REQUEST_STATUS.REVOKED, decisionNote: note || req.decisionNote },
      });
      await prisma.auditLog.create({
        data: { action: 'REVOKE_REPORT_COLLABORATOR', userId: user.id, reportId: req.reportId, changes: JSON.stringify({ requestId: req.id, targetUserId: req.targetUserId }) },
      });
      await notifyUsers([req.targetUserId], { reportId: null, message: `You can no longer edit ${reportLabel}.` });
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'CANCEL') {
      if (req.requestedById !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      if (req.status !== REQUEST_STATUS.PENDING) return NextResponse.json({ error: 'Only a pending request can be cancelled.' }, { status: 409 });
      await prisma.reportRequest.update({ where: { id: req.id }, data: { status: REQUEST_STATUS.CANCELLED } });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Error updating report request:', error);
    return NextResponse.json({ error: 'Could not update the request. Please try again.' }, { status: 500 });
  }
}
