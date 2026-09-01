import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getUserFromRequest, hashPassword } from '../../../../lib/auth';
import { ROLES } from '../../../../lib/constants';

const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN];

const MUNICIPAL_ROLES = [
  ROLES.INVESTIGATOR,
  ROLES.MUNICIPAL_CHIEF_IIS,
  ROLES.MUNICIPAL_CHIEF_OPERATION,
  ROLES.MUNICIPAL_FIRE_MARSHAL,
];

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  rank: true,
  isActive: true,
  municipalityId: true,
  municipality: { select: { id: true, name: true, code: true } },
  createdAt: true,
};

export async function PATCH(request, { params }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!ADMIN_ROLES.includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const targetId = parseInt(params.id);
    const existingUser = await prisma.user.findUnique({ where: { id: targetId } });
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { name, role, rank, municipalityId, isActive, password } = await request.json();

    if (targetId === user.id && isActive === false) {
      return NextResponse.json({ error: 'You cannot deactivate your own account' }, { status: 400 });
    }

    if (role && !ROLES[role]) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const isTargetAdminTier = ADMIN_ROLES.includes(existingUser.role);
    const isAssigningAdminTier = role !== undefined && ADMIN_ROLES.includes(role);
    if ((isTargetAdminTier || isAssigningAdminTier) && user.role !== ROLES.SUPER_ADMIN) {
      return NextResponse.json(
        { error: 'Only a Super Admin can manage Admin or Super Admin accounts' },
        { status: 403 }
      );
    }

    const effectiveRole = role || existingUser.role;
    const effectiveMunicipalityId = municipalityId !== undefined
      ? (municipalityId ? parseInt(municipalityId) : null)
      : existingUser.municipalityId;

    if (MUNICIPAL_ROLES.includes(effectiveRole) && !effectiveMunicipalityId) {
      return NextResponse.json(
        { error: 'Municipality is required for this role' },
        { status: 400 }
      );
    }

    if (password && password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const updateData = {
      ...(name !== undefined && { name }),
      ...(role !== undefined && { role }),
      ...(rank !== undefined && { rank: rank || null }),
      ...(municipalityId !== undefined && { municipalityId: effectiveMunicipalityId }),
      ...(isActive !== undefined && { isActive }),
      ...(password && { passwordHash: await hashPassword(password) }),
    };

    const updatedUser = await prisma.user.update({
      where: { id: targetId },
      data: updateData,
      select: userSelect,
    });

    return NextResponse.json({ user: updatedUser, message: 'User updated successfully' });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
