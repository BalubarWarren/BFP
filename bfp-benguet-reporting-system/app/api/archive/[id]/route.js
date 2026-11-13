import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getUserFromRequest } from '../../../../lib/auth';
import { canViewArchive } from '../../../../lib/constants';
import { canViewArchiveItem, summarizeArchiveItem } from '../../../../lib/archive';
import { parseJsonField } from '../../../../lib/utils';

const USER_SELECT = { id: true, name: true, rank: true, role: true };

// Returns one archived version in the same shape as GET /api/reports/:id, so the regular report
// viewer can display it. Names are looked up fresh; the snapshot only stores ids.
export async function GET(request, { params }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canViewArchive(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const item = await prisma.trashItem.findUnique({ where: { id: parseInt(params.id) } });
    if (!item) return NextResponse.json({ error: 'Archived report not found' }, { status: 404 });
    if (!canViewArchiveItem(item, user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { report, incident: snapshotIncident } = parseJsonField(item.data, {});
    if (!report) return NextResponse.json({ error: 'This archived item is damaged.' }, { status: 500 });

    const [municipality, submittedBy, reviewedBy, passedTo, liveIncident] = await Promise.all([
      prisma.municipality.findUnique({ where: { id: report.municipalityId }, select: { id: true, name: true } }),
      prisma.user.findUnique({ where: { id: report.submittedById }, select: USER_SELECT }),
      report.reviewedById ? prisma.user.findUnique({ where: { id: report.reviewedById }, select: USER_SELECT }) : null,
      report.passedToId ? prisma.user.findUnique({ where: { id: report.passedToId }, select: USER_SELECT }) : null,
      report.incidentId && !snapshotIncident ? prisma.incident.findUnique({ where: { id: report.incidentId } }) : null,
    ]);

    return NextResponse.json({
      item: summarizeArchiveItem(item),
      report: {
        ...report,
        municipality,
        submittedBy,
        reviewedBy,
        passedTo,
        incident: snapshotIncident || liveIncident || null,
      },
    });
  } catch (error) {
    console.error('Error fetching archived report:', error);
    return NextResponse.json({ error: 'Failed to load the archived report' }, { status: 500 });
  }
}
