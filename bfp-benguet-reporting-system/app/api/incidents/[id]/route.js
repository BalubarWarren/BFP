import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { ROLES } from '@/lib/constants';

export async function GET(request, { params }) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const incident = await prisma.incident.findUnique({
      where: { id: parseInt(params.id) },
      include: {
        municipality: true,
        createdBy: true,
        reports: true,
      },
    });

    if (!incident) {
      return NextResponse.json(
        { error: 'Incident not found' },
        { status: 404 }
      );
    }

    // RBAC: Municipal officers can only view their own incidents
    if (
      user.role === ROLES.MUNICIPAL_OFFICER &&
      incident.municipalityId !== user.municipalityId
    ) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    return NextResponse.json({ incident });
  } catch (error) {
    console.error('Error fetching incident:', error);
    return NextResponse.json(
      { error: 'Failed to fetch incident' },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const incident = await prisma.incident.findUnique({
      where: { id: parseInt(params.id) },
    });

    if (!incident) {
      return NextResponse.json(
        { error: 'Incident not found' },
        { status: 404 }
      );
    }

    // RBAC: Only creator or SUPER_ADMIN can update
    if (
      user.role === ROLES.MUNICIPAL_OFFICER &&
      incident.createdById !== user.id
    ) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { status, casualtiesInjured, casualtiesFatalities, estimatedDamage, causeOfFire, fireInvestigationFindings } = body;

    const updatedIncident = await prisma.incident.update({
      where: { id: parseInt(params.id) },
      data: {
        ...(status && { status }),
        ...(casualtiesInjured !== undefined && { casualtiesInjured }),
        ...(casualtiesFatalities !== undefined && { casualtiesFatalities }),
        ...(estimatedDamage && { estimatedDamage: parseFloat(estimatedDamage) }),
        ...(causeOfFire && { causeOfFire }),
        ...(fireInvestigationFindings && { fireInvestigationFindings }),
      },
      include: {
        municipality: true,
        createdBy: true,
      },
    });

    return NextResponse.json({
      incident: updatedIncident,
      message: 'Incident updated successfully',
    });
  } catch (error) {
    console.error('Error updating incident:', error);
    return NextResponse.json(
      { error: 'Failed to update incident' },
      { status: 500 }
    );
  }
}
