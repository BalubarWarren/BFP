import prisma from './prisma.js';
import { MUNICIPAL_REVIEWER_ROLES, PROVINCIAL_REVIEWER_ROLES } from './report-access.js';

// Only reviewer roles fan out — a report routed back to its investigator must never notify every
// investigator in the province.
const REVIEWER_ROLES = [...MUNICIPAL_REVIEWER_ROLES, ...PROVINCIAL_REVIEWER_ROLES];

// A report passed to a reviewer role can be opened and acted on by every active holder of that
// role (see isReportRecipient in lib/report-access.js) — e.g. every Provincial Chief IIS, or
// every Municipal Chief IIS of the report's municipality. passedToId only records one of them,
// so notifying just that account left the others (and their email inboxes) unaware of it.
export async function notifyReportRecipients({ report, message, type, excludeUserId }) {
  const fansOut = REVIEWER_ROLES.includes(report.passedToRole);
  const recipients = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [
        ...(report.passedToId ? [{ id: report.passedToId }] : []),
        ...(fansOut
          ? [{
              role: report.passedToRole,
              ...(MUNICIPAL_REVIEWER_ROLES.includes(report.passedToRole) && { municipalityId: report.municipalityId }),
            }]
          : []),
      ],
      ...(excludeUserId && { id: { not: excludeUserId } }),
    },
    select: { id: true },
  });

  if (!recipients.length) return;

  await prisma.notification.createMany({
    data: recipients.map((recipient) => ({
      userId: recipient.id,
      message,
      type,
      reportId: report.id,
    })),
  });
}
