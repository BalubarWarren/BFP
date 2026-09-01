import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { comparePassword, generateToken } from '../../../../lib/auth';
import { checkRateLimit, recordFailedAttempt, clearAttempts, getClientIp } from '../../../../lib/rate-limit';

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Rate-limit both the specific account (targeted brute force) and the source IP (credential
    // stuffing across many accounts) — either being locked out blocks the request.
    const emailKey = `email:${email.toLowerCase()}`;
    const ipKey = `ip:${getClientIp(request)}`;
    const emailLimit = checkRateLimit(emailKey);
    const ipLimit = checkRateLimit(ipKey);

    if (emailLimit.limited || ipLimit.limited) {
      const retryAfterSeconds = Math.max(emailLimit.retryAfterSeconds || 0, ipLimit.retryAfterSeconds || 0);
      return NextResponse.json(
        { error: `Too many failed login attempts. Please try again in ${Math.ceil(retryAfterSeconds / 60)} minute(s).` },
        { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        municipality: true,
      },
    });

    if (!user) {
      recordFailedAttempt(emailKey);
      recordFailedAttempt(ipKey);
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Compare password
    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      recordFailedAttempt(emailKey);
      recordFailedAttempt(ipKey);
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Checked after the password so a deactivated account's status can't be probed with a wrong password.
    if (!user.isActive) {
      recordFailedAttempt(emailKey);
      recordFailedAttempt(ipKey);
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    clearAttempts(emailKey);
    clearAttempts(ipKey);

    // Generate token
    const token = generateToken(user);

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        rank: user.rank,
        municipalityId: user.municipalityId,
        municipality: user.municipality,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error.message, error.stack);
    return NextResponse.json(
      { error: 'Login failed. Please try again.' },
      { status: 500 }
    );
  }
}
