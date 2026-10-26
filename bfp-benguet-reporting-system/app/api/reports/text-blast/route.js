import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getUserFromRequest } from '../../../../lib/auth';
import { NOTIFICATION_TYPES, ROLES } from '../../../../lib/constants';
import { cleanTextBlastLines, TEXT_BLAST_MAX_CHARACTERS } from '../../../../lib/text-blast';

// The investigator picks any combination of these. The two municipal roles are scoped to the
// investigator's own municipality; the Provincial Chief IIS covers the whole province.
const TEXT_BLAST_RECIPIENT_ROLES = [
  ROLES.MUNICIPAL_FIRE_MARSHAL,
  ROLES.MUNICIPAL_CHIEF_IIS,
  ROLES.PROVINCIAL_CHIEF_IIS,
];
const MUNICIPAL_RECIPIENT_ROLES = [ROLES.MUNICIPAL_FIRE_MARSHAL, ROLES.MUNICIPAL_CHIEF_IIS];

export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== ROLES.INVESTIGATOR) {
      return NextResponse.json(
        { error: 'Only investigators can send a text blast' },
        { status: 403 }
      );
    }

    // Text blasts are text-only — no file attachments.
    const body = await request.json().catch(() => ({}));
    // The editor's content as formatted text runs (see lib/text-blast.js) — template lines left
    // unfilled are dropped there.
    const lines = cleanTextBlastLines(body?.lines);

    if (lines === null) {
      return NextResponse.json(
        { error: `Text blast message must be ${TEXT_BLAST_MAX_CHARACTERS} characters or fewer` },
        { status: 400 }
      );
    }

    if (!lines.length) {
      return NextResponse.json(
        { error: 'Fill in the template or type a message before sending the text blast' },
        { status: 400 }
      );
    }

    const recipientRoles = Array.isArray(body?.recipientRoles)
      ? [...new Set(body.recipientRoles)].filter((role) => TEXT_BLAST_RECIPIENT_ROLES.includes(role))
      : [];
    if (!recipientRoles.length) {
      return NextResponse.json({ error: 'Choose at least one recipient' }, { status: 400 });
    }

    const sender = await prisma.user.findUnique({
      where: { id: user.id },
      include: { municipality: true },
    });

    if (!sender || !sender.isActive) {
      return NextResponse.json({ error: 'Sender account is not active' }, { status: 403 });
    }

    const recipients = await prisma.user.findMany({
      where: {
        isActive: true,
        id: { not: sender.id },
        OR: recipientRoles.map((role) =>
          MUNICIPAL_RECIPIENT_ROLES.includes(role)
            ? { role, municipalityId: sender.municipalityId }
            : { role }
        ),
      },
      select: { id: true },
    });

    const recipientIds = [...new Set(recipients.map((recipient) => recipient.id))];

    if (!recipientIds.length) {
      return NextResponse.json(
        { error: 'No active accounts were found for the selected recipients' },
        { status: 400 }
      );
    }

    const payload = {
      kind: 'TEXT_BLAST',
      message: `Text blast from ${sender.name}${sender.municipality?.name ? ` (${sender.municipality.name})` : ''}.`,
      lines,
    };

    await prisma.notification.createMany({
      data: recipientIds.map((userId) => ({
        userId,
        message: JSON.stringify(payload),
        type: NOTIFICATION_TYPES.REPORT_TEXT_BLAST,
      })),
    });

    await prisma.auditLog.create({
      data: {
        action: 'TEXT_BLAST_REPORT',
        userId: user.id,
        changes: JSON.stringify({
          source: 'TEXT_BLAST_PAGE',
          recipientCount: recipientIds.length,
          recipientRoles,
        }),
      },
    });

    return NextResponse.json({
      message: `Text blast sent to ${recipientIds.length} recipient${recipientIds.length === 1 ? '' : 's'}.`,
      recipientCount: recipientIds.length,
    });
  } catch (error) {
    console.error('Error sending text blast:', error);
    return NextResponse.json(
      { error: 'Failed to send text blast' },
      { status: 500 }
    );
  }
}
