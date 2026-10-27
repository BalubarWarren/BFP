// Who is on duty — kept separate from "online" (lastSeenAt), which only means FireTrack is open.
// Today's status comes from, in order:
//   1. the investigator's own exception (users.dutyOverride*) while it hasn't passed its end date,
//   2. the duty schedule their Fire Marshal set (DutySchedule),
//   3. otherwise NO_SCHEDULE — unknown, so nothing is assumed either way.
// Pure functions on plain data, shared by the API routes and the pages. All dates are Manila
// calendar dates as "YYYY-MM-DD" strings, so a duty day never shifts with the server's timezone.

export const DUTY = {
  ON_DUTY: 'ON_DUTY',
  OFF_DUTY: 'OFF_DUTY',
  ON_LEAVE: 'ON_LEAVE',
  UNAVAILABLE: 'UNAVAILABLE',
  NO_SCHEDULE: 'NO_SCHEDULE',
};

// What an investigator can set on themselves.
export const DUTY_OVERRIDES = [DUTY.ON_LEAVE, DUTY.UNAVAILABLE, DUTY.ON_DUTY];

export const DUTY_LABELS = {
  ON_DUTY: 'On Duty',
  OFF_DUTY: 'Off Duty',
  ON_LEAVE: 'On Leave',
  UNAVAILABLE: 'Unavailable',
  NO_SCHEDULE: 'No Schedule',
};

export const DUTY_BADGE_CLASSES = {
  ON_DUTY: 'bg-green-100 text-green-800',
  OFF_DUTY: 'bg-gray-100 text-gray-700',
  ON_LEAVE: 'bg-amber-100 text-amber-800',
  UNAVAILABLE: 'bg-orange-100 text-orange-800',
  NO_SCHEDULE: 'bg-gray-100 text-gray-500',
};

// Sort order on the Fire Marshal's list: who can take work today first.
export const DUTY_SORT = { ON_DUTY: 0, NO_SCHEDULE: 1, OFF_DUTY: 2, UNAVAILABLE: 3, ON_LEAVE: 4 };

// Common BFP shift patterns, as rotation cycles.
export const ROTATION_PRESETS = [
  { key: '24-24', label: '24 hours on, 24 hours off', cycle: 2, onDays: 1 },
  { key: '24-48', label: '24 hours on, 48 hours off', cycle: 3, onDays: 1 },
  { key: '24-72', label: '24 hours on, 72 hours off', cycle: 4, onDays: 1 },
];

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const isDateString = (value) => DATE_RE.test(String(value || '')) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

export const manilaDate = (date = new Date()) => date.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

const toUtcDay = (dateString) => Date.parse(`${dateString}T00:00:00Z`) / 86400000;

export const addDays = (dateString, days) =>
  new Date((toUtcDay(dateString) + days) * 86400000).toISOString().slice(0, 10);

export const parseWeekdays = (weekdays) =>
  String(weekdays || '').split(',').filter((d) => d !== '').map(Number).filter((d) => d >= 0 && d <= 6);

// Whether the schedule has them on duty on the given date (null if there's no usable schedule).
export function isScheduledOn(schedule, dateString) {
  if (!schedule) return null;
  if (schedule.pattern === 'WEEKLY') {
    const days = parseWeekdays(schedule.weekdays);
    if (!days.length) return null;
    return days.includes(new Date(`${dateString}T00:00:00Z`).getUTCDay());
  }
  if (schedule.pattern === 'ROTATION') {
    const { rotationStart, rotationCycle: cycle, rotationOnDays: onDays } = schedule;
    if (!isDateString(rotationStart) || !(cycle >= 2) || !(onDays >= 1)) return null;
    const offset = ((Math.round(toUtcDay(dateString) - toUtcDay(rotationStart)) % cycle) + cycle) % cycle;
    return offset < onDays;
  }
  return null;
}

const overrideActive = (person, dateString) =>
  DUTY_OVERRIDES.includes(person?.dutyOverride) && isDateString(person.dutyOverrideUntil) && person.dutyOverrideUntil >= dateString;

// { status, source: 'self' | 'schedule' | null, until, note } for one date (default: today, Manila).
export function dutyStatusOn(person, schedule, dateString = manilaDate()) {
  if (overrideActive(person, dateString)) {
    return { status: person.dutyOverride, source: 'self', until: person.dutyOverrideUntil, note: person.dutyOverrideNote || null };
  }
  const scheduled = isScheduledOn(schedule, dateString);
  if (scheduled === null) return { status: DUTY.NO_SCHEDULE, source: null, until: null, note: null };
  return { status: scheduled ? DUTY.ON_DUTY : DUTY.OFF_DUTY, source: 'schedule', until: null, note: null };
}

// The next `days` days starting today, each with its duty status — for the schedule previews.
export function dutyCalendar(person, schedule, days = 7, from = manilaDate()) {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(from, i);
    return { date, ...dutyStatusOn(person, schedule, date) };
  });
}

// First upcoming on-duty date after today, if the schedule has one within two weeks.
export function nextDutyDate(person, schedule, from = manilaDate()) {
  return dutyCalendar(person, schedule, 15, from).slice(1).find((day) => day.status === DUTY.ON_DUTY)?.date || null;
}

export const formatDutyDate = (dateString) =>
  new Date(`${dateString}T00:00:00Z`).toLocaleDateString('en-PH', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });

// One line describing a schedule, e.g. "Mon, Tue, Wed" or "24 hours on, 48 hours off".
export function describeSchedule(schedule) {
  if (!schedule) return 'No schedule set';
  if (schedule.pattern === 'WEEKLY') {
    const days = parseWeekdays(schedule.weekdays);
    return days.length ? days.sort((a, b) => a - b).map((d) => WEEKDAY_SHORT[d]).join(', ') : 'No schedule set';
  }
  const preset = ROTATION_PRESETS.find((p) => p.cycle === schedule.rotationCycle && p.onDays === schedule.rotationOnDays);
  return preset ? preset.label : `${schedule.rotationOnDays} on, ${schedule.rotationCycle - schedule.rotationOnDays} off (days)`;
}

// The investigator's exception, as stored on the users table, from a request body. Returns
// { data } to save, or { error }.
export function parseDutyOverride(body, today = manilaDate()) {
  if (!body?.status) {
    return { data: { dutyOverride: null, dutyOverrideUntil: null, dutyOverrideNote: null, dutyOverrideSetAt: null } };
  }
  if (!DUTY_OVERRIDES.includes(body.status)) return { error: 'Invalid duty status' };
  const until = body.until || today;
  if (!isDateString(until)) return { error: 'Invalid end date' };
  if (until < today) return { error: 'The end date cannot be in the past' };
  if (until > addDays(today, 90)) return { error: 'The end date can be at most 90 days away' };
  const note = String(body.note || '').trim().slice(0, 200) || null;
  return { data: { dutyOverride: body.status, dutyOverrideUntil: until, dutyOverrideNote: note, dutyOverrideSetAt: new Date() } };
}

// The Fire Marshal's schedule from a request body. Returns { data } (null = remove), or { error }.
export function parseDutySchedule(body) {
  if (body?.pattern === 'NONE' || !body?.pattern) return { data: null };
  if (body.pattern === 'WEEKLY') {
    const days = [...new Set((Array.isArray(body.weekdays) ? body.weekdays : []).map(Number))].filter((d) => d >= 0 && d <= 6);
    if (!days.length) return { error: 'Pick at least one duty day' };
    return { data: { pattern: 'WEEKLY', weekdays: days.sort((a, b) => a - b).join(','), rotationStart: null, rotationCycle: null, rotationOnDays: null } };
  }
  if (body.pattern === 'ROTATION') {
    const cycle = Number(body.rotationCycle);
    const onDays = Number(body.rotationOnDays);
    if (!isDateString(body.rotationStart)) return { error: 'Pick the date of a duty day to count the rotation from' };
    if (!Number.isInteger(cycle) || cycle < 2 || cycle > 14) return { error: 'The rotation cycle must be 2 to 14 days' };
    if (!Number.isInteger(onDays) || onDays < 1 || onDays >= cycle) return { error: 'On-duty days must be at least 1 and fewer than the cycle' };
    return { data: { pattern: 'ROTATION', weekdays: null, rotationStart: body.rotationStart, rotationCycle: cycle, rotationOnDays: onDays } };
  }
  return { error: 'Invalid schedule type' };
}
