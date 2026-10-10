import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getUserFromRequest, PUBLIC_USER_SELECT } from '../../../../lib/auth';
import { ROLES, INCIDENT_STATUS } from '../../../../lib/constants';

const INCIDENT_EDITOR_ROLES = [
  ROLES.INVESTIGATOR,
  ROLES.MUNICIPAL_CHIEF_IIS,
  ROLES.MUNICIPAL_CHIEF_OPERATION,
  ROLES.MUNICIPAL_FIRE_MARSHAL,
  ROLES.PROVINCIAL_CHIEF_IIS,
  ROLES.MARSHAL,
  ROLES.SUPER_ADMIN,
];

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
        createdBy: { select: PUBLIC_USER_SELECT },
        // Only what a case summary needs — not every linked report's full content and attachments.
        reports: {
          select: { id: true, reportType: true, status: true, reportDate: true, submittedById: true, passedToRole: true },
          orderBy: { reportDate: 'asc' },
        },
      },
    });

    if (!incident) {
      return NextResponse.json(
        { error: 'Incident not found' },
        { status: 404 }
      );
    }

    // Municipal roles can only view incidents within their municipality
    if (
      [ROLES.INVESTIGATOR, ROLES.MUNICIPAL_CHIEF_IIS, ROLES.MUNICIPAL_CHIEF_OPERATION, ROLES.MUNICIPAL_FIRE_MARSHAL].includes(user.role) &&
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

    // Same roles that may create incidents (POST /api/incidents) — every other role (PIO, regional
    // viewers, admins' read-only tracking role) could previously edit any incident in the province.
    if (!INCIDENT_EDITOR_ROLES.includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // RBAC: Only creator can update for municipal workflow roles
    if (
      [ROLES.INVESTIGATOR, ROLES.MUNICIPAL_CHIEF_IIS, ROLES.MUNICIPAL_CHIEF_OPERATION, ROLES.MUNICIPAL_FIRE_MARSHAL].includes(user.role) &&
      incident.createdById !== user.id
    ) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { status, casualtiesInjured, casualtiesFatalities, estimatedDamage, causeOfFire, fireInvestigationFindings } = body;

    if (status && !Object.values(INCIDENT_STATUS).includes(status)) {
      return NextResponse.json({ error: 'Invalid incident status' }, { status: 400 });
    }
    const counts = [casualtiesInjured, casualtiesFatalities].filter((value) => value !== undefined);
    if (counts.some((value) => !Number.isInteger(value) || value < 0)) {
      return NextResponse.json({ error: 'Casualty counts must be whole numbers' }, { status: 400 });
    }

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
        createdBy: { select: PUBLIC_USER_SELECT },
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
