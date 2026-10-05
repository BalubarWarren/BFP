// Client-side session helpers. The login lives in sessionStorage, which is per-tab — so a link
// opened in a new tab (e.g. from a notification email) used to land on a logged-out page. Open
// tabs now share the session over a BroadcastChannel: a tab with no session asks the others for
// theirs, and logging out (or a refreshed token) in one tab applies to all of them. Closing every
// tab still ends the session, as before.

const TOKEN_KEY = 'token';
const USER_KEY = 'user';
const CHANNEL_NAME = 'firetrack-session';

// Messages carry the sending tab's id so a tab ignores its own broadcasts (a second
// BroadcastChannel object in the same tab would otherwise receive them).
const TAB_ID = Math.random().toString(36).slice(2);

let channel = null;
let redirecting = false;
const getChannel = () => {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME);
  return channel;
};

export const getToken = () => sessionStorage.getItem(TOKEN_KEY);

export const getStoredUser = () => {
  try {
    return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
};

export function saveSession(token, user, { broadcast = true } = {}) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  if (broadcast) getChannel()?.postMessage({ type: 'session', token, user, from: TAB_ID });
}

export function clearSession({ broadcast = true } = {}) {
  const userId = getStoredUser()?.id;
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  if (broadcast) getChannel()?.postMessage({ type: 'logout', userId, from: TAB_ID });
}

// Each tab can be signed in as a different account (a new tab asks for its own login), so a tab
// only follows another tab's logout or token refresh when it's for the same account. Without
// this, logging in as someone else in a second tab overwrote this tab's token, and this tab's
// requests started going out as that other account (e.g. an admin page answering "Forbidden").
const isSameAccount = (userId) => userId != null && userId === getStoredUser()?.id;

// Reads the JWT's own expiry (seconds since epoch) without verifying it — only used to decide
// when to refresh; the server still verifies every token.
export function getTokenTimes(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return { issuedAt: payload.iat * 1000, expiresAt: payload.exp * 1000 };
  } catch {
    return null;
  }
}

// Sends the user to the login page, remembering where they were so login can bring them back.
export function redirectToLogin({ expired = false } = {}) {
  if (redirecting) return;
  redirecting = true;
  const next = window.location.pathname + window.location.search;
  const params = new URLSearchParams();
  if (expired) params.set('expired', '1');
  if (next && next !== '/' && !next.startsWith('/login')) params.set('next', next);
  const query = params.toString();
  window.location.assign(`/login${query ? `?${query}` : ''}`);
}

// Only same-site paths are honoured as a post-login destination (never `//evil.com` or a full
// URL), so the `next` parameter can't be used to bounce someone to another site.
export function safeNextPath(next) {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return null;
  return next;
}

// Asks other open tabs for their session. Resolves true once one answers (and the session is
// stored in this tab), or false after `timeoutMs` if no tab is logged in.
export function requestSessionFromOtherTabs(timeoutMs = 400) {
  const bc = getChannel();
  if (!bc) return Promise.resolve(false);

  return new Promise((resolve) => {
    // A separate listener channel: a BroadcastChannel never receives its own messages, and the
    // shared one may already have a listener installed by SessionManager.
    const listener = new BroadcastChannel(CHANNEL_NAME);
    const finish = (result) => {
      clearTimeout(timer);
      listener.close();
      resolve(result);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    listener.onmessage = (event) => {
      if (event.data?.type === 'session' && event.data.token && event.data.user) {
        saveSession(event.data.token, event.data.user, { broadcast: false });
        finish(true);
      }
    };
    bc.postMessage({ type: 'request', from: TAB_ID });
  });
}

// Installed once per logged-in tab (see SessionManager): answers other tabs' requests and follows
// their logouts/refreshes. Returns an unsubscribe function.
export function listenForOtherTabs({ onLogout, onSession } = {}) {
  const bc = new BroadcastChannel(CHANNEL_NAME);
  bc.onmessage = (event) => {
    const { type, from } = event.data || {};
    if (from === TAB_ID) return;
    if (type === 'request') {
      const token = getToken();
      const user = getStoredUser();
      if (token && user) bc.postMessage({ type: 'session', token, user, from: TAB_ID });
    } else if (type === 'logout' && isSameAccount(event.data.userId)) {
      clearSession({ broadcast: false });
      redirecting = true;
      onLogout?.();
    } else if (type === 'session' && event.data.token && getToken() && isSameAccount(event.data.user?.id)) {
      // Another tab refreshed this same account's token — keep this tab's copy current too.
      saveSession(event.data.token, event.data.user, { broadcast: false });
      onSession?.(event.data.user);
    }
  };
  return () => bc.close();
}
