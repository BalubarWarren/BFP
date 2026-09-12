'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'bfp-theme';

function resolveIsDark(preference) {
  if (preference === 'dark') return true;
  if (preference === 'light') return false;
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyTheme(preference) {
  document.documentElement.classList.toggle('dark', resolveIsDark(preference));
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('system');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) || 'system';
    setThemeState(stored);
    applyTheme(stored);

    // Only react to OS-level changes while the user has left the preference on "system" —
    // an explicit light/dark choice shouldn't get silently overridden by the OS switching.
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if ((localStorage.getItem(STORAGE_KEY) || 'system') === 'system') applyTheme('system');
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const setTheme = useCallback((next) => {
    localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
    applyTheme(next);
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
