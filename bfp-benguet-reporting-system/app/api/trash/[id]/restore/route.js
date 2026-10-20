import { NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import { getUserFromRequest } from '../../../../../lib/auth';
import { canManageTrashItem, restoreTrashItem, TrashRestoreError } from '../../../../../lib/trash';

// Puts a trashed report back exactly where it was — same id, status and recipient — so it
// reappears in every list it was in before it was deleted.
export async function POST(request, { params }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const item = await prisma.trashItem.findUnique({ where: { id: parseInt(params.id) } });
    if (!item) return NextResponse.json({ error: 'This item is no longer in the Trash.' }, { status: 404 });
    if (!canManageTrashItem(item, user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const reportId = await restoreTrashItem(item, user);
    return NextResponse.json({ message: 'Report restored', reportId });
  } catch (error) {
    if (error instanceof TrashRestoreError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    // P2025: the item was restored or purged by someone else between the lookup and the delete.
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'This item is no longer in the Trash.' }, { status: 404 });
    }
    console.error('Error restoring trash item:', error);
    return NextResponse.json({ error: 'Failed to restore item' }, { status: 500 });
  }
}
