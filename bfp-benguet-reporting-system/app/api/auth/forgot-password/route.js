import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { hashPassword } from '../../../../lib/auth';
import { sendEmail, passwordResetCodeEmail } from '../../../../lib/email';
import { checkRateLimit, recordFailedAttempt, getClientIp } from '../../../../lib/rate-limit';
import {
  RESET_CODE_TTL_MINUTES,
  RESET_CODE_RESEND_SECONDS,
  RESET_CODES_PER_HOUR,
  generateResetCode,
  normalizeEmail,
} from '../../../../lib/password-reset';

// Always the same answer whether or not the email has an account — otherwise this form would
// let anyone check which addresses are registered.
const GENERIC_RESPONSE = {
  message: 'If that email belongs to an active FireTrack account, a reset code has been sent to it.',
  resendAfterSeconds: RESET_CODE_RESEND_SECONDS,
};

// Step 1 of "Forgot password?": emails a 6-digit code that POST /api/auth/reset-password accepts.
export async function POST(request) {
  try {
    // Best-effort cap on one source hammering this with many different emails (see
    // lib/rate-limit.js on why it's per instance); the per-account caps below are the real limit.
    const ipKey = `ip:forgot-password:${getClientIp(request)}`;
    const ipLimit = checkRateLimit(ipKey);
    if (ipLimit.limited) {
      return NextResponse.json(
        { error: `Too many requests. Please try again in ${Math.ceil(ipLimit.retryAfterSeconds / 60)} minute(s).` },
        { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfterSeconds) } }
      );
    }
    recordFailedAttempt(ipKey);

    const { email } = await request.json();
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Case-insensitive, same as login: an admin may have typed the address with capitals.
    const user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      select: { id: true, name: true, email: true, isActive: true },
    });
    if (!user || !user.isActive) return NextResponse.json(GENERIC_RESPONSE);

    const now = Date.now();
    const recentCodes = await prisma.passwordResetCode.findMany({
      where: { userId: user.id, createdAt: { gt: new Date(now - 60 * 60 * 1000) } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const tooSoon = recentCodes[0] && now - recentCodes[0].createdAt.getTime() < RESET_CODE_RESEND_SECONDS * 1000;
    // Silently skipped (same response) so the limits don't reveal that the account exists.
    if (tooSoon || recentCodes.length >= RESET_CODES_PER_HOUR) return NextResponse.json(GENERIC_RESPONSE);

    const code = generateResetCode();
    await prisma.$transaction([
      // Only the newest code works — requesting another retires every earlier one.
      prisma.passwordResetCode.updateMany({
        where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date(now) } },
        data: { expiresAt: new Date(now) },
      }),
      // Nothing reads codes older than the hourly cap's window, so they're cleared as we go.
      prisma.passwordResetCode.deleteMany({
        where: { userId: user.id, createdAt: { lt: new Date(now - 24 * 60 * 60 * 1000) } },
      }),
      prisma.passwordResetCode.create({
        data: {
          userId: user.id,
          codeHash: await hashPassword(code),
          expiresAt: new Date(now + RESET_CODE_TTL_MINUTES * 60 * 1000),
        },
      }),
    ]);

    await sendEmail({
      to: user.email,
      ...passwordResetCodeEmail({ name: user.name, code, minutes: RESET_CODE_TTL_MINUTES }),
    });

    return NextResponse.json(GENERIC_RESPONSE);
  } catch (error) {
    console.error('Forgot password error:', error.message, error.stack);
    return NextResponse.json({ error: 'Could not send a reset code. Please try again.' }, { status: 500 });
  }
}
