import { OAuth2Client } from 'google-auth-library';

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

// Shared by POST /api/auth/google and POST /api/auth/google/request-access. Returns
// `{ email, name }` for a valid ID token with a verified email, or `{ error, status }` to send back.
export async function verifyGoogleCredential(credential) {
  if (!credential) return { error: 'Missing Google credential', status: 400 };

  const { client, clientId } = getGoogleClient();

  let payload;
  try {
    // Verifies the credential's signature against Google's public keys and that it was issued
    // for *this* app (audience) — this is the actual security boundary here, not a password.
    const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
    payload = ticket.getPayload();
  } catch (error) {
    return { error: 'Your Google sign-in has expired or is invalid. Please sign in with Google again.', status: 401 };
  }

  if (!payload?.email || !payload.email_verified) {
    return { error: 'Google account email is not verified.', status: 401 };
  }

  return { email: payload.email, name: payload.name || null };
}

// What the login page's warning dialog (components/auth/GoogleAccountWarningModal.jsx) switches on.
export const GOOGLE_ACCOUNT_ERRORS = {
  NOT_REGISTERED: 'GOOGLE_NOT_REGISTERED',
  INACTIVE: 'GOOGLE_ACCOUNT_INACTIVE',
};
