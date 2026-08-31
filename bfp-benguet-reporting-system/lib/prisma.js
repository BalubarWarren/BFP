import { PrismaClient } from '@prisma/client';
import { sendEmail, notificationEmail } from './email.js';

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
}

// Every in-app Notification is also delivered as a real email, so this hooks the one place
// notifications are written rather than adding an email call at each of the many call sites
// that create them (report submit/approve/return/overdue-check/text-blast, etc).
const emailForNotificationRecipient = async (userId) => {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  return user?.email || null;
};

if (!global.__notificationEmailMiddlewareRegistered) {
  prisma.$use(async (params, next) => {
    const result = await next(params);

    if (params.model === 'Notification' && (params.action === 'create' || params.action === 'createMany')) {
      const notifications = params.action === 'create' ? [params.args.data] : params.args.data;

      Promise.all(
        notifications.map(async (data) => {
          const email = await emailForNotificationRecipient(data.userId);
          if (!email) return;
          const reportUrl = data.reportId
            ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/municipal/reports`
            : null;
          const { subject, html } = notificationEmail({ message: data.message, reportUrl });
          await sendEmail({ to: email, subject, html });
        })
      ).catch((error) => console.error('[email] Notification email dispatch failed:', error));
    }

    return result;
  });
  global.__notificationEmailMiddlewareRegistered = true;
}

export default prisma;
