import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getUserFromRequest } from '../../../../lib/auth';
import { canManageTrashItem, purgeTrashItems } from '../../../../lib/trash';

// Permanently deletes one trashed item (and its attachment files). There is no undo after this.
export async function DELETE(request, { params }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const item = await prisma.trashItem.findUnique({ where: { id: parseInt(params.id) } });
    if (!item) return NextResponse.json({ error: 'This item is no longer in the Trash.' }, { status: 404 });
    if (!canManageTrashItem(item, user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await purgeTrashItems([item], user);
    return NextResponse.json({ message: 'Permanently deleted' });
  } catch (error) {
    console.error('Error purging trash item:', error);
    return NextResponse.json({ error: 'Failed to delete item permanently' }, { status: 500 });
  }
}
