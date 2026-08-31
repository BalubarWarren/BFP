import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { ROLES } from '@/lib/constants';

const MUNICIPAL_REVIEWER_ROLES = [
  ROLES.MUNICIPAL_CHIEF_IIS,
  ROLES.MUNICIPAL_CHIEF_OPERATION,
  ROLES.MUNICIPAL_FIRE_MARSHAL,
];

const PROVINCIAL_REVIEWER_ROLES = [
  ROLES.PROVINCIAL_CHIEF_IIS,
  ROLES.MARSHAL,
  ROLES.CHIEF_INVESTIGATOR_IIS,
];

const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN];

const allowedReviewers = [...MUNICIPAL_REVIEWER_ROLES, ...PROVINCIAL_REVIEWER_ROLES];

const isReportRecipient = (report, user) => {
  if (report.passedToId === user.id) return true;
  if (report.passedToRole !== user.role) return false;
  if (PROVINCIAL_REVIEWER_ROLES.includes(user.role)) return true;
  if (MUNICIPAL_REVIEWER_ROLES.includes(user.role)) {
    return report.municipalityId === user.municipalityId;
  }
  return false;
};

const canViewReport = (report, user) =>
  report.submittedById === user.id ||
  report.reviewedById === user.id ||
  isReportRecipient(report, user) ||
  ADMIN_ROLES.includes(user.role);

export async function GET(request, { params }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const report = await prisma.report.findUnique({ where: { id: parseInt(params.id) } });
    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    if (!canViewReport(report, user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const attachmentUrl = searchParams.get('attachmentUrl');

    const annotations = await prisma.annotation.findMany({
      where: {
        reportId: report.id,
        ...(attachmentUrl ? { attachmentUrl } : {}),
      },
      include: {
        author: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ annotations });
  } catch (error) {
    console.error('Error fetching annotations:', error);
    return NextResponse.json({ error: 'Failed to fetch annotations' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!allowedReviewers.includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const report = await prisma.report.findUnique({ where: { id: parseInt(params.id) } });
    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    if (!isReportRecipient(report, user)) {
      return NextResponse.json(
        { error: 'This report is not currently assigned to your account or role' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { attachmentUrl, comment, highlightData } = body;

    if (!attachmentUrl || !comment || !highlightData) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const annotation = await prisma.annotation.create({
      data: {
        reportId: report.id,
        attachmentUrl,
        authorId: user.id,
        comment,
        highlightData: typeof highlightData === 'string' ? highlightData : JSON.stringify(highlightData),
      },
      include: {
        author: { select: { id: true, name: true, role: true } },
      },
    });

    return NextResponse.json({ annotation, message: 'Annotation created successfully' }, { status: 201 });
  } catch (error) {
    console.error('Error creating annotation:', error);
    return NextResponse.json({ error: 'Failed to create annotation' }, { status: 500 });
  }
}
