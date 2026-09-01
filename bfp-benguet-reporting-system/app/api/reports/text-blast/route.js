import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getUserFromRequest } from '../../../../lib/auth';
import { NOTIFICATION_TYPES, ROLES } from '../../../../lib/constants';
import { saveAttachments } from '../../../../lib/storage';

const TEXT_BLAST_RECIPIENT_ROLES = [
  ROLES.MUNICIPAL_CHIEF_IIS,
  ROLES.MUNICIPAL_CHIEF_OPERATION,
  ROLES.MUNICIPAL_FIRE_MARSHAL,
  ROLES.PROVINCIAL_CHIEF_IIS,
];

export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== ROLES.INVESTIGATOR) {
      return NextResponse.json(
        { error: 'Only investigators can send a Spot Investigation text blast' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    let attachments;
    try {
      attachments = await saveAttachments(formData.getAll('attachments'), 'text-blasts');
    } catch (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 400 });
    }
    const note = String(formData.get('message') || '').trim();

    if (!attachments.length) {
      return NextResponse.json(
        { error: 'Attach at least one file before sending the text blast' },
        { status: 400 }
      );
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
        role: {
          in: TEXT_BLAST_RECIPIENT_ROLES,
        },
      },
      select: { id: true },
    });

    const recipientIds = [...new Set(recipients.map((recipient) => recipient.id))];

    if (!recipientIds.length) {
      return NextResponse.json(
        { error: 'No active text blast recipients were found' },
        { status: 400 }
      );
    }

    const payload = {
      kind: 'TEXT_BLAST',
      message: `Spot Investigation text blast from ${sender.name}${sender.municipality?.name ? ` (${sender.municipality.name})` : ''}.`,
      note,
      attachments,
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
          source: 'SPOT_INVESTIGATION_FORM',
          recipientCount: recipientIds.length,
          attachmentCount: attachments.length,
          recipientRoles: TEXT_BLAST_RECIPIENT_ROLES,
        }),
      },
    });

    return NextResponse.json({
      message: `Text blast sent to ${recipientIds.length} recipient${recipientIds.length === 1 ? '' : 's'}.`,
      recipientCount: recipientIds.length,
      attachments,
    });
  } catch (error) {
    console.error('Error sending Spot Investigation text blast:', error);
    return NextResponse.json(
      { error: 'Failed to send text blast' },
      { status: 500 }
    );
  }
}
