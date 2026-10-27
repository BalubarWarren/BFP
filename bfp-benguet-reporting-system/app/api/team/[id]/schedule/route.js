import { NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import { getUserFromRequest } from '../../../../../lib/auth';
import { ROLES } from '../../../../../lib/constants';
import { parseDutySchedule, describeSchedule } from '../../../../../lib/duty';

// Sets (or removes, with pattern "NONE") one investigator's duty schedule — only by the Municipal
// Fire Marshal of that investigator's own municipality. See lib/duty.js for how it's used.
export async function PUT(request, { params }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== ROLES.MUNICIPAL_FIRE_MARSHAL || !user.municipalityId) {
      return NextResponse.json({ error: 'Only a Municipal Fire Marshal can set duty schedules' }, { status: 403 });
    }

    const investigatorId = parseInt(params.id);
    const investigator = await prisma.user.findFirst({
      where: { id: Number.isNaN(investigatorId) ? -1 : investigatorId, role: ROLES.INVESTIGATOR, municipalityId: user.municipalityId },
      select: { id: true, name: true },
    });
    if (!investigator) {
      return NextResponse.json({ error: 'Investigator not found in your municipality' }, { status: 404 });
    }

    const parsed = parseDutySchedule(await request.json().catch(() => ({})));
    if (parsed.error) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    let schedule = null;
    if (parsed.data) {
      schedule = await prisma.dutySchedule.upsert({
        where: { userId: investigator.id },
        create: { ...parsed.data, userId: investigator.id, updatedById: user.id },
        update: { ...parsed.data, updatedById: user.id },
      });
    } else {
      await prisma.dutySchedule.deleteMany({ where: { userId: investigator.id } });
    }

    await prisma.auditLog.create({
      data: {
        action: 'SET_DUTY_SCHEDULE',
        userId: user.id,
        changes: JSON.stringify({ investigatorId: investigator.id, investigatorName: investigator.name, schedule: describeSchedule(schedule) }),
      },
    });

    return NextResponse.json({ schedule });
  } catch (error) {
    console.error('Error setting duty schedule:', error);
    return NextResponse.json({ error: 'Failed to save the duty schedule' }, { status: 500 });
  }
}
