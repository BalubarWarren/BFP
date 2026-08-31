import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

// Fail fast rather than silently signing/verifying tokens with a public, guessable fallback
// secret if JWT_SECRET is ever missing (e.g. a misconfigured deploy) — but only when a token is
// actually signed or verified, not at module load. Next.js's build imports route modules to
// collect page data, so throwing at the top level would break `next build` itself whenever the
// env var isn't available during the build step (only guaranteed at runtime on some platforms).
function getJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required but not set.');
  }
  return process.env.JWT_SECRET;
}

// Generate JWT token
export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      municipalityId: user.municipalityId,
    },
    getJwtSecret(),
    { expiresIn: JWT_EXPIRY }
  );
}

// Verify JWT token
export async function verifyToken(token) {
  const secret = getJwtSecret();
  try {
    const decoded = jwt.verify(token, secret);
    return decoded;
  } catch (error) {
    throw new Error('Invalid token');
  }
}

// Hash password
export async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

// Compare password
export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// Extract token from request
export function getTokenFromRequest(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

// Get user from request
export async function getUserFromRequest(request) {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  
  try {
    return await verifyToken(token);
  } catch (error) {
    return null;
  }
}
