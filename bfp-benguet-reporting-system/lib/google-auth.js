// "Continue with Google" on the login page (components/auth/GoogleSignInButton.jsx) uses Google
// Identity Services' OAuth token flow with our own button — not Google's rendered button, which
// turns itself into "Continue as <name> / <email>" whenever the browser is signed in to Google and
// has no option to stop that. The flow hands the page a short-lived access token (scopes: openid
// email profile), which the server verifies here by asking Google about it directly.
const getClientId = () => {
  // The same public value the button uses — a Google OAuth Client ID is not a secret.
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('NEXT_PUBLIC_GOOGLE_CLIENT_ID environment variable is required but not set.');
  }
  return clientId;
};

const INVALID = { error: 'Your Google sign-in has expired or is invalid. Please sign in with Google again.', status: 401 };

// Shared by POST /api/auth/google and POST /api/auth/google/request-access. Returns
// `{ email, name }` for a valid token with a verified email, or `{ error, status }` to send back.
export async function verifyGoogleAccessToken(accessToken) {
  if (!accessToken || typeof accessToken !== 'string') return { error: 'Missing Google sign-in', status: 400 };

  const clientId = getClientId();

  let info;
  try {
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`, {
      cache: 'no-store',
    });
    if (!response.ok) return INVALID;
    info = await response.json();
  } catch (error) {
    return { error: 'Could not reach Google to check the sign-in. Please try again.', status: 502 };
  }

  // The security boundary: the token must have been issued to *this* app. Without this check, a
  // token some other site obtained for a user could be replayed here to sign in as them.
  if (info.aud !== clientId && info.azp !== clientId) return INVALID;
  if (!(Number(info.expires_in) > 0)) return INVALID;
  if (!info.email || String(info.email_verified) !== 'true') {
    return { error: 'Google account email is not verified.', status: 401 };
  }

  // tokeninfo has no name — the userinfo endpoint does (best effort; the email is what matters).
  let name = null;
  try {
    const profile = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (profile.ok) name = (await profile.json()).name || null;
  } catch {
    // Name is only used for display.
  }

  return { email: info.email, name };
}

// What the login page's warning dialog (components/auth/GoogleAccountWarningModal.jsx) switches on.
export const GOOGLE_ACCOUNT_ERRORS = {
  NOT_REGISTERED: 'GOOGLE_NOT_REGISTERED',
  INACTIVE: 'GOOGLE_ACCOUNT_INACTIVE',
};
