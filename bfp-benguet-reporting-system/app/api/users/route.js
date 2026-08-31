import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest, hashPassword } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { sendEmail, welcomeAccountEmail } from '@/lib/email';

const formatRoleLabel = (role) =>
  role.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

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

export async function GET(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!ADMIN_ROLES.includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      select: userSelect,
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!ADMIN_ROLES.includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { name, email, password, role, rank, municipalityId } = await request.json();

    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!ROLES[role]) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const parsedMunicipalityId = municipalityId ? parseInt(municipalityId) : null;

    if (MUNICIPAL_ROLES.includes(role) && !parsedMunicipalityId) {
      return NextResponse.json(
        { error: 'Municipality is required for this role' },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role,
        rank: rank || null,
        municipalityId: parsedMunicipalityId,
      },
      select: userSelect,
    });

    const { subject, html } = welcomeAccountEmail({
      name,
      email,
      password,
      roleLabel: formatRoleLabel(role),
    });
    await sendEmail({ to: email, subject, html });

    return NextResponse.json({ user: newUser, message: 'User created successfully' }, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
