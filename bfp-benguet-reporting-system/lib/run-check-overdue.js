// Standalone entry point for local/manual testing: `npm run check-overdue`.
// The deployed cron job does NOT use this — it hits POST /api/cron/check-overdue instead, so the
// check runs inside the already-running web service (see app/api/cron/check-overdue/route.js for why).
import prisma from './prisma.js';
import { runOverdueCheck } from './check-overdue-reports.js';

runOverdueCheck()
  .then(async (summary) => {
    console.log('Overdue check complete:', summary);
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error('Error running overdue check:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
