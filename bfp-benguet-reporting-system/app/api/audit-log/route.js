import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { getUserFromRequest } from '../../../lib/auth';
import { ROLES } from '../../../lib/constants';

const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN];
const PAGE_SIZE = 50;

// AuditLog.userId/reportId are plain, relation-less Int columns (see prisma/schema.prisma) — by
// design, so an audit trail doesn't get wiped or blocked by cascading deletes/FK constraints on
// the very rows it's recording. That means there's no `include` to lean on here; the referenced
// users/reports are looked up separately and stitched back on, and a reportId that no longer
// resolves (the report was since deleted) is simply reported as null rather than treated as an error.
export async function GET(request) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!ADMIN_ROLES.includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const cursor = searchParams.get('cursor');

    // Ordering and the pagination cursor both key off `id` rather than `createdAt` — ids are
    // guaranteed unique and monotonically increasing, so a cursor built from one is unambiguous
    // even if two rows land on the same millisecond.
    const page = await prisma.auditLog.findMany({
      where: action ? { action } : {},
      orderBy: { id: 'desc' },
      take: PAGE_SIZE + 1,
      ...(cursor && { cursor: { id: parseInt(cursor) }, skip: 1 }),
    });

    const hasMore = page.length > PAGE_SIZE;
    const logs = hasMore ? page.slice(0, PAGE_SIZE) : page;
    const nextCursor = hasMore ? logs[logs.length - 1].id : null;

    const userIds = [...new Set(logs.map((log) => log.userId).filter((id) => id !== null))];
    const reportIds = [...new Set(logs.map((log) => log.reportId).filter((id) => id !== null))];

    const [users, reports] = await Promise.all([
      userIds.length
        ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, role: true } })
        : Promise.resolve([]),
      reportIds.length
        ? prisma.report.findMany({
            where: { id: { in: reportIds } },
            select: {
              id: true,
              reportType: true,
              municipality: { select: { name: true } },
              incident: { select: { referenceNumber: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    const userMap = new Map(users.map((u) => [u.id, u]));
    const reportMap = new Map(reports.map((r) => [r.id, r]));

    const entries = logs.map((log) => ({
      id: log.id,
      action: log.action,
      createdAt: log.createdAt,
      changes: log.changes,
      actor: userMap.get(log.userId) || null,
      report: reportMap.get(log.reportId) || null,
    }));

    return NextResponse.json({ entries, nextCursor });
  } catch (error) {
    console.error('Error fetching audit log:', error);
    return NextResponse.json({ error: 'Failed to fetch audit log' }, { status: 500 });
  }
}
