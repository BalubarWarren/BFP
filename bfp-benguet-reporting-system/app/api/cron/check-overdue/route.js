import { NextResponse } from 'next/server';
import { runOverdueCheck } from '../../../../lib/check-overdue-reports';
import { purgeExpiredTrash } from '../../../../lib/trash';

export async function POST(request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const summary = await runOverdueCheck();
    const trashPurged = await purgeExpiredTrash();
    return NextResponse.json({ message: 'Overdue check complete', ...summary, trashPurged });
  } catch (error) {
    console.error('Error running overdue check:', error);
    return NextResponse.json({ error: 'Failed to run overdue check' }, { status: 500 });
  }
}
