import { randomInt } from 'crypto';

// "Forgot password?" on the login page — see POST /api/auth/forgot-password (emails a code) and
// POST /api/auth/reset-password (redeems it). Kept here so both routes share the same limits.
export const RESET_CODE_TTL_MINUTES = 10;
// Wrong guesses allowed per code before it's burned and a new one must be requested. With a
// 6-digit code that's a 5-in-a-million chance per code, and codes themselves are capped below.
export const RESET_CODE_MAX_ATTEMPTS = 5;
// Stops the "Resend code" button (or a script) from flooding someone's inbox.
export const RESET_CODE_RESEND_SECONDS = 60;
export const RESET_CODES_PER_HOUR = 5;

export const MIN_PASSWORD_LENGTH = 8;

// Six digits, leading zeros kept — crypto.randomInt, not Math.random, so it isn't predictable.
export const generateResetCode = () => String(randomInt(0, 1000000)).padStart(6, '0');

export const normalizeEmail = (email) => String(email || '').trim();
