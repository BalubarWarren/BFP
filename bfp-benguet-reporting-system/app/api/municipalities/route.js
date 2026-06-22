import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request) {
  try {
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
