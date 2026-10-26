'use client';

import { useEffect, useRef } from 'react';

// Modals currently listening for Escape, most recently opened last — only the top one closes, so
// a modal opened from inside another (e.g. a report's QR code) doesn't take its parent with it.
const openModals = [];

// None of the app's modals closed on Escape — a keyboard user had to Tab all the way to a Cancel
// button (or click the backdrop, unreachable without a mouse) to get out of one.
export function useEscapeKey(onEscape, enabled = true) {
  // Kept in a ref so a parent re-rendering with a new inline callback doesn't re-register this
  // modal (which would move it to the top of the stack above a modal opened after it).
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    if (!enabled) return undefined;
    const entry = {};
    openModals.push(entry);
    const handler = (e) => {
      if (e.key === 'Escape' && openModals[openModals.length - 1] === entry) onEscapeRef.current();
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      openModals.splice(openModals.indexOf(entry), 1);
    };
  }, [enabled]);
}
