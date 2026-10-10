import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { getUserFromRequest } from '../../../lib/auth';
import {
  ROLES,
  DIRECTIVE_KINDS,
  ASSIGNABLE_REPORT_TYPES,
  NOTIFICATION_TYPES,
} from '../../../lib/constants';
import { DIRECTIVE_SELECT } from '../../../lib/directives';

const MAX_MESSAGE_LENGTH = 2000;

// Fire Marshal: every directive sent within their municipality (so a second marshal account for
// the same station sees the same history). Investigator: only the ones addressed to them.
export async function GET(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let where;
    if (user.role === ROLES.MUNICIPAL_FIRE_MARSHAL && user.municipalityId) {
      where = { municipalityId: user.municipalityId };
    } else if (user.role === ROLES.INVESTIGATOR) {
      where = { recipientId: user.id };
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const directives = await prisma.directive.findMany({
      where,
      select: DIRECTIVE_SELECT,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ directives });
  } catch (error) {
    console.error('Error fetching directives:', error);
    return NextResponse.json({ error: 'Failed to fetch directives' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== ROLES.MUNICIPAL_FIRE_MARSHAL || !user.municipalityId) {
      return NextResponse.json({ error: 'Only a Municipal Fire Marshal can send directives' }, { status: 403 });
    }

    const body = await request.json();
    const kind = body.kind;
    const message = String(body.message || '').trim();
    const recipientId = parseInt(body.recipientId);

    if (!Object.values(DIRECTIVE_KINDS).includes(kind)) {
      return NextResponse.json({ error: 'Invalid directive type' }, { status: 400 });
    }
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: `Message must be at most ${MAX_MESSAGE_LENGTH} characters` }, { status: 400 });
    }

    const reportType = kind === DIRECTIVE_KINDS.ASSIGNMENT ? body.reportType : null;
    if (kind === DIRECTIVE_KINDS.ASSIGNMENT && !ASSIGNABLE_REPORT_TYPES[reportType]) {
      return NextResponse.json({ error: 'Choose which report to assign' }, { status: 400 });
    }

    let dueAt = null;
    if (body.dueAt) {
      dueAt = new Date(body.dueAt);
      if (Number.isNaN(dueAt.getTime())) {
        return NextResponse.json({ error: 'Invalid due date' }, { status: 400 });
      }
    }

    // Recipients are limited to active investigators of the marshal's own municipality.
    const recipient = await prisma.user.findFirst({
      where: {
        id: Number.isNaN(recipientId) ? -1 : recipientId,
        role: ROLES.INVESTIGATOR,
        municipalityId: user.municipalityId,
        isActive: true,
      },
      select: { id: true, name: true },
    });
    if (!recipient) {
      return NextResponse.json({ error: 'Investigator not found in your municipality' }, { status: 404 });
    }

    const directive = await prisma.directive.create({
      data: {
        kind,
        reportType,
        message,
        dueAt,
        municipalityId: user.municipalityId,
        senderId: user.id,
        recipientId: recipient.id,
      },
      select: DIRECTIVE_SELECT,
    });

    const summary = kind === DIRECTIVE_KINDS.ASSIGNMENT
      ? `Fire Marshal ${user.name} assigned you a ${ASSIGNABLE_REPORT_TYPES[reportType].label} report${dueAt ? ` (due ${dueAt.toLocaleString('en-PH', { timeZone: 'Asia/Manila' })})` : ''}: ${message}`
      : `Message from Fire Marshal ${user.name}: ${message}`;

    await prisma.notification.create({
      data: { userId: recipient.id, message: summary, type: NOTIFICATION_TYPES.DIRECTIVE_RECEIVED },
    });

    await prisma.auditLog.create({
      data: {
        action: 'SEND_DIRECTIVE',
        userId: user.id,
        changes: JSON.stringify({ directiveId: directive.id, kind, reportType, recipientId: recipient.id, recipientName: recipient.name }),
      },
    });

    return NextResponse.json({ directive }, { status: 201 });
  } catch (error) {
    console.error('Error creating directive:', error);
    return NextResponse.json({ error: 'Failed to send directive' }, { status: 500 });
  }
}
