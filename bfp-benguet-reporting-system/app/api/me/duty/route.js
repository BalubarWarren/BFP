import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getUserFromRequest } from '../../../../lib/auth';
import { ROLES, NOTIFICATION_TYPES } from '../../../../lib/constants';
import {
  DUTY_LABELS,
  dutyStatusOn,
  dutyCalendar,
  nextDutyDate,
  manilaDate,
  describeSchedule,
  parseDutyOverride,
  formatDutyDate,
} from '../../../../lib/duty';

const DUTY_SELECT = {
  id: true, name: true, municipalityId: true,
  dutyOverride: true, dutyOverrideUntil: true, dutyOverrideNote: true, dutyOverrideSetAt: true,
  dutySchedule: { select: { pattern: true, weekdays: true, rotationStart: true, rotationCycle: true, rotationOnDays: true } },
};

const summarize = (person) => {
  const today = manilaDate();
  return {
    duty: dutyStatusOn(person, person.dutySchedule, today),
    week: dutyCalendar(person, person.dutySchedule, 7, today),
    nextDuty: nextDutyDate(person, person.dutySchedule, today),
    schedule: person.dutySchedule ? { ...person.dutySchedule, description: describeSchedule(person.dutySchedule) } : null,
    override: person.dutyOverride
      ? { status: person.dutyOverride, until: person.dutyOverrideUntil, note: person.dutyOverrideNote }
      : null,
  };
};

const loadInvestigator = async (request) => {
  const user = await getUserFromRequest(request);
  if (!user) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (user.role !== ROLES.INVESTIGATOR) {
    return { response: NextResponse.json({ error: 'Only investigators have a duty status' }, { status: 403 }) };
  }
  return { user };
};

// The signed-in investigator's duty status for today, the coming week, and their schedule.
export async function GET(request) {
  try {
    const { user, response } = await loadInvestigator(request);
    if (response) return response;
    const person = await prisma.user.findUnique({ where: { id: user.id }, select: DUTY_SELECT });
    return NextResponse.json(summarize(person));
  } catch (error) {
    console.error('Error fetching duty status:', error);
    return NextResponse.json({ error: 'Failed to load your duty status' }, { status: 500 });
  }
}

// The investigator marks an exception to their schedule — On Leave, Unavailable, or On Duty
// (called in on a day off) — through an end date, or clears it (status null) to follow the
// schedule again. Their Fire Marshal is notified (in-app and by email) when one is set.
export async function PUT(request) {
  try {
    const { user, response } = await loadInvestigator(request);
    if (response) return response;

    const parsed = parseDutyOverride(await request.json().catch(() => ({})));
    if (parsed.error) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const person = await prisma.user.update({ where: { id: user.id }, data: parsed.data, select: DUTY_SELECT });

    if (parsed.data.dutyOverride && person.municipalityId) {
      const marshals = await prisma.user.findMany({
        where: { role: ROLES.MUNICIPAL_FIRE_MARSHAL, municipalityId: person.municipalityId, isActive: true },
        select: { id: true },
      });
      if (marshals.length) {
        const untilText = parsed.data.dutyOverrideUntil === manilaDate() ? 'today' : `until ${formatDutyDate(parsed.data.dutyOverrideUntil)}`;
        const message = `${person.name} marked themselves ${DUTY_LABELS[parsed.data.dutyOverride]} ${untilText}`
          + (parsed.data.dutyOverrideNote ? ` — "${parsed.data.dutyOverrideNote}"` : '') + '.';
        await prisma.notification.createMany({
          data: marshals.map((marshal) => ({ userId: marshal.id, message, type: NOTIFICATION_TYPES.DUTY_STATUS_CHANGED })),
        });
      }
    }

    await prisma.auditLog.create({
      data: {
        action: 'SET_DUTY_STATUS',
        userId: user.id,
        changes: JSON.stringify({ status: parsed.data.dutyOverride, until: parsed.data.dutyOverrideUntil, note: parsed.data.dutyOverrideNote }),
      },
    });

    return NextResponse.json(summarize(person));
  } catch (error) {
    console.error('Error updating duty status:', error);
    return NextResponse.json({ error: 'Failed to update your duty status' }, { status: 500 });
  }
}
