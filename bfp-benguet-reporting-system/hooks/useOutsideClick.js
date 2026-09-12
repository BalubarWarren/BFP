'use client';

import { useEffect } from 'react';

// Closes a dropdown/panel when the user clicks anywhere outside `ref`'s element — the header's
// notification and profile dropdowns previously stayed open until their own toggle button was
// clicked again.
export function useOutsideClick(ref, onOutsideClick, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onOutsideClick();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onOutsideClick, enabled]);
}
