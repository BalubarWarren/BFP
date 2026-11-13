'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { FileEdit, Search, CheckCircle2, FileText, Building2, ArrowRight, Info } from 'lucide-react';
import StatusBadge from '../../../components/common/StatusBadge';
import SessionExpiredBanner from '../../../components/common/SessionExpiredBanner';
import { useToast } from '../../../components/common/ToastProvider';
import { formatDateTime, isAuthError, parseJsonField } from '../../../lib/utils';
import ReportProgressBar, { getReportProgress } from '../../../components/reports/ReportProgressBar';
import AttachmentList from '../../../components/reports/AttachmentList';
import ReportRowActions, { needsForwarding } from '../../../components/reports/ReportRowActions';
import ForwardReportModal from '../../../components/reports/ForwardReportModal';
import TableSkeleton from '../../../components/common/TableSkeleton';
import PageHeader from '../../../components/common/PageHeader';
import ReportSearchFilters from '../../../components/reports/ReportSearchFilters';
import { EMPTY_REPORT_FILTERS, matchesReportFilters, hasActiveFilters } from '../../../lib/report-search';
import InvestigatorDirectives from '../../../components/directives/InvestigatorDirectives';
import MyDutyStatus from '../../../components/duty/MyDutyStatus';
import { useEscapeKey } from '../../../hooks/useEscapeKey';
import ReportQrButton from '../../../components/reports/ReportQrButton';

export default function MunicipalDashboard() {
  const toast = useToast();
  const [user, setUser] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportDetail, setReportDetail] = useState(null);
  const [forwardTarget, setForwardTarget] = useState(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [searchFilters, setSearchFilters] = useState(EMPTY_REPORT_FILTERS);
  const pollRef = useRef(null);

  useEffect(() => {
    const userData = sessionStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
    fetchReports();

    // Skip the tick while this tab isn't visible — the `focus` listener below already
    // re-fetches once the user comes back, so a background tab doesn't keep hitting the DB.
    pollRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') fetchReports();
    }, 15000);
    const onFocus = () => fetchReports();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(pollRef.current);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const fetchReports = async () => {
    try {
      const token = sessionStorage.getItem('token');
      const response = await axios.get('/api/reports', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setReports(response.data.reports);
    } catch (error) {
      if (isAuthError(error)) {
        clearInterval(pollRef.current);
        setSessionExpired(true);
        return;
      }
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const openView = async (report) => {
    setSelectedReport(report);
    try {
      const token = sessionStorage.getItem('token');
      const res = await axios.get(`/api/reports/${report.id}`, { headers: { Authorization: `Bearer ${token}` } });
      setReportDetail(res.data.report);
    } catch {
      setReportDetail(report);
    }
  };

  const closeView = () => {
    setSelectedReport(null);
    setReportDetail(null);
  };

  // A report is only "finally approved" once the Provincial Chief IIS has signed off — that's
  // the only APPROVED state with nothing left to forward (passedToId is empty).
  const isFinallyApproved = (report) =>
    report?.status === 'APPROVED' && !report?.passedToId;

  // Returns a human-readable label for who approved the report and what the next step is
  const getApprovalInfo = (report) => {
    const detail = reportDetail || report;
    const reviewerRole = detail?.reviewedBy?.role;
    if (reviewerRole === 'MUNICIPAL_CHIEF_IIS' || reviewerRole === 'MUNICIPAL_CHIEF_OPERATION') {
      return { approvedBy: 'Municipal Chief IIS', nextStep: 'Municipal Fire Marshal' };
    }
    if (reviewerRole === 'MUNICIPAL_FIRE_MARSHAL') {
      return { approvedBy: 'Municipal Fire Marshal', nextStep: 'Provincial Chief IIS' };
    }
    return { approvedBy: 'Reviewer', nextStep: 'next level' };
  };

  const openForward = (report) => setForwardTarget(report);
  const closeForward = () => setForwardTarget(null);

  // Only the topmost open modal should close on Escape — the delete confirmation and forward
  // modal both stack on top of the report-detail view without closing it underneath.
  useEscapeKey(closeView, !!selectedReport && !forwardTarget);

  const handleForwarded = async () => {
    closeForward();
    closeView();
    await fetchReports();
  };

  const parseAttachments = (attachments) => parseJsonField(attachments, []);

  const formatReportType = (type) =>
    type
      ?.replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase()) || '-';

  const statusCounts = reports.reduce(
    (counts, report) => ({
      ...counts,
      [report.status]: (counts[report.status] || 0) + 1,
    }),
    {}
  );

  const filteredReports = reports
    .filter((r) => (filterStatus ? r.status === filterStatus : true))
    .filter((r) => matchesReportFilters(r, searchFilters));

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <PageHeader
          icon={Building2}
          eyebrow={user?.municipality?.name ? `Municipality of ${user.municipality.name}` : 'Municipal Office'}
          title={`Welcome, ${user?.name || ''}`}
        />
      </div>

      {sessionExpired && (
        <div className="mb-6">
          <SessionExpiredBanner />
        </div>
      )}

      {!sessionExpired && <MyDutyStatus />}

      {!sessionExpired && <InvestigatorDirectives />}

      {/* Report View Modal */}
      {selectedReport && (
        <div className="fixed inset-0 modal-overlay z-50 flex items-center justify-center p-4">
          <div className="modal-pop-in bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 sm:p-6 border-b">
              <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Report Details</h2>
              <button onClick={closeView} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>

            <div className="p-4 sm:p-6 space-y-6">
              {/* Meta */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4 text-sm">
                <div><p className="text-gray-500">Type</p><p className="font-semibold">{selectedReport.reportType}</p></div>
                <div><p className="text-gray-500">Status</p><StatusBadge status={selectedReport.status} /></div>
                <div><p className="text-gray-500">Report Date</p><p className="font-semibold">{new Date(selectedReport.reportDate).toLocaleDateString()}</p></div>
                <div><p className="text-gray-500">Submitted At</p><p className="font-semibold">{formatDateTime(selectedReport.submittedAt)}</p></div>
                {(reportDetail?.category || selectedReport.category) && (
                  <div><p className="text-gray-500">Category</p><p className="font-semibold">{(reportDetail?.category || selectedReport.category).replace(/_/g, ' ')}</p></div>
                )}
                {(reportDetail?.respondingOfficer || selectedReport.respondingOfficer) && (
                  <div><p className="text-gray-500">Reporting Officer</p><p className="font-semibold">{reportDetail?.respondingOfficer || selectedReport.respondingOfficer}</p></div>
                )}
                {(reportDetail?.passedToRole || selectedReport.passedToRole) && (
                  <div><p className="text-gray-500">Submitted To</p><p className="font-semibold">{(reportDetail?.passedToRole || selectedReport.passedToRole).replace(/_/g, ' ')}</p></div>
                )}
              </div>

              {/* Review Progress */}
              <ReportProgressBar progress={getReportProgress(reportDetail || selectedReport)} />

              {/* Attachments */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-bold text-bfp-navy mb-3">Attachments</h3>
                {parseAttachments(reportDetail?.attachments || selectedReport.attachments).length > 0 ? (
                  <AttachmentList
                    attachments={reportDetail?.attachments || selectedReport.attachments}
                    reportId={selectedReport.id}
                    canAnnotate={false}
                  />
                ) : (
                  <p className="text-sm text-gray-500">No attachments uploaded.</p>
                )}
              </div>

              {/* Reviewer remarks (if returned) */}
              {(reportDetail?.remarks || selectedReport.remarks) && selectedReport.status === 'RETURNED' && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                  <p className="text-sm font-bold text-red-700 mb-1">
                    Returned by {reportDetail?.reviewedBy?.name || 'Reviewer'}
                  </p>
                  <p className="text-sm text-red-700">{reportDetail?.remarks || selectedReport.remarks}</p>
                </div>
              )}

              {/* APPROVED — still needs forwarding to the next level */}
              {needsForwarding(selectedReport) && (
                <div className="bg-bfp-navy/5 border-l-4 border-bfp-navy p-4 rounded">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-bfp-navy mb-1">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> Approved by {getApprovalInfo(selectedReport).approvedBy}
                  </p>
                  <p className="text-sm text-bfp-navy">
                    This report has been reviewed and approved. You can now submit it to the <strong>{getApprovalInfo(selectedReport).nextStep}</strong>.
                  </p>
                </div>
              )}

              {/* APPROVED — final approval by Provincial Chief IIS */}
              {isFinallyApproved(selectedReport) && (
                <div className="bg-bfp-green/10 border-l-4 border-bfp-green p-4 rounded">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-green-800 mb-1">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> Approved by {reportDetail?.reviewedBy?.name || 'Reviewer'}
                  </p>
                  <p className="text-sm text-green-800">This report has been given final approval and is ready to pass to the system.</p>
                </div>
              )}


            </div>

            <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
              <ReportQrButton key={selectedReport.id} report={reportDetail || selectedReport} className="btn btn-secondary mr-auto" />
              {selectedReport.status === 'RETURNED' && (
                <Link href={`/municipal/reports/${selectedReport.id}/edit`} className="btn btn-danger">
                  ↩ Revise & Resubmit
                </Link>
              )}
              {needsForwarding(selectedReport) && (
                <button
                  type="button"
                  onClick={() => openForward(selectedReport)}
                  className="btn btn-primary"
                >
                  → Submit Report
                </button>
              )}
              <button onClick={closeView} className="btn btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}

      {forwardTarget && (
        <ForwardReportModal report={forwardTarget} onClose={closeForward} onForwarded={handleForwarded} />
      )}

      {/* Quick Action Cards — only reports that open a new case. Progress and Final
          Investigation continue an existing case, so they start from the "Start Progress/Final
          Report" button on an approved report in the table below. */}
      <div className="mb-8 grid w-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/municipal/reports/mdfir" className="card card-hover-lift group flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-bfp-red/10 text-bfp-red">
            <FileEdit className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold tracking-tight text-gray-900">MDFIR</h3>
            <p className="mt-0.5 text-sm text-gray-600">Minimal damage fire incident report</p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-bfp-red transition-all group-hover:gap-2">
              New report <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </Link>

        <Link href="/municipal/reports/spot" className="card card-hover-lift group flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-bfp-red/10 text-bfp-red">
            <Search className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold tracking-tight text-gray-900">Spot Investigation</h3>
            <p className="mt-0.5 text-sm text-gray-600">On-site report that opens a new fire case</p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-bfp-red transition-all group-hover:gap-2">
              New report <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </Link>

        <div className="flex items-start gap-3 rounded-lg border border-dashed border-bfp-navy/25 bg-bfp-navy/5 p-5 md:col-span-2 lg:col-span-1">
          <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-bfp-navy" />
          <div className="text-sm text-bfp-navy">
            <p className="font-bold">Progress &amp; Final Investigation</p>
            <p className="mt-1 text-gray-600">
              Once a Spot Investigation is finalized, press <strong>Start Progress Report</strong> on
              it below to continue the same case.
            </p>
          </div>
        </div>
      </div>

      {/* My Reports Section */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          {[
            ['Submitted', 'SUBMITTED', statusCounts.SUBMITTED || 0, 'bg-amber-500'],
            ['Approved', 'APPROVED', statusCounts.APPROVED || 0, 'bg-green-500'],
            ['Returned', 'RETURNED', statusCounts.RETURNED || 0, 'bg-red-500'],
            ['Draft', 'DRAFT', statusCounts.DRAFT || 0, 'bg-gray-400'],
          ].map(([label, status, value, dotClass]) => (
            <button
              key={label}
              type="button"
              aria-pressed={filterStatus === status}
              onClick={() => setFilterStatus((current) => (current === status ? '' : status))}
              className={`card card-hover-lift w-full p-4 text-left ${
                filterStatus === status ? '!shadow-[0_0_0_2px_theme(colors.bfp-navy)] dark:!shadow-[0_0_0_2px_theme(colors.blue.400)]' : ''
              }`}
            >
              <p className="flex items-center gap-2 text-sm font-medium text-gray-500">
                <span className={`h-2 w-2 rounded-full ${dotClass}`} aria-hidden="true" />
                {label}
              </p>
              <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-gray-900">{value}</p>
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-gray-200 p-5 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-gray-900">Reports</h2>
              <p className="text-sm text-gray-500">
                {filterStatus ? `${formatReportType(filterStatus)} reports` : 'All statuses'}
              </p>
            </div>
            <div className="w-full md:w-72">
              <label className="form-label">Status</label>
              <select
                className="form-select"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="APPROVED">Approved</option>
                <option value="RETURNED">Returned</option>
                <option value="DRAFT">Draft</option>
              </select>
            </div>
          </div>
          <div className="border-b border-gray-200 p-5">
            <ReportSearchFilters filters={searchFilters} onChange={setSearchFilters} showStatus={false} />
          </div>

          {loading ? (
            <TableSkeleton rows={5} columns={6} />
          ) : filteredReports.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center bg-gray-50 p-10 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
                <FileText className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-lg font-semibold text-bfp-navy">No reports found</p>
              <p className="mt-1 text-sm text-gray-500">
                {hasActiveFilters(searchFilters) ? 'No reports match your search.' : filterStatus ? 'No reports match the selected status.' : 'Submitted reports will appear here.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-gray-50">
                  <tr className="border-b border-gray-200">
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Report</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Reference #</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Submitted</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Status &amp; Location</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredReports.slice(0, 10).map((report, index) => (
                    <tr
                      key={report.id}
                      className="row-fade-in hover:bg-gray-50"
                      style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
                    >
                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-900">{formatReportType(report.reportType)}</p>
                        <p className="text-xs text-gray-500">#{report.id}</p>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700 whitespace-nowrap">{report.incident?.referenceNumber || '-'}</td>
                      <td className="px-5 py-4 text-sm">
                        <p className="text-gray-800">{formatDateTime(report.submittedAt)}</p>
                        <p className="text-xs text-gray-500">Report date {new Date(report.reportDate).toLocaleDateString()}</p>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <StatusBadge status={report.status} />
                        <ReportProgressBar progress={getReportProgress(report)} compact />
                        {report.status === 'RETURNED' && report.remarks && (
                          <p className="mt-1 w-40 truncate text-xs text-gray-500" title={report.remarks}>
                            &ldquo;{report.remarks}&rdquo;
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm align-top">
                        <ReportRowActions report={report} allReports={reports} onView={openView} onForward={openForward} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filteredReports.length > 10 && (
            <div className="border-t border-gray-200 p-4">
              <Link
                href="/municipal/reports"
                className="text-bfp-navy hover:underline font-semibold"
              >
                View All Reports ({filteredReports.length})
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
