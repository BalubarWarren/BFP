import { NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../../../../lib/prisma';

// Same public value used client-side to initialize the "Sign in with Google" button (see
// components/auth/GoogleSignInButton.jsx) — a Google OAuth Client ID is not a secret, it's
// designed to be embedded in front-end code, so there's no separate server-only credential to
// configure for this ID-token verification flow.
function getGoogleClient() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('NEXT_PUBLIC_GOOGLE_CLIENT_ID environment variable is required but not set.');
  }
  return { client: new OAuth2Client(clientId), clientId };
}

// "Continue with Google" only identifies *which* account is signing in — it never logs anyone in
// by itself and never creates an account. It returns the matching FireTrack email so the login
// page can fill it in, and the user must still enter the admin-set system password, which is
// checked by POST /api/auth/login exactly like a typed-in email. Role, municipality and every
// permission are still assigned by an admin (see POST /api/users).
export async function POST(request) {
  try {
    const { credential } = await request.json();

    if (!credential) {
      return NextResponse.json({ error: 'Missing Google credential' }, { status: 400 });
    }

    const { client, clientId } = getGoogleClient();

    let payload;
    try {
      // Verifies the credential's signature against Google's public keys and that it was issued
      // for *this* app (audience) — this is the actual security boundary here, not a password.
      const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
      payload = ticket.getPayload();
    } catch (error) {
      return NextResponse.json({ error: 'Invalid Google sign-in. Please try again.' }, { status: 401 });
    }

    if (!payload?.email || !payload.email_verified) {
      return NextResponse.json({ error: 'Google account email is not verified.' }, { status: 401 });
    }

    // Case-insensitive: Google always returns the address lowercased, but an admin may have typed
    // it with capitals when creating the account.
    const user = await prisma.user.findFirst({
      where: { email: { equals: payload.email, mode: 'insensitive' } },
      select: { email: true, name: true, isActive: true },
    });

    // Unlike the password login's deliberately generic "Invalid email or password" (which hides
    // whether an email has an account at all, to resist enumeration by guessing), this message
    // can safely be specific: reaching this point already required completing Google's own
    // sign-in for that exact email, which is stronger proof of ownership than a password guess —
    // there's nothing being leaked to someone who doesn't already control that email address.
    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: 'No active FireTrack account is linked to this Google email. Contact an administrator.' },
        { status: 403 }
      );
    }

    // No session token here on purpose — the password step at /api/auth/login issues it.
    return NextResponse.json({ email: user.email, name: user.name });
  } catch (error) {
    console.error('Google login error:', error.message, error.stack);
    return NextResponse.json({ error: 'Google sign-in failed. Please try again.' }, { status: 500 });
  }
}
