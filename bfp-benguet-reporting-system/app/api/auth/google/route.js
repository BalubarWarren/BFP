import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { verifyGoogleAccessToken, GOOGLE_ACCOUNT_ERRORS } from '../../../../lib/google-auth';

// "Continue with Google" only identifies *which* account is signing in — it never logs anyone in
// by itself and never creates an account. It returns the matching FireTrack email so the login
// page can fill it in, and the user must still enter the admin-set system password, which is
// checked by POST /api/auth/login exactly like a typed-in email. Role, municipality and every
// permission are still assigned by an admin (see POST /api/users).
export async function POST(request) {
  try {
    const { accessToken } = await request.json();

    const google = await verifyGoogleAccessToken(accessToken);
    if (google.error) {
      return NextResponse.json({ error: google.error }, { status: google.status });
    }

    // Case-insensitive: Google always returns the address lowercased, but an admin may have typed
    // it with capitals when creating the account.
    const user = await prisma.user.findFirst({
      where: { email: { equals: google.email, mode: 'insensitive' } },
      select: { id: true, email: true, name: true, isActive: true, googleName: true, avatarUrl: true },
    });

    // Unlike the password login's deliberately generic "Invalid email or password" (which hides
    // whether an email has an account at all, to resist enumeration by guessing), these answers
    // can safely be specific: reaching this point already required completing Google's own
    // sign-in for that exact email, which is stronger proof of ownership than a password guess —
    // there's nothing being leaked to someone who doesn't already control that email address.
    // `code` drives the login page's warning dialog, which can also ask an admin for access.
    if (!user || !user.isActive) {
      return NextResponse.json(
        {
          error: user
            ? 'This FireTrack account has been deactivated. Contact an administrator.'
            : 'This Google account is not registered in FireTrack. Contact an administrator.',
          code: user ? GOOGLE_ACCOUNT_ERRORS.INACTIVE : GOOGLE_ACCOUNT_ERRORS.NOT_REGISTERED,
          email: google.email,
          name: google.name,
        },
        { status: 403 }
      );
    }

    // Keep the header's name/photo in step with the Google account (display only — see the
    // googleName/avatarUrl columns in prisma/schema.prisma).
    if (user.googleName !== google.name || user.avatarUrl !== google.picture) {
      await prisma.user.update({
        where: { id: user.id },
        data: { googleName: google.name, avatarUrl: google.picture },
      });
    }

    // No session token here on purpose — the password step at /api/auth/login issues it.
    return NextResponse.json({ email: user.email, name: user.name });
  } catch (error) {
    console.error('Google login error:', error.message, error.stack);
    return NextResponse.json({ error: 'Google sign-in failed. Please try again.' }, { status: 500 });
  }
}
