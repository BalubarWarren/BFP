import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getUserFromRequest } from '../../../../lib/auth';
import { ROLES, DIRECTIVE_STATUS, NOTIFICATION_TYPES } from '../../../../lib/constants';
import { DIRECTIVE_SELECT } from '../../../../lib/directives';

const MAX_RESPONSE_LENGTH = 2000;

// The investigator moves a directive forward (PENDING -> ACKNOWLEDGED -> COMPLETED), optionally
// with a reply; the Fire Marshal can only cancel one that hasn't been completed yet.
const RECIPIENT_TRANSITIONS = {
  [DIRECTIVE_STATUS.ACKNOWLEDGED]: [DIRECTIVE_STATUS.PENDING],
  [DIRECTIVE_STATUS.COMPLETED]: [DIRECTIVE_STATUS.PENDING, DIRECTIVE_STATUS.ACKNOWLEDGED],
};
const SENDER_TRANSITIONS = {
  [DIRECTIVE_STATUS.CANCELLED]: [DIRECTIVE_STATUS.PENDING, DIRECTIVE_STATUS.ACKNOWLEDGED],
};

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
    const status = body.status;
    const transitions = isRecipient ? RECIPIENT_TRANSITIONS : SENDER_TRANSITIONS;
    if (!transitions[status]) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const response = isRecipient ? String(body.response || '').trim() : '';
    if (response.length > MAX_RESPONSE_LENGTH) {
      return NextResponse.json({ error: `Reply must be at most ${MAX_RESPONSE_LENGTH} characters` }, { status: 400 });
    }

    // Conditional on the current status so two tabs (or a cancel racing a completion) can't both win.
    const result = await prisma.directive.updateMany({
      where: { id, status: { in: transitions[status] } },
      data: {
        status,
        ...(isRecipient && { respondedAt: new Date() }),
        ...(response && { response }),
      },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: `This directive is already ${directive.status.toLowerCase()}` }, { status: 409 });
    }

    const updated = await prisma.directive.findUnique({ where: { id }, select: DIRECTIVE_SELECT });

    // Let the other side know: the marshal hears back when the investigator acts, the investigator
    // when an order is withdrawn.
    const notifyUserId = isRecipient ? directive.senderId : directive.recipientId;
    const verb = { ACKNOWLEDGED: 'acknowledged', COMPLETED: 'completed', CANCELLED: 'cancelled' }[status];
    const what = directive.kind === 'ASSIGNMENT' ? 'report assignment' : 'message';
    const message = isRecipient
      ? `${user.name} ${verb} your ${what}${response ? `: ${response}` : '.'}`
      : `Fire Marshal ${user.name} cancelled the ${what} sent to you: ${directive.message}`;
    await prisma.notification.create({
      data: { userId: notifyUserId, message, type: NOTIFICATION_TYPES.DIRECTIVE_UPDATED },
    });

    return NextResponse.json({ directive: updated });
  } catch (error) {
    console.error('Error updating directive:', error);
    return NextResponse.json({ error: 'Failed to update directive' }, { status: 500 });
  }
}
