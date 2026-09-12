import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getUserFromRequest, hashPassword } from '../../../../lib/auth';
import { ROLES } from '../../../../lib/constants';

const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN];

class ForeignReportConflictError extends Error {
  constructor(referenceNumber) {
    super('Incident has reports submitted by another user');
    this.referenceNumber = referenceNumber;
  }
}

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

// Permanently removes an account (e.g. cleaning up test accounts after a testing pass).
// `Report.submittedById` and `Incident.createdById` are required FKs with no cascade rule, so a
// user who has ever submitted a report or created an incident can't simply be deleted — this
// cascades their own reports/incidents/annotations instead, but refuses if one of their incidents
// still carries reports submitted by someone else, since deleting it would sever real data that
// isn't this user's to remove.
export async function DELETE(request, { params }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!ADMIN_ROLES.includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const targetId = parseInt(params.id);

    if (targetId === user.id) {
      return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({ where: { id: targetId } });
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (ADMIN_ROLES.includes(existingUser.role) && user.role !== ROLES.SUPER_ADMIN) {
      return NextResponse.json(
        { error: 'Only a Super Admin can delete Admin or Super Admin accounts' },
        { status: 403 }
      );
    }

    if (existingUser.role === ROLES.SUPER_ADMIN) {
      const activeSuperAdmins = await prisma.user.count({
        where: { role: ROLES.SUPER_ADMIN, isActive: true },
      });
      if (activeSuperAdmins <= 1) {
        return NextResponse.json(
          { error: 'Cannot delete the last active Super Admin account' },
          { status: 400 }
        );
      }
    }

    const MAX_DELETE_ATTEMPTS = 3;
    try {
      // The foreign-report check and the deletes run inside the same Serializable transaction so
      // a report submitted by someone else against one of this user's incidents between the
      // check and the delete aborts the whole transaction instead of still being destroyed.
      // Serializable can itself abort with a write-conflict error (P2034) whenever it detects
      // any concurrent transaction touching the same rows, even with no real foreign-report
      // conflict — that's retried like any optimistic-concurrency scheme, same as the
      // incident-reference collision retry in lib/incident-reference.js.
      for (let attempt = 1; attempt <= MAX_DELETE_ATTEMPTS; attempt += 1) {
        try {
          await prisma.$transaction(
            async (tx) => {
              const incidentWithForeignReport = await tx.report.findFirst({
                where: {
                  incident: { createdById: targetId },
                  submittedById: { not: targetId },
                },
                include: { incident: { select: { referenceNumber: true } } },
              });

              if (incidentWithForeignReport) {
                throw new ForeignReportConflictError(incidentWithForeignReport.incident?.referenceNumber);
              }

              await tx.annotation.deleteMany({ where: { authorId: targetId } });
              await tx.report.deleteMany({ where: { submittedById: targetId } });
              await tx.incident.deleteMany({ where: { createdById: targetId } });
              await tx.user.delete({ where: { id: targetId } });
            },
            { isolationLevel: 'Serializable' }
          );
          break;
        } catch (error) {
          if (error.code === 'P2034' && attempt < MAX_DELETE_ATTEMPTS) continue;
          throw error;
        }
      }
    } catch (error) {
      if (error instanceof ForeignReportConflictError) {
        return NextResponse.json(
          { error: `Cannot delete: incident ${error.referenceNumber || '(unknown)'} created by this user has reports submitted by other users` },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
