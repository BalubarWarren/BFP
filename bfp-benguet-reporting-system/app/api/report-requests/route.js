import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { getUserFromRequest } from '../../../lib/auth';
import { ROLES } from '../../../lib/constants';
import { REQUEST_DECIDER_ROLES, listRequestsForDecider } from '../../../lib/report-requests';

// GET /api/report-requests[?status=PENDING]
//   Municipal Chief IIS: every request in their municipality (their decision queue).
//   Investigator: requests they made or that name them as co-investigator.
export async function GET(request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const status = new URL(request.url).searchParams.get('status') || undefined;

  if (REQUEST_DECIDER_ROLES.includes(user.role)) {
    return NextResponse.json({ requests: await listRequestsForDecider(user, { status }) });
  }

  if (user.role === ROLES.INVESTIGATOR) {
    try {
      const requests = await prisma.reportRequest.findMany({
        where: { OR: [{ requestedById: user.id }, { targetUserId: user.id }], ...(status && { status }) },
        include: {
          requestedBy: { select: { id: true, name: true } },
          targetUser: { select: { id: true, name: true } },
          decidedBy: { select: { id: true, name: true } },
          report: { select: { id: true, reportType: true, status: true, incident: { select: { referenceNumber: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      return NextResponse.json({ requests });
    } catch {
      return NextResponse.json({ requests: [] });
    }
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
