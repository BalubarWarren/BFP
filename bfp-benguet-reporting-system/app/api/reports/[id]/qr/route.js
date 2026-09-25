import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import { getUserFromRequest } from '../../../../../lib/auth';
import { canViewReportViaArchive } from '../../../../../lib/report-access';

// Same generator as the automatic one in POST /api/reports/[id]/approve — kept identical (32
// random bytes, base64url) rather than importing from there, since that route has no exports of
// its own to share (Next route modules only export the HTTP method handlers).
const generateQrToken = () => randomBytes(32).toString('base64url');

// Lazily mints a qrToken for a report that was finally approved before the QR feature shipped
// (POST /api/reports/[id]/approve only sets one going forward, at the moment of approval) — the
// Reports archive page calls this the first time someone opens the QR modal for such a report,
// so there's no need for a one-off backfill migration against every already-approved report.
// Idempotent: a report that already has a token just gets it echoed back.
export async function POST(request, { params }) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const report = await prisma.report.findUnique({ where: { id: parseInt(params.id) } });

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Same rule as who may open this report through the archive in the first place: finally
    // approved, and (for the two municipal archive roles) within their own municipality.
    if (!canViewReportViaArchive(report, user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (report.qrToken) {
      return NextResponse.json({ qrToken: report.qrToken });
    }

    const qrToken = generateQrToken();
    await prisma.report.update({ where: { id: report.id }, data: { qrToken } });

    return NextResponse.json({ qrToken });
  } catch (error) {
    console.error('Error generating report QR token:', error);
    return NextResponse.json({ error: 'Failed to generate QR code' }, { status: 500 });
  }
}
