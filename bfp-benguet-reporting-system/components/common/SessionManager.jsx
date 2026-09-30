'use client';

import { useEffect } from 'react';
import axios from 'axios';
import {
  getToken,
  getStoredUser,
  saveSession,
  clearSession,
  getTokenTimes,
  redirectToLogin,
  listenForOtherTabs,
} from '../../lib/session';
import { ROLE_HOME_PATH } from '../../lib/constants';

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

// Endpoints whose 401 means "wrong credentials", not "your session ended".
const CREDENTIAL_ENDPOINTS = ['/api/auth/login', '/api/auth/google'];

// Mounted once by the dashboard layout. Keeps the login alive while the app is in use and
// handles a login that really has ended in one place, instead of every page showing a "log out
// and log back in" banner:
//  - refreshes the token once it's past half its lifetime (checked every few minutes and when
//    the tab regains focus), so active users are never timed out;
//  - on any 401 from the API, clears the session and goes to the login page, which returns the
//    user to the page they were on after signing in;
//  - follows logouts and token refreshes from the user's other open tabs.
export default function SessionManager({ onUserChange }) {
  useEffect(() => {
    let refreshing = null;

    const refreshIfNeeded = async () => {
      const token = getToken();
      if (!token) return;
      const times = getTokenTimes(token);
      if (!times) return;
      const now = Date.now();
      if (now >= times.expiresAt) {
        clearSession();
        redirectToLogin({ expired: true });
        return;
      }
      if (now < times.issuedAt + (times.expiresAt - times.issuedAt) / 2) return;
      if (refreshing) return;

      refreshing = axios
        .post('/api/auth/refresh', null, { headers: { Authorization: `Bearer ${token}` } })
        .then(({ data }) => {
          const previousRole = getStoredUser()?.role;
          saveSession(data.token, data.user);
          if (previousRole && previousRole !== data.user.role) {
            // An admin changed this account's role — its current pages may no longer apply.
            window.location.assign(ROLE_HOME_PATH[data.user.role] || '/');
            return;
          }
          onUserChange?.(data.user);
        })
        // A 401 here is handled by the interceptor below; anything else (offline, server
        // hiccup) just waits for the next check, since the current token is still valid.
        .catch(() => {})
        .finally(() => {
          refreshing = null;
        });
    };

    const interceptorId = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        const url = error.config?.url || '';
        const isCredentialCheck = CREDENTIAL_ENDPOINTS.some((endpoint) => url.startsWith(endpoint));
        if (error.response?.status === 401 && !isCredentialCheck) {
          clearSession();
          redirectToLogin({ expired: true });
        }
        return Promise.reject(error);
      }
    );

    const stopListening = listenForOtherTabs({
      onLogout: () => window.location.assign('/login'),
      onSession: (user) => onUserChange?.(user),
    });

    refreshIfNeeded();
    const interval = setInterval(refreshIfNeeded, CHECK_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshIfNeeded();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refreshIfNeeded);

    return () => {
      axios.interceptors.response.eject(interceptorId);
      stopListening();
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refreshIfNeeded);
    };
  }, [onUserChange]);

  return null;
}
