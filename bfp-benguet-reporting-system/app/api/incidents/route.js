import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import generateIncidentReference from '@/lib/incident-reference';

export async function GET(request) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const municipalityId = searchParams.get('municipalityId');

    let whereCondition = {};

    // RBAC: Investigators can only see their own municipality's incidents
    if (user.role === ROLES.INVESTIGATOR) {
      whereCondition.municipalityId = user.municipalityId;
    } else if (municipalityId) {
      whereCondition.municipalityId = parseInt(municipalityId);
    }

    const incidents = await prisma.incident.findMany({
      where: whereCondition,
      include: {
        municipality: true,
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ incidents });
  } catch (error) {
    console.error('Error fetching incidents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch incidents' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Allow workflow roles to create incidents
    if (![ROLES.INVESTIGATOR, ROLES.MUNICIPAL_CHIEF_IIS, ROLES.MUNICIPAL_FIRE_MARSHAL, ROLES.PROVINCIAL_CHIEF_IIS, ROLES.MARSHAL, ROLES.SUPER_ADMIN].includes(user.role)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      municipalityId,
      dateOfIncident,
      timeOfIncident,
      barangay,
      address,
      generalCategory,
      subCategory,
      description,
      estimatedAffectedArea,
      status,
      casualtiesInjured,
      casualtiesFatalities,
      estimatedDamage,
    } = body;

    // Validate required fields
    if (!municipalityId || !dateOfIncident || !generalCategory) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Municipal roles can only create incidents in their municipality
    if ([ROLES.INVESTIGATOR, ROLES.MUNICIPAL_CHIEF_IIS, ROLES.MUNICIPAL_FIRE_MARSHAL].includes(user.role) && user.municipalityId !== parseInt(municipalityId)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Generate incident reference number
    const referenceNumber = await generateIncidentReference();

    const incident = await prisma.incident.create({
      data: {
        referenceNumber,
        municipalityId: parseInt(municipalityId),
        dateOfIncident: new Date(dateOfIncident),
        timeOfIncident,
        barangay,
        address,
        generalCategory,
        subCategory,
        description,
        estimatedAffectedArea,
        status: status || 'ONGOING',
        casualtiesInjured: casualtiesInjured || 0,
        casualtiesFatalities: casualtiesFatalities || 0,
        estimatedDamage: estimatedDamage ? parseFloat(estimatedDamage) : null,
        createdById: user.id,
      },
      include: {
        municipality: true,
        createdBy: true,
      },
    });

    return NextResponse.json(
      {
        incident,
        message: 'Incident created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating incident:', error);
    return NextResponse.json(
      { error: 'Failed to create incident' },
      { status: 500 }
    );
  }
}
