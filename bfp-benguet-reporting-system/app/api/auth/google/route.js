import { NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../../../../lib/prisma';
import { generateToken } from '../../../../lib/auth';

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

// Google Sign-In is deliberately an alternative *credential check* for an account that already
// exists — never a way to create one. Role, municipality and every permission in this app are
// still assigned by an admin (see POST /api/users); Google only ever answers "is this really the
// owner of this email address", the exact same question a correct password answers today. An
// email with no matching account, or a deactivated one, is rejected exactly like it would be at
// POST /api/auth/login.
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

    const user = await prisma.user.findUnique({
      where: { email: payload.email },
      include: { municipality: true },
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
    console.error('Google login error:', error.message, error.stack);
    return NextResponse.json({ error: 'Google sign-in failed. Please try again.' }, { status: 500 });
  }
}
