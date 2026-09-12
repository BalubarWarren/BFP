'use client';

import { useState, useEffect, useCallback } from 'react';

// Loads the signed-in user from sessionStorage on mount, and exposes a way to force-refresh it
// from /api/auth/me for the (rare) case a report submission form mounts before sessionStorage
// has been populated. Shared by every report submission form instead of each reimplementing it.
export function useEffectiveUser() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const userData = sessionStorage.getItem('user');
    if (userData) setUser(JSON.parse(userData));
  }, []);

  const getEffectiveUser = useCallback(async () => {
    if (user) return user;
    try {
      const token = sessionStorage.getItem('token');
      const meRes = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
      if (meRes.ok) {
        const meJson = await meRes.json();
        sessionStorage.setItem('user', JSON.stringify(meJson.user));
        setUser(meJson.user);
        return meJson.user;
      }
    } catch (e) {
      // ignore — caller treats a null return as "not authenticated"
    }
    return null;
  }, [user]);

  return { user, getEffectiveUser };
}
