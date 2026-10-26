import { NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import { getUserFromRequest } from '../../../../../lib/auth';
import { REPORT_STATUS } from '../../../../../lib/constants';
import { generateQrToken } from '../../../../../lib/qr-token';
import { canUserViewReport } from '../../../../../lib/report-view-access';

// Returns a report's QR token, minting one for a report passed before QR codes were issued at
// submission (POST /api/reports sets one going forward) — the QR Code button calls this the first
// time someone opens the QR modal for such a report, so there's no need for a one-off backfill
// migration. Idempotent: a report that already has a token just gets it echoed back.
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

    // Same rule as who may open this report at all (GET /api/reports/[id]).
    if (!(await canUserViewReport(report, user))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (report.qrToken) {
      return NextResponse.json({ qrToken: report.qrToken });
    }

    // A draft hasn't been passed to anyone yet, so there's nothing to verify.
    if (report.status === REPORT_STATUS.DRAFT) {
      return NextResponse.json({ error: 'A QR code is issued once the report is submitted.' }, { status: 400 });
    }

    // Only set if still empty: two people opening the QR modal for the first time at once would
    // otherwise each mint a token, and the second would silently invalidate a QR code the first
    // may already have printed. The loser just returns whichever token won.
    await prisma.report.updateMany({ where: { id: report.id, qrToken: null }, data: { qrToken: generateQrToken() } });
    const { qrToken } = await prisma.report.findUnique({ where: { id: report.id }, select: { qrToken: true } });

    return NextResponse.json({ qrToken });
  } catch (error) {
    console.error('Error generating report QR token:', error);
    return NextResponse.json({ error: 'Failed to generate QR code' }, { status: 500 });
  }
}
