import { NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import { getUserFromRequest } from '../../../../../lib/auth';
import { ROLES } from '../../../../../lib/constants';
import { requirePasswordConfirmation } from '../../../../../lib/confirm-password';

const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN];

// Step 1 of deleting an account: the admin confirms their own password, and gets back exactly
// what the delete would remove so step 2 can show it. Nothing is changed here; DELETE
// /api/users/:id checks the password again itself.
export async function POST(request, { params }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!ADMIN_ROLES.includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { password } = await request.json().catch(() => ({}));
    const passwordError = await requirePasswordConfirmation(user, password, 'delete-user');
    if (passwordError) return passwordError;

    const targetId = parseInt(params.id);
    if (targetId === user.id) {
      return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true, role: true } });
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (ADMIN_ROLES.includes(target.role) && user.role !== ROLES.SUPER_ADMIN) {
      return NextResponse.json({ error: 'Only a Super Admin can delete Admin or Super Admin accounts' }, { status: 403 });
    }

    const [reportCount, incidentCount, annotationCount] = await Promise.all([
      prisma.report.count({ where: { submittedById: targetId } }),
      prisma.incident.count({ where: { createdById: targetId } }),
      prisma.annotation.count({ where: { authorId: targetId } }),
    ]);

    return NextResponse.json({ reportCount, incidentCount, annotationCount });
  } catch (error) {
    console.error('Error checking account delete:', error);
    return NextResponse.json({ error: 'Failed to verify' }, { status: 500 });
  }
}
