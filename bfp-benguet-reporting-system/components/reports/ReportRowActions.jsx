'use client';

import Link from 'next/link';
import { Eye, PencilLine, RotateCcw, Send } from 'lucide-react';
import CaseFollowUpCta from './CaseFollowUpCta';
import ReportQrButton from './ReportQrButton';
import { getReportProgress } from './ReportProgressBar';

const isFinallyApproved = (report) => report?.status === 'APPROVED' && !report?.passedToId;
export const needsForwarding = (report) => report?.status === 'APPROVED' && !!report?.passedToId;

// The "Actions" cell of an investigator's report table. At most one highlighted button — the
// single thing this report needs from the investigator next — with View and QR Code underneath.
// Where the report is in the review chain lives in the Status column (ReportProgressBar), so this
// cell stays about actions only. Deleting is done from the report's detail view, not the row.
export default function ReportRowActions({ report, allReports, onView, onForward }) {
  const nextStep = getNextStep(report, allReports, onForward);

  return (
    <div className="flex min-w-[10.5rem] flex-col items-start gap-2">
      {nextStep}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onView(report)}
          className="btn btn-secondary text-sm py-1 px-3 inline-flex items-center gap-1.5"
        >
          <Eye className="h-3.5 w-3.5" /> View
        </button>
        <ReportQrButton report={report} className="btn btn-secondary text-sm py-1 px-3" />
      </div>
    </div>
  );
}

function getNextStep(report, allReports, onForward) {
  if (report.status === 'DRAFT') {
    return (
      <Link
        href={`/municipal/reports/${report.id}/edit`}
        className="btn btn-primary text-sm py-1.5 px-3 inline-flex items-center gap-1.5 whitespace-nowrap"
      >
        <PencilLine className="h-3.5 w-3.5" /> Continue Editing
      </Link>
    );
  }

  if (report.status === 'RETURNED') {
    return (
      <Link
        href={`/municipal/reports/${report.id}/edit`}
        className="btn btn-danger text-sm py-1.5 px-3 inline-flex items-center gap-1.5 whitespace-nowrap"
      >
        <RotateCcw className="h-3.5 w-3.5" /> Revise &amp; Resubmit
      </Link>
    );
  }

  if (needsForwarding(report) && onForward) {
    const nextRole = getReportProgress(report)?.nextRoleLabel;
    return (
      <button
        type="button"
        onClick={() => onForward(report)}
        className="btn btn-primary text-sm py-1.5 px-3 inline-flex items-center gap-1.5 whitespace-nowrap"
        title={nextRole ? `Submit to ${nextRole}` : undefined}
      >
        <Send className="h-3.5 w-3.5" /> Submit to Next Level
      </button>
    );
  }

  if (['SPOT_INVESTIGATION', 'PROGRESS_INVESTIGATION'].includes(report.reportType) && isFinallyApproved(report)) {
    return <CaseFollowUpCta report={report} allReports={allReports} />;
  }

  return null;
}
