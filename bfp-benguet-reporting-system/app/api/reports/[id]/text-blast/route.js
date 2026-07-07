import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { NOTIFICATION_TYPES, REPORT_STATUS, REPORT_TYPES, ROLES } from '@/lib/constants';

const TEXT_BLAST_RECIPIENT_ROLES = [
  ROLES.MUNICIPAL_CHIEF_IIS,
  ROLES.MUNICIPAL_CHIEF_OPERATION,
  ROLES.MUNICIPAL_FIRE_MARSHAL,
  ROLES.PROVINCIAL_CHIEF_IIS,
];

export async function POST(request, { params }) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== ROLES.INVESTIGATOR) {
      return NextResponse.json(
        { error: 'Only the submitting investigator can text blast an approved spot investigation report' },
        { status: 403 }
      );
    }

    const reportId = parseInt(params.id);
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        municipality: true,
        reviewedBy: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    if (report.submittedById !== user.id) {
      return NextResponse.json(
        { error: 'You can only text blast reports that you submitted' },
        { status: 403 }
      );
    }

    if (report.reportType !== REPORT_TYPES.SPOT_INVESTIGATION) {
      return NextResponse.json(
        { error: 'Text blast is only available for Spot Investigation Reports' },
        { status: 400 }
      );
    }

    if (report.status !== REPORT_STATUS.APPROVED || report.reviewedBy?.role !== ROLES.PROVINCIAL_CHIEF_IIS) {
      return NextResponse.json(
        { error: 'The Spot Investigation Report must be approved by the Provincial Chief IIS before text blast' },
        { status: 400 }
      );
    }

    const recipients = await prisma.user.findMany({
      where: {
        isActive: true,
        role: {
          in: TEXT_BLAST_RECIPIENT_ROLES,
        },
      },
      select: {
        id: true,
        role: true,
      },
    });

    const recipientIds = [...new Set(recipients.map((recipient) => recipient.id))];

    if (!recipientIds.length) {
      return NextResponse.json(
        { error: 'No active text blast recipients were found' },
        { status: 400 }
      );
    }

    const existingNotifications = await prisma.notification.findMany({
      where: {
        reportId,
        type: NOTIFICATION_TYPES.REPORT_TEXT_BLAST,
        userId: {
          in: recipientIds,
        },
      },
      select: {
        userId: true,
      },
    });

    const existingRecipientIds = new Set(existingNotifications.map((notification) => notification.userId));
    const newRecipientIds = recipientIds.filter((recipientId) => !existingRecipientIds.has(recipientId));
    const municipalityName = report.municipality?.name || 'a municipality';

    if (newRecipientIds.length) {
      await prisma.notification.createMany({
        data: newRecipientIds.map((userId) => ({
          userId,
          message: `Approved Spot Investigation Report from ${municipalityName} is now available as a final approved report.`,
          type: NOTIFICATION_TYPES.REPORT_TEXT_BLAST,
          reportId,
        })),
      });
    }

    await prisma.auditLog.create({
      data: {
        action: 'TEXT_BLAST_REPORT',
        userId: user.id,
        reportId,
        changes: JSON.stringify({
          recipientCount: recipientIds.length,
          newlySentCount: newRecipientIds.length,
          recipientRoles: TEXT_BLAST_RECIPIENT_ROLES,
        }),
      },
    });

    return NextResponse.json({
      message: newRecipientIds.length
        ? `Text blast sent to ${newRecipientIds.length} recipient${newRecipientIds.length === 1 ? '' : 's'}.`
        : 'This report was already text blasted to all available recipients.',
      recipientCount: recipientIds.length,
      newlySentCount: newRecipientIds.length,
    });
  } catch (error) {
    console.error('Error sending report text blast:', error);
    return NextResponse.json(
      { error: 'Failed to send text blast' },
      { status: 500 }
    );
  }
}
