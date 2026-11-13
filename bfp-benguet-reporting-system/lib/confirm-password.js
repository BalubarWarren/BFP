import { NextResponse } from 'next/server';
import prisma from './prisma';
import { comparePassword } from './auth';
import { checkRateLimit, recordFailedAttempt, clearAttempts } from './rate-limit';

// Re-checks the signed-in user's own password before a destructive action (e.g. deleting an
// account). A stolen session token alone is then not enough, and guesses are rate-limited per
// account the same way login and change-password are.
// Returns null when the password is correct, or the error response to send back.
export async function requirePasswordConfirmation(user, password, action = 'confirm') {
  const rateLimitKey = `${action}:${user.id}`;
  const limit = checkRateLimit(rateLimitKey);
  if (limit.limited) {
    return NextResponse.json(
      { error: `Too many attempts. Please try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minute(s).` },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  if (!password) {
    return NextResponse.json({ error: 'Enter your password to continue.', code: 'PASSWORD_REQUIRED' }, { status: 400 });
  }

  const fullUser = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  const isValid = fullUser?.passwordHash ? await comparePassword(password, fullUser.passwordHash) : false;
  if (!isValid) {
    recordFailedAttempt(rateLimitKey);
    return NextResponse.json({ error: 'Incorrect password.', code: 'PASSWORD_INCORRECT' }, { status: 400 });
  }

  clearAttempts(rateLimitKey);
  return null;
}
