import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { getUserFromRequest } from '../../../lib/auth';

export async function GET(request) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // This poll runs every 30s from every open, visible dashboard (components/common/Header.jsx),
    // which makes it the presence heartbeat behind the Fire Marshal's "online now" indicator.
    // Throttled to one write a minute per user so it doesn't add a write to every poll.
    await prisma.user.updateMany({
      where: {
        id: user.id,
        OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: new Date(Date.now() - 60 * 1000) } }],
      },
      data: { lastSeenAt: new Date() },
    });

    const notifications = await prisma.notification.findMany({
      where: {
        userId: user.id,
      },
      include: {
        report: {
          select: {
            id: true,
            reportType: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { notificationId, isRead } = body;

    // Scoped to the requesting user's own id so one account can't flip another's notifications.
    const result = await prisma.notification.updateMany({
      where: { id: parseInt(notificationId), userId: user.id },
      data: { isRead },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    const notification = await prisma.notification.findUnique({
      where: { id: parseInt(notificationId) },
    });

    return NextResponse.json({ notification });
  } catch (error) {
    console.error('Error updating notification:', error);
    return NextResponse.json(
      { error: 'Failed to update notification' },
      { status: 500 }
    );
  }
}
