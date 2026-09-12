import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { getUserFromRequest } from '../../../lib/auth';

export async function GET(request) {
  try {
    // Every caller (admin/users pages) already sends a bearer token — this was the one route in
    // the whole API surface with no access control at all.
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const municipalities = await prisma.municipality.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json({
      municipalities,
    });
  } catch (error) {
    console.error('Error fetching municipalities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch municipalities' },
      { status: 500 }
    );
  }
}
