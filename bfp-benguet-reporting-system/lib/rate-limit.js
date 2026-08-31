// In-memory login attempt tracking. Good enough for this app's scale (a single Node process on
// Render, not horizontally scaled) — counters reset on redeploy, which is an acceptable tradeoff
// for a system this size vs. adding a persistent store just for rate limiting.

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // failed attempts are counted within this rolling window
const LOCKOUT_MS = 15 * 60 * 1000; // once locked out, how long before attempts are allowed again

const attempts = new Map(); // key -> { count, windowStart, lockedUntil }

// Prevent unbounded memory growth from one-off/expired entries piling up over a long-running process.
const sweepExpired = () => {
  const now = Date.now();
  for (const [key, entry] of attempts) {
    const expired = (!entry.lockedUntil || now > entry.lockedUntil) && now - entry.windowStart > WINDOW_MS;
    if (expired) attempts.delete(key);
  }
};

export function checkRateLimit(key) {
  sweepExpired();
  const entry = attempts.get(key);
  if (!entry) return { limited: false };

  const now = Date.now();
  if (entry.lockedUntil && now < entry.lockedUntil) {
    return { limited: true, retryAfterSeconds: Math.ceil((entry.lockedUntil - now) / 1000) };
  }
  return { limited: false };
}

export function recordFailedAttempt(key) {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    attempts.set(key, { count: 1, windowStart: now, lockedUntil: null });
    return;
  }

  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_MS;
  }
}

export function clearAttempts(key) {
  attempts.delete(key);
}

export function getClientIp(request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}
