import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { hashPassword, comparePassword } from '../../../../lib/auth';
import { sendEmail, passwordChangedEmail } from '../../../../lib/email';
import { RESET_CODE_MAX_ATTEMPTS, MIN_PASSWORD_LENGTH, normalizeEmail } from '../../../../lib/password-reset';

const INVALID_CODE = 'That code is incorrect or has expired. Check the latest email, or request a new code.';

// Step 2 of "Forgot password?": checks the emailed code (POST /api/auth/forgot-password) and sets
// the new password. The user then signs in normally with it.
export async function POST(request) {
  try {
    const { email, code, newPassword } = await request.json();
    const normalizedEmail = normalizeEmail(email);
    const normalizedCode = String(code || '').replace(/\s/g, '');

    if (!normalizedEmail || !normalizedCode || !newPassword) {
      return NextResponse.json({ error: 'Email, code and new password are required' }, { status: 400 });
    }
    if (!/^\d{6}$/.test(normalizedCode)) {
      return NextResponse.json({ error: 'The code is the 6 digits from the email.' }, { status: 400 });
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 }
      );
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      select: { id: true, name: true, email: true, isActive: true },
    });
    if (!user || !user.isActive) {
      return NextResponse.json({ error: INVALID_CODE }, { status: 400 });
    }

    const now = new Date();
    const resetCode = await prisma.passwordResetCode.findFirst({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
    });
    if (!resetCode) {
      return NextResponse.json({ error: INVALID_CODE }, { status: 400 });
    }

    // Counted before comparing, and only while under the cap, so parallel guesses can't slip past
    // the limit between a read and a write.
    const counted = await prisma.passwordResetCode.updateMany({
      where: { id: resetCode.id, attempts: { lt: RESET_CODE_MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    if (counted.count === 0) {
      return NextResponse.json(
        { error: 'Too many incorrect attempts. Please request a new code.' },
        { status: 429 }
      );
    }

    if (!(await comparePassword(normalizedCode, resetCode.codeHash))) {
      const attemptsLeft = RESET_CODE_MAX_ATTEMPTS - (resetCode.attempts + 1);
      return NextResponse.json(
        {
          error: attemptsLeft > 0
            ? `That code is incorrect. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left.`
            : 'Too many incorrect attempts. Please request a new code.',
        },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(newPassword);
    const applied = await prisma.$transaction(async (tx) => {
      // Claiming the code first means two submissions of the same correct code can't both apply.
      const claimed = await tx.passwordResetCode.updateMany({
        where: { id: resetCode.id, usedAt: null },
        data: { usedAt: now },
      });
      if (claimed.count === 0) return false;
      await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
      return true;
    });
    if (!applied) {
      return NextResponse.json({ error: INVALID_CODE }, { status: 400 });
    }

    await sendEmail({ to: user.email, ...passwordChangedEmail({ name: user.name }) });

    return NextResponse.json({ message: 'Your password has been reset. You can now sign in with it.' });
  } catch (error) {
    console.error('Reset password error:', error.message, error.stack);
    return NextResponse.json({ error: 'Could not reset the password. Please try again.' }, { status: 500 });
  }
}
