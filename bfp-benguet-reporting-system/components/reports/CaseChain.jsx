'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Link2, Check, ArrowUpRight } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';
import { useToast } from '../common/ToastProvider';
import { fetchReportForModal } from '../../lib/notification-target';

// Loaded lazily: ReportDetailsModal itself renders CaseChain, so a static import would be circular.
const ReportDetailsModal = dynamic(() => import('./ReportDetailsModal'), { ssr: false });

// Spot → Progress → Final for one case (incident). `reports` is GET /api/reports/:id's
// `caseReports`: every non-draft report filed under the same incident, plus the one being viewed.
const STEPS = [
  { type: 'SPOT_INVESTIGATION', label: 'Spot Report' },
  { type: 'PROGRESS_INVESTIGATION', label: 'Progress Report' },
  { type: 'FINAL_INVESTIGATION', label: 'Final Report' },
];

const isFinalized = (report) => report.status === 'APPROVED' && !report.passedToId;

// Each filed step other than the one being viewed opens that report (e.g. the Spot report a
// Progress report continues) in a details window on top, so the whole case can be read from any
// of its reports.
export default function CaseChain({ reports, currentId, referenceNumber }) {
  const toast = useToast();
  const [openedReport, setOpenedReport] = useState(null);
  const [loadingId, setLoadingId] = useState(null);

  if (!Array.isArray(reports) || !reports.length) return null;

  const openLinked = async (id) => {
    if (loadingId) return;
    setLoadingId(id);
    try {
      setOpenedReport(await fetchReportForModal(id));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoadingId(null);
    }
  };

  const hasFinal = reports.some((r) => r.reportType === 'FINAL_INVESTIGATION');

  return (
    <section className="rounded-lg border border-gray-200 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <Link2 className="h-4 w-4 text-gray-400" /> Linked reports for this case
        </p>
        {referenceNumber && <span className="text-xs font-medium text-gray-500">Ref. {referenceNumber}</span>}
      </div>
      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {STEPS.map((step, index) => {
          const filed = reports.filter((r) => r.reportType === step.type);
          const latest = filed[filed.length - 1];
          const isCurrent = filed.some((r) => r.id === currentId);
          const done = latest && isFinalized(latest);
          const skipped = !latest && step.type === 'PROGRESS_INVESTIGATION' && hasFinal;
          const openable = latest && !isCurrent;
          return (
            <li
              key={step.type}
              className={`relative rounded-md border p-3 ${
                isCurrent ? 'border-bfp-navy bg-bfp-navy/5 dark:bg-white/5' : 'border-gray-200'
              } ${openable ? 'cursor-pointer transition hover:border-bfp-navy hover:bg-gray-50 dark:hover:bg-white/5' : ''}`}
              {...(openable
                ? {
                    role: 'button',
                    tabIndex: 0,
                    title: `Open ${step.label} #${latest.id}`,
                    onClick: () => openLinked(latest.id),
                    onKeyDown: (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openLinked(latest.id);
                      }
                    },
                  }
                : {})}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                    done ? 'bg-emerald-600 text-white' : latest ? 'bg-bfp-navy text-white' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {done ? <Check className="h-3 w-3" /> : index + 1}
                </span>
                <p className="text-sm font-medium text-gray-900">{step.label}</p>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                {latest ? (
                  <div className="space-y-1">
                    {done ? (
                      <span className="badge bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20">Final approval</span>
                    ) : (
                      <StatusBadge status={latest.status} />
                    )}
                    <p>
                      Report #{latest.id}
                      {filed.length > 1 && ` · ${filed.length} filed`}
                      {isCurrent && <span className="font-semibold text-bfp-navy dark:text-white"> · Viewing</span>}
                    </p>
                    {openable && (
                      <p className="inline-flex items-center gap-0.5 font-medium text-bfp-navy dark:text-blue-400">
                        {loadingId === latest.id ? 'Opening…' : 'Open report'} <ArrowUpRight className="h-3 w-3" />
                      </p>
                    )}
                  </div>
                ) : skipped ? (
                  <p>Skipped (went straight to Final)</p>
                ) : (
                  <p>Not filed yet</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {openedReport && (
        <ReportDetailsModal report={openedReport} onClose={() => setOpenedReport(null)} />
      )}
    </section>
  );
}
