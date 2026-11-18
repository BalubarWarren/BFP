import { DEADLINES } from './constants';

// Submission deadlines for the investigation reports, shared by the server (status badges in the
// report lists, and requiring an Explanation Report for late submissions in POST /api/reports)
// and the forms (showing the explanation field before submitting). Same periods as the overdue
// reminders in lib/check-overdue-reports.js:
//   Spot      within SPOT_OVERDUE_HOURS of the fire (incident date + time)
//   Progress  within PROGRESS_OVERDUE_DAYS of the Spot report's final approval
//   Final     within FINAL_OVERDUE_DAYS of the Progress report's final approval (or the Spot
//             report's, when the case skipped Progress)

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

const describeLate = (ms) => {
  const days = Math.floor(ms / DAY);
  if (days >= 1) return `${days} day${days === 1 ? '' : 's'}`;
  const hours = Math.max(1, Math.round(ms / HOUR));
  return `${hours} hour${hours === 1 ? '' : 's'}`;
};

// Was the report submitted on time? { status: 'ON_TIME' | 'DELAYED', deadline, detail } or null
// (draft, or no deadline applies).
export function getSubmissionTimeliness(report, { incident, caseReports = [] } = {}) {
  if (!report || report.status === 'DRAFT') return null;
  const deadline = getSubmissionDeadline(report.reportType, { incident: incident || report.incident, caseReports });
  const submittedAt = toDate(report.submittedAt);
  if (!deadline || !submittedAt) return null;
  const late = submittedAt - deadline;
  return late > 0
    ? { status: 'DELAYED', deadline, detail: `Submitted ${describeLate(late)} after the deadline` }
    : { status: 'ON_TIME', deadline, detail: 'Submitted within the deadline' };
}

// For a finally-approved Spot/Progress report: is the case's next report overdue right now?
// { label, detail } or null.
export function getFollowUpDelay(report, caseReports = [], now = new Date()) {
  if (!isFinallyApprovedReport(report)) return null;
  const filed = (type) => caseReports.some((r) => r.reportType === type && r.status !== 'DRAFT');
  if (filed('FINAL_INVESTIGATION')) return null;

  if (report.reportType === 'SPOT_INVESTIGATION' && !filed('PROGRESS_INVESTIGATION')) {
    const due = getSubmissionDeadline('PROGRESS_INVESTIGATION', { caseReports: [...caseReports, report] });
    if (due && now > due) return { label: 'Next report delayed', detail: `Progress or Final report was due ${due.toLocaleDateString()}` };
  }
  if (report.reportType === 'PROGRESS_INVESTIGATION') {
    const due = getSubmissionDeadline('FINAL_INVESTIGATION', { caseReports: [...caseReports, report] });
    if (due && now > due) return { label: 'Final report delayed', detail: `Final report was due ${due.toLocaleDateString()}` };
  }
  return null;
}

export const LATE_EXPLANATION_MIN_LENGTH = 10;
