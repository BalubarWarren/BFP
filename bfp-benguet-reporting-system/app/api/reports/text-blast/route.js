import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { NOTIFICATION_TYPES, ROLES } from '@/lib/constants';

const TEXT_BLAST_RECIPIENT_ROLES = [
  ROLES.MUNICIPAL_CHIEF_IIS,
  ROLES.MUNICIPAL_CHIEF_OPERATION,
  ROLES.MUNICIPAL_FIRE_MARSHAL,
  ROLES.PROVINCIAL_CHIEF_IIS,
];

const sanitizeFileName = (fileName) =>
  fileName.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');

const saveTextBlastAttachments = async (files) => {
  const validFiles = files.filter((file) => file && file.size > 0);
  if (!validFiles.length) return [];

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'text-blasts');
  await mkdir(uploadDir, { recursive: true });

  return Promise.all(
    validFiles.map(async (file) => {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const storedName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${sanitizeFileName(file.name)}`;
      const filePath = path.join(uploadDir, storedName);

      await writeFile(filePath, buffer);

      return {
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        url: `/uploads/text-blasts/${storedName}`,
      };
    })
  );
};

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
    const attachments = await saveTextBlastAttachments(formData.getAll('attachments'));
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
