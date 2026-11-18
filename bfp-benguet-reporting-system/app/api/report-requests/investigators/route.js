import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getUserFromRequest } from '../../../../lib/auth';
import { ROLES } from '../../../../lib/constants';

// GET: the other active investigators of the caller's municipality — the people an investigator
// can ask to add as co-investigator on a report.
export async function GET(request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== ROLES.INVESTIGATOR || !user.municipalityId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const investigators = await prisma.user.findMany({
    where: { role: ROLES.INVESTIGATOR, municipalityId: user.municipalityId, isActive: true, id: { not: user.id } },
    select: { id: true, name: true, rank: true },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json({ investigators });
}
