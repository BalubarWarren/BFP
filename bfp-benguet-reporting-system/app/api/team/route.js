import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { getUserFromRequest } from '../../../lib/auth';
import { ROLES, DIRECTIVE_STATUS, ONLINE_WINDOW_MS } from '../../../lib/constants';

// The Municipal Fire Marshal's roster: every investigator account in their own municipality, with
// whether they're on the system right now and how many orders they still have open.
export async function GET(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== ROLES.MUNICIPAL_FIRE_MARSHAL || !user.municipalityId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [investigators, openCounts, draftCounts] = await Promise.all([
      prisma.user.findMany({
        where: { role: ROLES.INVESTIGATOR, municipalityId: user.municipalityId },
        select: { id: true, name: true, email: true, rank: true, isActive: true, lastSeenAt: true },
        orderBy: { name: 'asc' },
      }),
      prisma.directive.groupBy({
        by: ['recipientId'],
        where: {
          municipalityId: user.municipalityId,
          status: { in: [DIRECTIVE_STATUS.PENDING, DIRECTIVE_STATUS.ACKNOWLEDGED] },
        },
        _count: { _all: true },
      }),
      // Reports still with the investigator (returned for correction, or approved and waiting to
      // be forwarded) — a rough view of their current workload before assigning more.
      prisma.report.groupBy({
        by: ['submittedById'],
        where: {
          municipalityId: user.municipalityId,
          submittedBy: { role: ROLES.INVESTIGATOR },
          OR: [{ status: 'RETURNED' }, { status: 'APPROVED', passedToId: { not: null } }],
        },
        _count: { _all: true },
      }),
    ]);

    const openByUser = Object.fromEntries(openCounts.map((row) => [row.recipientId, row._count._all]));
    const pendingByUser = Object.fromEntries(draftCounts.map((row) => [row.submittedById, row._count._all]));
    const onlineSince = Date.now() - ONLINE_WINDOW_MS;

    return NextResponse.json({
      investigators: investigators.map((investigator) => ({
        ...investigator,
        isOnline: investigator.isActive && !!investigator.lastSeenAt && investigator.lastSeenAt.getTime() >= onlineSince,
        openDirectives: openByUser[investigator.id] || 0,
        reportsNeedingAction: pendingByUser[investigator.id] || 0,
      })),
    });
  } catch (error) {
    console.error('Error fetching team:', error);
    return NextResponse.json({ error: 'Failed to fetch investigators' }, { status: 500 });
  }
}
