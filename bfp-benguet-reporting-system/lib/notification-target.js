import axios from 'axios';
import { NOTIFICATION_TYPES, ROLES } from './constants';

// Where clicking a notification takes the user. Returns one of:
//   { href }      navigate there (pages read `?open=<reportId>` and open that report)
//   { reportId }  open the report's read-only details where the user already is
//   { directives } open the investigator's Orders from Fire Marshal menu in the header
//   null          nothing specific to open
//
// Every href here must be a route isRouteAllowedForRole (lib/constants.js) allows for the role.
const REVIEW_QUEUE_PATH = {
  [ROLES.MUNICIPAL_CHIEF_IIS]: '/municipal/chief',
  [ROLES.MUNICIPAL_CHIEF_OPERATION]: '/municipal/chief',
  [ROLES.MUNICIPAL_FIRE_MARSHAL]: '/municipal/marshal',
  [ROLES.PROVINCIAL_CHIEF_IIS]: '/provincial/reports',
};

export function getNotificationTarget(notification, role) {
  const { type, reportId } = notification || {};

  switch (type) {
    case NOTIFICATION_TYPES.DIRECTIVE_RECEIVED:
    case NOTIFICATION_TYPES.DIRECTIVE_UPDATED:
      // Opens the header's "Orders from Fire Marshal" message menu (components/directives/DirectivesMenu.jsx).
      if (role === ROLES.INVESTIGATOR) return { directives: true };
      if (role === ROLES.MUNICIPAL_FIRE_MARSHAL) return { href: '/municipal/marshal/team' };
      return null;
    case NOTIFICATION_TYPES.DUTY_STATUS_CHANGED:
      return role === ROLES.MUNICIPAL_FIRE_MARSHAL ? { href: '/municipal/marshal/team' } : null;
    case NOTIFICATION_TYPES.ACCESS_REQUEST:
      return [ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(role) ? { href: '/admin/users' } : null;
    // A reopen / co-investigator request waiting for the Chief IIS's decision.
    case NOTIFICATION_TYPES.REPORT_REQUEST:
      if (role === ROLES.MUNICIPAL_CHIEF_IIS) return { href: '/municipal/chief#report-requests' };
      break;
    default:
      break;
  }

  if (!reportId) {
    // e.g. "your text blast was sent" — the sender's own reports are the closest thing.
    return role === ROLES.INVESTIGATOR ? { href: '/municipal/reports' } : null;
  }

  if (role === ROLES.INVESTIGATOR) {
    // A returned report's next step is revising it, so go straight to the revise page.
    if (type === NOTIFICATION_TYPES.REPORT_RETURNED) return { href: `/municipal/reports/${reportId}/edit` };
    return { href: `/municipal/reports?open=${reportId}` };
  }

  // A reviewer being asked to review: open it in their review queue, ready to approve/return.
  if (type === NOTIFICATION_TYPES.REPORT_SUBMITTED && REVIEW_QUEUE_PATH[role]) {
    return { href: `${REVIEW_QUEUE_PATH[role]}?open=${reportId}` };
  }

  return { reportId };
}

// Loads one report for a modal. Throws a user-facing message when it's gone or not viewable.
export async function fetchReportForModal(reportId) {
  try {
    const res = await axios.get(`/api/reports/${reportId}`, {
      headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
    });
    return res.data.report;
  } catch (err) {
    const status = err.response?.status;
    if (status === 404) throw new Error('That report no longer exists.');
    if (status === 403) throw new Error("You don't have access to that report anymore.");
    throw new Error('Could not open that report. Please try again.');
  }
}
