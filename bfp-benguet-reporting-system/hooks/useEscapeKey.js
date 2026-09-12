'use client';

import { useEffect } from 'react';

// None of the app's modals closed on Escape — a keyboard user had to Tab all the way to a Cancel
// button (or click the backdrop, unreachable without a mouse) to get out of one.
export function useEscapeKey(onEscape, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;
    const handler = (e) => {
      if (e.key === 'Escape') onEscape();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onEscape, enabled]);
}
