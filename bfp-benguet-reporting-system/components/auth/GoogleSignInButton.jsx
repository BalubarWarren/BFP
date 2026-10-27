'use client';

import { useEffect, useRef, useState } from 'react';

// The Client ID is a public identifier (not a secret) baked into the client bundle at build
// time via NEXT_PUBLIC_ — see lib/google-auth.js for the server side of this same value. Renders
// nothing at all if it's never been configured, so the app works password-only until someone
// deliberately sets it up.
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

// Our own "Continue with Google" button (drawn to Google's branding guidelines) driving Google
// Identity Services' OAuth token flow. Google's ready-made button can't be used here: whenever the
// browser is signed in to Google it turns itself into "Continue as <name> <email>", showing that
// account to anyone at the login screen, with no option to turn it off. Clicking this one always
// opens Google's account chooser instead, and the access token it returns goes to `onCredential`,
// which POSTs it to /api/auth/google to be verified with Google and matched to an existing account.
export default function GoogleSignInButton({ onCredential }) {
  const tokenClientRef = useRef(null);
  const [ready, setReady] = useState(false);
  // Kept in a ref so a re-render (e.g. the parent's `error` state changing) never re-creates the
  // token client — it only needs setting up once per page load.
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return undefined;

    const setUp = () => {
      if (!window.google?.accounts?.oauth2) return;
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'openid email profile',
        // Always ask which account — never silently reuse the one the browser is signed in to.
        prompt: 'select_account',
        callback: (response) => {
          if (response?.access_token) onCredentialRef.current(response.access_token);
        },
      });
      setReady(true);
    };

    if (window.google?.accounts?.oauth2) {
      setUp();
      return undefined;
    }

    // Shared across remounts (e.g. React strict-mode's double-invoke in dev) so the script tag
    // is never injected twice.
    let script = document.getElementById('google-identity-services');
    if (!script) {
      script = document.createElement('script');
      script.id = 'google-identity-services';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
    script.addEventListener('load', setUp);
    return () => script.removeEventListener('load', setUp);
  }, []);

  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <button
      type="button"
      onClick={() => tokenClientRef.current?.requestAccessToken()}
      disabled={!ready}
      className="mx-auto flex h-11 w-full max-w-xs items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 hover:shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-bfp-navy disabled:cursor-wait disabled:opacity-60"
    >
      <GoogleLogo />
      Continue with Google
    </button>
  );
}

// Google's standard multi-colour "G" mark.
function GoogleLogo() {
  return (
    <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  );
}
