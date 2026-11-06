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
const RECIPIENT_TITLES = {
  [ROLES.MUNICIPAL_FIRE_MARSHAL]: 'Municipal Fire Marshal',
  [ROLES.MUNICIPAL_CHIEF_IIS]: 'Municipal Chief IIS',
  [ROLES.PROVINCIAL_CHIEF_IIS]: 'Provincial Chief IIS',
};

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

// "Sent to 3 recipients…" plus how the emails went — undefined delivery means it wasn't reported.
function sentMessage(recipientCount, recipientRoles, delivery) {
  const to = recipientRoles.map((role) => RECIPIENT_TITLES[role]).join(', ');
  const sent = `Your text blast was sent to ${plural(recipientCount, 'recipient')} (${to}).`;
  if (!delivery) return sent;
  if (!delivery.failed) return `${sent} Emailed to ${plural(delivery.emailed, 'recipient')}.`;
  return `${sent} The email could not be sent to ${delivery.failed} of them — they can still read it in FireTrack.`;
}

// The sender's bell entry — never emailed (IN_APP_ONLY_NOTIFICATION_TYPES). Best effort: a
// failure here must not turn a delivered text blast into an error response.
async function notifySender(userId, message) {
  try {
    await prisma.notification.create({
      data: { userId, message, type: NOTIFICATION_TYPES.TEXT_BLAST_STATUS },
    });
  } catch (error) {
    console.error('Error saving text blast status notification:', error);
  }
}

export async function POST(request) {
  let user = null;
  // Set once recipients have it (and the sender has been told), so a later failure such as the
  // audit log isn't reported to the sender as unsent.
  let delivered = false;
  try {
    user = await getUserFromRequest(request);

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
      const error = 'No active accounts were found for the selected recipients';
      await notifySender(user.id, `Your text blast was NOT sent: ${error.toLowerCase()}.`);
      return NextResponse.json({ error }, { status: 400 });
    }

    const payload = {
      kind: 'TEXT_BLAST',
      message: `Text blast from ${sender.name}${sender.municipality?.name ? ` (${sender.municipality.name})` : ''}.`,
      lines,
    };

    // emailDelivery is attached by the email middleware in lib/prisma.js.
    const { emailDelivery } = await prisma.notification.createMany({
      data: recipientIds.map((userId) => ({
        userId,
        message: JSON.stringify(payload),
        type: NOTIFICATION_TYPES.REPORT_TEXT_BLAST,
      })),
    });
    delivered = true;
    const message = sentMessage(recipientIds.length, recipientRoles, emailDelivery);
    await notifySender(user.id, message);

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
      message,
      recipientCount: recipientIds.length,
      emailFailed: emailDelivery?.failed || 0,
    });
  } catch (error) {
    console.error('Error sending text blast:', error);
    if (user && !delivered) {
      await notifySender(user.id, 'Your text blast was NOT sent because of a server error. Please try again.');
    }
    return NextResponse.json(
      { error: 'Failed to send text blast' },
      { status: 500 }
    );
  }
}
