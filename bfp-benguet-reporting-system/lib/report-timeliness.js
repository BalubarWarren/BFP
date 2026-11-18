import { DEADLINES } from './constants';

// Submission deadlines for the investigation reports, shared by the server (status badges in the
// report lists, and requiring an Explanation Report for late submissions in POST /api/reports)
// and the forms (showing the explanation field before submitting). Same periods as the overdue
// reminders in lib/check-overdue-reports.js:
//   Spot      within SPOT_OVERDUE_HOURS of the fire (incident date + time)
//   Progress  due 7 to 15 days (PROGRESS_DUE_DAYS..PROGRESS_OVERDUE_DAYS) after the Spot report's
//             final approval; delayed after that
//   Final     due 30 to 45 days (FINAL_WARNING_DAYS..FINAL_OVERDUE_DAYS) after the Progress
//             report's final approval (or the Spot report's, when the case skipped Progress)

const HOUR = 3600000;
const DAY = 24 * HOUR;
const MANILA_OFFSET_HOURS = 8;

const toDate = (value) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const isFinallyApprovedReport = (r) => r?.status === 'APPROVED' && !r?.passedToId;

// The moment of the fire: the incident date (stored as that calendar day) plus its "HH:MM" time,
// read as Philippine time.
export function getIncidentMoment(incident) {
  const date = toDate(incident?.dateOfIncident);
  if (!date) return null;
  const [h, m] = String(incident?.timeOfIncident || '00:00').split(':').map((n) => parseInt(n, 10) || 0);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), h - MANILA_OFFSET_HOURS, m));
}

// When the period for a report of `reportType` opens (the Progress/Final "due from" day), from the
// case's other reports. Null for the Spot report, or when it can't be told yet.
export function getSubmissionWindowStart(reportType, { caseReports = [] } = {}) {
  const deadline = getSubmissionDeadline(reportType, { caseReports });
  if (!deadline) return null;
  if (reportType === 'PROGRESS_INVESTIGATION') {
    return new Date(deadline.getTime() - (DEADLINES.PROGRESS_OVERDUE_DAYS - DEADLINES.PROGRESS_DUE_DAYS) * DAY);
  }
  if (reportType === 'FINAL_INVESTIGATION') {
    return new Date(deadline.getTime() - (DEADLINES.FINAL_OVERDUE_DAYS - DEADLINES.FINAL_WARNING_DAYS) * DAY);
  }
  return null;
}

// When a report of `reportType` was due, from the incident and the case's other reports (each
// with reportType, status, passedToId, reviewedAt). Null when it can't be told yet.
export function getSubmissionDeadline(reportType, { incident, caseReports = [] } = {}) {
  if (reportType === 'SPOT_INVESTIGATION') {
    const moment = getIncidentMoment(incident);
    return moment ? new Date(moment.getTime() + DEADLINES.SPOT_OVERDUE_HOURS * HOUR) : null;
  }
  const approved = (type) =>
    caseReports
      .filter((r) => r.reportType === type && isFinallyApprovedReport(r) && r.reviewedAt)
      .map((r) => toDate(r.reviewedAt))
      .sort((a, b) => a - b)[0] || null;

  if (reportType === 'PROGRESS_INVESTIGATION') {
    const spot = approved('SPOT_INVESTIGATION');
    return spot ? new Date(spot.getTime() + DEADLINES.PROGRESS_OVERDUE_DAYS * DAY) : null;
  }
  if (reportType === 'FINAL_INVESTIGATION') {
    const anchor = approved('PROGRESS_INVESTIGATION') || approved('SPOT_INVESTIGATION');
    return anchor ? new Date(anchor.getTime() + DEADLINES.FINAL_OVERDUE_DAYS * DAY) : null;
  }
  return null;
}

// "3 days", or "5 hours" when it's under a day.
export const describeLate = (ms) => {
  const days = Math.floor(ms / DAY);
  if (days >= 1) return `${days} day${days === 1 ? '' : 's'}`;
  const hours = Math.max(1, Math.round(ms / HOUR));
  return `${hours} hour${hours === 1 ? '' : 's'}`;
};

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const shortDate = (d) => d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' });

// Was the report submitted on time? { status: 'ON_TIME' | 'DELAYED', deadline, detail, late,
// daysLate } or null (draft, or no deadline applies). `late` is "3 days" / "5 hours".
export function getSubmissionTimeliness(report, { incident, caseReports = [] } = {}) {
  if (!report || report.status === 'DRAFT') return null;
  const deadline = getSubmissionDeadline(report.reportType, { incident: incident || report.incident, caseReports });
  const submittedAt = toDate(report.submittedAt);
  if (!deadline || !submittedAt) return null;
  const late = submittedAt - deadline;
  return late > 0
    ? {
      status: 'DELAYED',
      deadline,
      late: describeLate(late),
      daysLate: Math.floor(late / DAY),
      detail: `Submitted ${describeLate(late)} after the deadline (${shortDate(deadline)})`,
    }
    : { status: 'ON_TIME', deadline, detail: `Submitted within the deadline (${shortDate(deadline)})` };
}

// For a finally-approved Spot/Progress report: where the case's next report stands right now.
//   { level: 'delayed', label: 'Progress report delayed · 3 days', detail, daysLate }
//   { level: 'due',     label: 'Progress report due in 5 days', detail }   (inside its 7-15 / 30-45 day period)
// or null (not due yet, or already filed).
export function getFollowUpDelay(report, caseReports = [], now = new Date()) {
  if (!isFinallyApprovedReport(report)) return null;
  const filed = (type) => caseReports.some((r) => r.reportType === type && r.status !== 'DRAFT');
  if (filed('FINAL_INVESTIGATION')) return null;

  let next = null;
  if (report.reportType === 'SPOT_INVESTIGATION' && !filed('PROGRESS_INVESTIGATION')) next = ['PROGRESS_INVESTIGATION', 'Progress report'];
  if (report.reportType === 'PROGRESS_INVESTIGATION') next = ['FINAL_INVESTIGATION', 'Final report'];
  if (!next) return null;

  const [type, name] = next;
  const reports = [...caseReports, report];
  const due = getSubmissionDeadline(type, { caseReports: reports });
  const opens = getSubmissionWindowStart(type, { caseReports: reports });
  if (!due) return null;

  if (now > due) {
    const late = now - due;
    return {
      level: 'delayed',
      label: `${name} delayed · ${describeLate(late)}`,
      detail: `${name} was due ${shortDate(due)}, ${describeLate(late)} ago`,
      daysLate: Math.floor(late / DAY),
    };
  }
  if (opens && now >= opens) {
    const left = Math.max(1, Math.ceil((due - now) / DAY));
    return {
      level: 'due',
      label: `${name} due in ${plural(left, 'day')}`,
      detail: `${name} must be submitted by ${shortDate(due)}`,
    };
  }
  return null;
}

export const LATE_EXPLANATION_MIN_LENGTH = 10;
