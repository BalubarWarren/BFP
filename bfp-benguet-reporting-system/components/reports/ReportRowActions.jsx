'use client';

import Link from 'next/link';
import { Eye, PencilLine, RotateCcw, Send } from 'lucide-react';
import CaseFollowUpCta from './CaseFollowUpCta';
import { getCaseFollowUp } from '../../lib/report-workflow';
import { getReportProgress } from './ReportProgressBar';

const isFinallyApproved = (report) => report?.status === 'APPROVED' && !report?.passedToId;
export const needsForwarding = (report) => report?.status === 'APPROVED' && !!report?.passedToId;

// The "Actions" cell of an investigator's report table: just View, plus a one-line hint when the
// report needs something from the investigator. The buttons for that next step (Revise &
// Resubmit, Submit to Next Level, Start Progress/Final Report) and the QR code live inside the
// View window (ReportNextStep), so the table stays uncluttered.
export default function ReportRowActions({ report, allReports, onView }) {
  const hint = getNextStepHint(report, allReports);

  return (
    <div className="flex min-w-[8rem] flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => onView(report)}
        className={`btn text-sm py-1 px-3 inline-flex items-center gap-1.5 ${hint ? 'btn-primary' : 'btn-secondary'}`}
      >
        <Eye className="h-3.5 w-3.5" /> View
      </button>
      {hint && <p className={`text-xs font-medium ${hint.tone}`}>{hint.label}</p>}
    </div>
  );
}

// The next-step button(s) for a report, shown in the footer of the investigator's View window.
export function ReportNextStep({ report, allReports, onForward }) {
  return getNextStep(report, allReports, onForward);
}

function getNextStepHint(report, allReports) {
  if (report.status === 'DRAFT') return { label: 'Draft. Continue editing', tone: 'text-gray-600' };
  if (report.status === 'RETURNED') return { label: 'Returned. Needs revision', tone: 'text-bfp-red' };
  if (needsForwarding(report)) return { label: 'Ready for next level', tone: 'text-bfp-navy dark:text-blue-400' };
  if (['SPOT_INVESTIGATION', 'PROGRESS_INVESTIGATION'].includes(report.reportType) && isFinallyApproved(report)) {
    const { showProgressCta, showFinalCta } = getCaseFollowUp(report, allReports);
    if (showProgressCta) return { label: 'Next: Progress report', tone: 'text-bfp-navy dark:text-blue-400' };
    if (showFinalCta) return { label: 'Next: Final report', tone: 'text-bfp-navy dark:text-blue-400' };
  }
  return null;
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
