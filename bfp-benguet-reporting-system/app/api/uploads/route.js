import { NextResponse } from 'next/server';
import { getUserFromRequest } from '../../../lib/auth';
import { ROLES } from '../../../lib/constants';
import { createSignedUploads } from '../../../lib/storage';

// Same roles POST /api/reports accepts submissions from.
const UPLOADER_ROLES = [
  ROLES.INVESTIGATOR,
  ROLES.MUNICIPAL_CHIEF_IIS,
  ROLES.MUNICIPAL_CHIEF_OPERATION,
  ROLES.MUNICIPAL_FIRE_MARSHAL,
  ROLES.PROVINCIAL_CHIEF_IIS,
  ROLES.MARSHAL,
];

// Hands the browser one signed upload URL per attachment so the file bytes go straight to
// Supabase Storage instead of through this API (see createSignedUploads in lib/storage.js).
export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!UPLOADER_ROLES.includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    let uploads;
    try {
      uploads = await createSignedUploads(body.files, 'reports');
    } catch (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ uploads });
  } catch (error) {
    console.error('Error preparing uploads:', error);
    return NextResponse.json({ error: 'Failed to prepare uploads' }, { status: 500 });
  }
}
