import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getUserFromRequest, hashPassword, comparePassword } from '../../../../lib/auth';
import { checkRateLimit, recordFailedAttempt, clearAttempts } from '../../../../lib/rate-limit';

// Self-service password change — distinct from PATCH /api/users/[id], which is an admin-only
// endpoint for managing other accounts and doesn't verify a current password.
export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Someone holding a stolen/leaked bearer token but not the account's actual password could
    // otherwise brute-force currentPassword with unlimited attempts — same protection as login,
    // keyed to this account specifically.
    const rateLimitKey = `change-password:${user.id}`;
    const limit = checkRateLimit(rateLimitKey);
    if (limit.limited) {
      return NextResponse.json(
        { error: `Too many attempts. Please try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minute(s).` },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
      );
    }

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Current and new password are required' }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
    }

    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });

    const isValid = await comparePassword(currentPassword, fullUser.passwordHash);
    if (!isValid) {
      recordFailedAttempt(rateLimitKey);
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    }

    clearAttempts(rateLimitKey);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword) },
    });

    return NextResponse.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 });
  }
}
