import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { getUserFromRequest } from '../../../lib/auth';
import { parseJsonField } from '../../../lib/utils';
import { TRASH_ROLES } from '../../../lib/constants';
import { purgeExpiredTrash, purgeTrashItems, trashWhereForUser, isTrashAdmin } from '../../../lib/trash';

// Only the few fields the Trash list shows — the full snapshot can be large (report content,
// annotations) and is only needed server-side, on restore.
const summarize = (item) => {
  const { report, incident } = parseJsonField(item.data, {});
  return {
    id: item.id,
    itemType: item.itemType,
    originalId: item.originalId,
    label: item.label,
    ownerId: item.ownerId,
    deletedById: item.deletedById,
    deletedByName: item.deletedByName,
    deletedAt: item.deletedAt,
    expiresAt: item.expiresAt,
    report: report && {
      reportType: report.reportType,
      status: report.status,
      reportDate: report.reportDate,
      submittedAt: report.submittedAt,
      respondingOfficer: report.respondingOfficer,
      attachmentCount: parseJsonField(report.attachments, []).length,
    },
    referenceNumber: incident?.referenceNumber || null,
  };
};

export async function GET(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!TRASH_ROLES.includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await purgeExpiredTrash();

    const items = await prisma.trashItem.findMany({
      where: trashWhereForUser(user),
      orderBy: { deletedAt: 'desc' },
      take: 500,
    });

    const ownerIds = [...new Set(items.map((item) => item.ownerId).filter(Boolean))];
    const owners = ownerIds.length
      ? await prisma.user.findMany({ where: { id: { in: ownerIds } }, select: { id: true, name: true } })
      : [];
    const ownerMap = new Map(owners.map((owner) => [owner.id, owner.name]));

    return NextResponse.json({
      items: items.map((item) => ({ ...summarize(item), ownerName: ownerMap.get(item.ownerId) || null })),
    });
  } catch (error) {
    console.error('Error fetching trash:', error);
    return NextResponse.json({ error: 'Failed to load trash' }, { status: 500 });
  }
}

// Empty Trash — admins empty the whole bin, everyone else only their own items.
export async function DELETE(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!TRASH_ROLES.includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const items = await prisma.trashItem.findMany({
      where: trashWhereForUser(user),
      select: { id: true, originalId: true, label: true, data: true },
    });
    const count = await purgeTrashItems(items, user);

    return NextResponse.json({
      message: `${count} item(s) permanently deleted`,
      count,
      scope: isTrashAdmin(user) ? 'all' : 'own',
    });
  } catch (error) {
    console.error('Error emptying trash:', error);
    return NextResponse.json({ error: 'Failed to empty trash' }, { status: 500 });
  }
}
