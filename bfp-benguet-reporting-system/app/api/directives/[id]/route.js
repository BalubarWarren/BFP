import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getUserFromRequest } from '../../../../lib/auth';
import { ROLES, DIRECTIVE_STATUS, DIRECTIVE_KINDS, NOTIFICATION_TYPES, ASSIGNMENT_LABELS } from '../../../../lib/constants';
import { DIRECTIVE_SELECT } from '../../../../lib/directives';

const MAX_RESPONSE_LENGTH = 2000;
const OPEN_STATUSES = [DIRECTIVE_STATUS.PENDING, DIRECTIVE_STATUS.ACKNOWLEDGED];

// The investigator who received a directive can:
//   REPLY  send a reply to the Fire Marshal (an unread directive becomes ACKNOWLEDGED: received)
//   START  open the assigned report form (the assignment becomes ACKNOWLEDGED: read)
// An assignment becomes COMPLETED on its own when the investigator submits that report (see
// completeAssignment in app/api/reports/route.js). The Fire Marshal can only cancel an open directive.
export async function PATCH(request, { params }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = parseInt(params.id);
    const directive = Number.isNaN(id)
      ? null
      : await prisma.directive.findUnique({ where: { id }, select: DIRECTIVE_SELECT });
    if (!directive) {
      return NextResponse.json({ error: 'Directive not found' }, { status: 404 });
    }

    const isRecipient = directive.recipientId === user.id;
    const isMarshal = user.role === ROLES.MUNICIPAL_FIRE_MARSHAL
      && !!user.municipalityId && directive.municipalityId === user.municipalityId;
    if (!isRecipient && !isMarshal) {
      return NextResponse.json({ error: 'Directive not found' }, { status: 404 });
    }

    const body = await request.json();
    const what = directive.kind === DIRECTIVE_KINDS.ASSIGNMENT ? 'report assignment' : 'message';

    // Fire Marshal: withdraw an open directive.
    if (!isRecipient) {
      if (body.status !== DIRECTIVE_STATUS.CANCELLED) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      const result = await prisma.directive.updateMany({
        where: { id, status: { in: OPEN_STATUSES } },
        data: { status: DIRECTIVE_STATUS.CANCELLED },
      });
      if (result.count === 0) {
        return NextResponse.json({ error: `This directive is already ${directive.status.toLowerCase()}` }, { status: 409 });
      }
      await prisma.notification.create({
        data: {
          userId: directive.recipientId,
          message: `Fire Marshal ${user.name} cancelled the ${what} sent to you: ${directive.message}`,
          type: NOTIFICATION_TYPES.DIRECTIVE_UPDATED,
        },
      });
      const updated = await prisma.directive.findUnique({ where: { id }, select: DIRECTIVE_SELECT });
      return NextResponse.json({ directive: updated });
    }

    if (directive.status === DIRECTIVE_STATUS.CANCELLED) {
      return NextResponse.json({ error: 'The Fire Marshal cancelled this directive.' }, { status: 409 });
    }

    const action = body.action;
    let notice;

    if (action === 'REPLY') {
      const reply = String(body.response || '').trim();
      if (!reply) {
        return NextResponse.json({ error: 'Type a reply first.' }, { status: 400 });
      }
      // Every reply is kept, one per line.
      const response = directive.response ? `${directive.response}\n${reply}` : reply;
      if (response.length > MAX_RESPONSE_LENGTH) {
        return NextResponse.json({ error: `Replies must be at most ${MAX_RESPONSE_LENGTH} characters in total` }, { status: 400 });
      }
      await prisma.directive.update({
        where: { id },
        data: {
          response,
          respondedAt: new Date(),
          ...(directive.status === DIRECTIVE_STATUS.PENDING && { status: DIRECTIVE_STATUS.ACKNOWLEDGED }),
        },
      });
      notice = `${user.name} replied to your ${what}: ${reply}`;
    } else if (action === 'START') {
      if (directive.kind !== DIRECTIVE_KINDS.ASSIGNMENT) {
        return NextResponse.json({ error: 'Only a report assignment can be started.' }, { status: 400 });
      }
      // Already opened before: nothing new to tell the Fire Marshal.
      if (directive.status !== DIRECTIVE_STATUS.PENDING) {
        return NextResponse.json({ directive });
      }
      await prisma.directive.updateMany({
        where: { id, status: DIRECTIVE_STATUS.PENDING },
        data: { status: DIRECTIVE_STATUS.ACKNOWLEDGED, respondedAt: new Date() },
      });
      const label = ASSIGNMENT_LABELS[directive.reportType] || 'assigned';
      notice = `${user.name} started the ${label} report you assigned.`;
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    await prisma.notification.create({
      data: { userId: directive.senderId, message: notice, type: NOTIFICATION_TYPES.DIRECTIVE_UPDATED },
    });

    const updated = await prisma.directive.findUnique({ where: { id }, select: DIRECTIVE_SELECT });
    return NextResponse.json({ directive: updated });
  } catch (error) {
    console.error('Error updating directive:', error);
    return NextResponse.json({ error: 'Failed to update directive' }, { status: 500 });
  }
}
