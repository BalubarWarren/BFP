import { PrismaClient } from '@prisma/client';
import { sendEmail, notificationEmail, APP_URL } from './email.js';

// On Vercel every concurrently running function instance gets its own PrismaClient, and Prisma's
// default pool opens several connections per instance (num_cpus * 2 + 1). With the dashboards
// polling, that quickly exceeds Supabase's connection cap, after which *every* query fails and
// every API route 500s. Serverless instances each handle one request at a time, so one connection
// apiece is enough (the Prisma-recommended setting for serverless). An explicit connection_limit
// already in DATABASE_URL is left alone. Supabase's transaction pooler (port 6543) additionally
// needs pgbouncer=true, since it can't hold the prepared statements Prisma uses by default.
function serverlessDatabaseUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw || !process.env.VERCEL) return undefined;
  try {
    const url = new URL(raw);
    if (!url.searchParams.has('connection_limit')) url.searchParams.set('connection_limit', '1');
    if (!url.searchParams.has('pool_timeout')) url.searchParams.set('pool_timeout', '20');
    if (url.port === '6543' && !url.searchParams.has('pgbouncer')) url.searchParams.set('pgbouncer', 'true');
    return url.toString();
  } catch {
    return undefined;
  }
}

let prisma;

if (process.env.NODE_ENV === 'production') {
  const url = serverlessDatabaseUrl();
  prisma = new PrismaClient(url ? { datasources: { db: { url } } } : undefined);
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

// Text-blast notifications store a JSON payload in `message` (see POST /api/reports/text-blast
// and parseNotificationMessage in components/common/Header.jsx) — unpack it so the email shows
// the actual text instead of raw JSON.
const readableNotification = (message) => {
  try {
    const payload = JSON.parse(message);
    if (payload?.kind === 'TEXT_BLAST') {
      return { message: payload.message || 'Text blast received.', note: payload.note || '' };
    }
  } catch {
    // Plain-text notification.
  }
  return { message, note: '' };
};

// Flag lives on the client itself (not `global`): in production each module instance creates its
// own PrismaClient, and a global flag would leave every client after the first without emails.
if (!prisma.__notificationEmailMiddlewareRegistered) {
  prisma.$use(async (params, next) => {
    const result = await next(params);

    if (params.model === 'Notification' && (params.action === 'create' || params.action === 'createMany')) {
      const notifications = params.action === 'create' ? [params.args.data] : params.args.data;

      // Awaited (not fire-and-forget) because on serverless hosts like Vercel the function can be
      // frozen as soon as the response is sent, silently dropping any still-pending email.
      await Promise.all(
        notifications.map(async (data) => {
          const email = await emailForNotificationRecipient(data.userId);
          if (!email) return;
          const { message, note } = readableNotification(data.message);
          // The site root sends a signed-in user to their own role's dashboard (reviewers don't
          // use /municipal/reports), so it's the one link that works for every recipient.
          const { subject, html } = notificationEmail({ message, note, reportUrl: APP_URL });
          await sendEmail({ to: email, subject, html });
        })
      ).catch((error) => console.error('[email] Notification email dispatch failed:', error));
    }

    return result;
  });
  prisma.__notificationEmailMiddlewareRegistered = true;
}

export default prisma;
