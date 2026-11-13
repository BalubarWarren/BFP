import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { getUserFromRequest } from '../../../lib/auth';
import { canViewArchive } from '../../../lib/constants';
import { archiveWhereForUser, filterViewableArchiveItems, summarizeArchiveItem } from '../../../lib/archive';

// Lists archived report versions (read-only — nothing in the archive can be changed or deleted).
export async function GET(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canViewArchive(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const candidates = await prisma.trashItem.findMany({
      where: archiveWhereForUser(user),
      orderBy: { deletedAt: 'desc' },
      take: 500,
    });
    const items = await filterViewableArchiveItems(candidates, user);

    const ownerIds = [...new Set(items.map((item) => item.ownerId).filter(Boolean))];
    const owners = ownerIds.length
      ? await prisma.user.findMany({ where: { id: { in: ownerIds } }, select: { id: true, name: true } })
      : [];
    const ownerNames = new Map(owners.map((owner) => [owner.id, owner.name]));

    return NextResponse.json({
      items: items.map((item) => ({ ...summarizeArchiveItem(item), ownerName: ownerNames.get(item.ownerId) || null })),
    });
  } catch (error) {
    console.error('Error fetching archive:', error);
    return NextResponse.json({ error: 'Failed to load the archive' }, { status: 500 });
  }
}
