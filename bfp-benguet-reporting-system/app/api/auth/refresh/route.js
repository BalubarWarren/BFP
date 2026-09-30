import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getUserFromRequest, generateToken } from '../../../../lib/auth';

// Sliding session: an open tab trades its still-valid token for a fresh one before it expires
// (see components/common/SessionManager.jsx), so someone actively using the app is never kicked
// out mid-work. An expired, invalid, or deactivated-account token is refused like anywhere else —
// this can only extend a session, never revive one.
export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const municipality = user.municipalityId
      ? await prisma.municipality.findUnique({ where: { id: user.municipalityId } })
      : null;

    // Re-read from the database by getUserFromRequest, so a role/municipality an admin changed
    // since login is picked up here too.
    return NextResponse.json({
      token: generateToken(user),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        rank: user.rank,
        municipalityId: user.municipalityId,
        municipality,
      },
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json({ error: 'Failed to refresh session' }, { status: 500 });
  }
}
