import { NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import { ROLES, NOTIFICATION_TYPES } from '../../../../../lib/constants';
import { verifyGoogleCredential } from '../../../../../lib/google-auth';
import { checkRateLimit, recordFailedAttempt, getClientIp } from '../../../../../lib/rate-limit';

const NOTE_MAX_LENGTH = 300;
const REPEAT_WINDOW_MS = 24 * 60 * 60 * 1000;

// "Request Access" in the login page's warning dialog, shown when someone signs in with a Google
// account that has no active FireTrack account. Notifies every admin (in-app, and by email via the
// Notification hook in lib/prisma.js) so they can create or reactivate it in User Management —
// which emails the person their login details. Needs the same Google credential the sign-in just
// produced, so only the real owner of the address can ask on its behalf.
export async function POST(request) {
  try {
    const ipKey = `ip:access-request:${getClientIp(request)}`;
    const ipLimit = checkRateLimit(ipKey);
    if (ipLimit.limited) {
      return NextResponse.json(
        { error: `Too many requests. Please try again in ${Math.ceil(ipLimit.retryAfterSeconds / 60)} minute(s).` },
        { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfterSeconds) } }
      );
    }
    recordFailedAttempt(ipKey);

    const { credential, note } = await request.json();

    const google = await verifyGoogleCredential(credential);
    if (google.error) {
      return NextResponse.json({ error: google.error }, { status: google.status });
    }

    const existing = await prisma.user.findFirst({
      where: { email: { equals: google.email, mode: 'insensitive' } },
      select: { isActive: true },
    });
    if (existing?.isActive) {
      return NextResponse.json(
        { error: 'This Google account already has an active FireTrack account. Sign in with Google again.' },
        { status: 400 }
      );
    }

    // One request per address per day is enough — repeats would just flood the admins' inboxes.
    const alreadyRequested = await prisma.notification.findFirst({
      where: {
        type: NOTIFICATION_TYPES.ACCESS_REQUEST,
        createdAt: { gt: new Date(Date.now() - REPEAT_WINDOW_MS) },
        message: { contains: `(${google.email})`, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (alreadyRequested) {
      return NextResponse.json({ alreadyRequested: true });
    }

    const admins = await prisma.user.findMany({
      where: { role: { in: [ROLES.SUPER_ADMIN, ROLES.ADMIN] }, isActive: true },
      select: { id: true },
    });
    if (admins.length === 0) {
      return NextResponse.json(
        { error: 'No administrator is available to receive the request. Please contact your office directly.' },
        { status: 503 }
      );
    }

    const cleanNote = String(note || '').replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX_LENGTH);
    const who = `${google.name || 'Someone'} (${google.email})`;
    const message = [
      existing
        ? `Access request: ${who} tried to sign in with Google, but their FireTrack account is deactivated. Reactivate it in User Management if they should have access.`
        : `Access request: ${who} tried to sign in with Google, but has no FireTrack account. Create one in User Management if they should have access.`,
      cleanNote && `Their note: "${cleanNote}"`,
    ].filter(Boolean).join(' ');

    await prisma.notification.createMany({
      data: admins.map((admin) => ({ userId: admin.id, message, type: NOTIFICATION_TYPES.ACCESS_REQUEST })),
    });

    return NextResponse.json({ alreadyRequested: false });
  } catch (error) {
    console.error('Access request error:', error.message, error.stack);
    return NextResponse.json({ error: 'Could not send the request. Please try again.' }, { status: 500 });
  }
}
