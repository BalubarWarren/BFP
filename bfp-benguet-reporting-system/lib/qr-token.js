import { randomBytes } from 'crypto';

// Public, unguessable id for the /verify/[qrToken] page a report's QR code encodes — 32 random
// bytes, base64url so it drops straight into a URL path with no encoding. Collisions are
// astronomically unlikely (2^256 space) so callers don't loop-and-retry on conflict.
//
// A report gets one the moment it is first passed (POST /api/reports) and keeps it for life:
// returning and correcting a report edits the same row, so a QR code that was already printed or
// shared keeps working and always shows the report's latest version and status.
export const generateQrToken = () => randomBytes(32).toString('base64url');
