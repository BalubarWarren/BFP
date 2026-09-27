'use client';

import { useEffect, useRef } from 'react';

// The Client ID is a public identifier (not a secret) baked into the client bundle at build
// time via NEXT_PUBLIC_ — see app/api/auth/google/route.js for the server side of this same
// value. Renders nothing at all if it's never been configured, so the app works exactly as it
// does today (password-only) until someone deliberately sets it up.
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

// Renders Google's own "Sign in with Google" button (via Google Identity Services) into this
// component's div. The button, the account-chooser popup, and the resulting ID token are all
// Google's — this component just wires up the client ID and hands the signed token off to
// `onCredential`, which POSTs it to /api/auth/google to be verified and matched against an
// existing FireTrack account (see that route for why there's no self-registration here).
export default function GoogleSignInButton({ onCredential }) {
  const buttonRef = useRef(null);
  // Kept in a ref rather than a useEffect dependency so a re-render (e.g. the parent's `error`
  // state changing while the user retries) never tears down and re-initializes the whole GIS
  // button — it only ever needs to be set up once per page load.
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const renderButton = () => {
      if (!window.google?.accounts?.id || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => onCredentialRef.current(response.credential),
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        width: 320,
        text: 'signin_with',
      });
    };

    if (window.google?.accounts?.id) {
      renderButton();
      return;
    }

    // Shared across remounts (e.g. React strict-mode's double-invoke in dev) so the script tag
    // is never injected twice — a second <script> load would re-run Google's own init code
    // against a button ref that's already been torn down.
    const existingScript = document.getElementById('google-identity-services');
    if (existingScript) {
      existingScript.addEventListener('load', renderButton);
      return () => existingScript.removeEventListener('load', renderButton);
    }

    const script = document.createElement('script');
    script.id = 'google-identity-services';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = renderButton;
    document.body.appendChild(script);
  }, []);

  if (!GOOGLE_CLIENT_ID) return null;

  return <div ref={buttonRef} className="flex justify-center" />;
}
