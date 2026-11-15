import { NextResponse } from 'next/server';
import { getUserFromRequest } from '../../../../lib/auth';
import { ROLES } from '../../../../lib/constants';
import { generateSampleStep, getSampleDataStatus, removeSampleBatch } from '../../../../lib/sample-data';
import { requirePasswordConfirmation } from '../../../../lib/confirm-password';

// Admin-only: sample cases/reports for testing (see lib/sample-data.js).
//   GET                          -> counts
//   POST { action: 'generate' }  -> one generation step (call until { done: true })
//   POST { action: 'remove', password } -> delete one batch of sample cases (call until { done: true });
//                                          the last call restores the placeholder tallies
export const maxDuration = 60;

const isAdmin = (user) => [ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(user?.role);

export async function GET(request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    return NextResponse.json(await getSampleDataStatus());
  } catch (error) {
    console.error('Sample data status failed:', error);
    return NextResponse.json({ error: 'Could not read sample data status' }, { status: 500 });
  }
}

export async function POST(request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body = {};
  try {
    body = await request.json();
  } catch {
    // empty body -> invalid action below
  }

  try {
    if (body.action === 'generate') {
      return NextResponse.json(await generateSampleStep(user));
    }
    if (body.action === 'remove') {
      const denied = await requirePasswordConfirmation(user, body.password, 'remove sample data');
      if (denied) return denied;
      return NextResponse.json(await removeSampleBatch());
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Sample data action failed:', error);
    return NextResponse.json({ error: 'Sample data action failed. Please try again.' }, { status: 500 });
  }
}
