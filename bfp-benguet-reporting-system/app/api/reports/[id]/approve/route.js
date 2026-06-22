import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { ROLES, REPORT_STATUS, NOTIFICATION_TYPES } from '@/lib/constants';

export async function POST(request, { params }) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Only MARSHAL can approve/reject reports
    if (user.role !== ROLES.MARSHAL) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const report = await prisma.report.findUnique({
      where: { id: parseInt(params.id) },
      include: {
        submittedBy: true,
      },
    });

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { action, remarks } = body; // action: 'approve', 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

    const newStatus = action === 'approve' ? REPORT_STATUS.APPROVED : REPORT_STATUS.RETURNED;

    const updatedReport = await prisma.report.update({
      where: { id: parseInt(params.id) },
      data: {
        status: newStatus,
        reviewedAt: new Date(),
        reviewedById: user.id,
        remarks: remarks || null,
      },
      include: {
        submittedBy: true,
        municipality: true,
      },
    });

    // Create notification for the submitter
    await prisma.notification.create({
      data: {
        userId: report.submittedById,
        message:
          action === 'approve'
            ? `Your report from ${updatedReport.municipality.name} has been approved.`
            : `Your report from ${updatedReport.municipality.name} has been returned for revision.`,
        type:
          action === 'approve'
            ? NOTIFICATION_TYPES.REPORT_APPROVED
            : NOTIFICATION_TYPES.REPORT_RETURNED,
        reportId: report.id,
      },
    });

    return NextResponse.json({
      report: updatedReport,
      message: `Report ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
    });
  } catch (error) {
    console.error('Error approving/rejecting report:', error);
    return NextResponse.json(
      { error: 'Failed to process report' },
      { status: 500 }
    );
  }
}
