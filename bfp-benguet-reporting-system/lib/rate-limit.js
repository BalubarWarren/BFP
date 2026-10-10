// In-memory login attempt tracking. NOTE: the app now runs on Vercel, where each concurrently
// running function instance has its own memory — so these counters are per instance and reset on
// cold starts. That still stops a fast burst of guesses (which tends to hit one warm instance) but
// is not a hard guarantee; a shared store (a DB table or Redis) would be needed for that.

const MAX_ATTEMPTS = 5;
// Keys starting with "ip:" get a much higher ceiling: a whole fire station (or a mobile carrier's
// carrier-grade NAT) shares one public IP, so 5 typos across everyone there used to lock the entire
// station out of logging in for 15 minutes. Per-account keys keep the strict limit above.
const MAX_ATTEMPTS_PER_IP = 30;
const maxAttemptsFor = (key) => (key.startsWith('ip:') ? MAX_ATTEMPTS_PER_IP : MAX_ATTEMPTS);
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
  if (entry.count >= maxAttemptsFor(key)) {
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
