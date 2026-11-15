'use client';

import { useEffect, useState } from 'react';

// Props for a password box the browser's password manager must leave alone (no saved-password
// dropdown, no "Suggest strong password"). Several people can share one browser here, and that
// dropdown would offer whatever password the browser saved for this site to whoever is signed in.
//
// Browsers ignore autocomplete="off" on type="password", so where supported the field is a plain
// text input whose characters are drawn as dots (-webkit-text-security, see .private-field in
// globals.css) — the password manager doesn't treat it as a password field at all. Browsers
// without that CSS fall back to an ordinary password input.
//
// `visible` = the show/hide toggle is on (show the characters).
export function usePrivateField(visible = false) {
  const [canMask, setCanMask] = useState(false);

  useEffect(() => {
    setCanMask(typeof CSS !== 'undefined' && CSS.supports?.('-webkit-text-security', 'disc'));
  }, []);

  return {
    type: canMask || visible ? 'text' : 'password',
    className: canMask && !visible ? 'private-field' : '',
    autoComplete: 'off',
    autoCorrect: 'off',
    autoCapitalize: 'off',
    spellCheck: false,
    // Third-party password managers' opt-out markers.
    'data-lpignore': 'true',
    'data-1p-ignore': 'true',
    'data-bwignore': 'true',
    'data-form-type': 'other',
  };
}
