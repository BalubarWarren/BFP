'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { FileText } from 'lucide-react';
import StatusBadge from '../../../../components/common/StatusBadge';
import { useToast } from '../../../../components/common/ToastProvider';
import { formatDateTime, parseJsonField } from '../../../../lib/utils';
import ReportProgressBar, { getReportProgress } from '../../../../components/reports/ReportProgressBar';
import AttachmentList from '../../../../components/reports/AttachmentList';
import CaseChain from '../../../../components/reports/CaseChain';
import ReportRowActions from '../../../../components/reports/ReportRowActions';
import ForwardReportModal from '../../../../components/reports/ForwardReportModal';
import TableSkeleton from '../../../../components/common/TableSkeleton';
import PageHeader from '../../../../components/common/PageHeader';
import ReportSearchFilters from '../../../../components/reports/ReportSearchFilters';
import { EMPTY_REPORT_FILTERS, matchesReportFilters, hasActiveFilters } from '../../../../lib/report-search';
import { useEscapeKey } from '../../../../hooks/useEscapeKey';
import ReportQrButton from '../../../../components/reports/ReportQrButton';

export default function MunicipalReportsPage() {
  const toast = useToast();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [searchFilters, setSearchFilters] = useState(EMPTY_REPORT_FILTERS);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportDetail, setReportDetail] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [forwardTarget, setForwardTarget] = useState(null);

  useEffect(() => {
    fetchReports();
  }, [filterStatus]);

  const fetchReports = async () => {
    try {
      const token = sessionStorage.getItem('token');

      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);

      const response = await axios.get(`/api/reports?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setReports(response.data.reports);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const statusCounts = reports.reduce(
    (counts, report) => ({
      ...counts,
      [report.status]: (counts[report.status] || 0) + 1,
    }),
    {}
  );

  const filteredReports = reports.filter((r) => matchesReportFilters(r, searchFilters));

  const formatReportType = (type) =>
    type
      ?.replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase()) || '-';


  const openReport = async (report) => {
    setSelectedReport(report);
    setReportDetail(null);

    try {
      const token = sessionStorage.getItem('token');
      const response = await axios.get(`/api/reports/${report.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setReportDetail(response.data.report);
    } catch {
      setReportDetail(report);
    }
  };

  const closeReport = () => {
    setSelectedReport(null);
    setReportDetail(null);
  };

  useEscapeKey(closeReport, !!selectedReport && !forwardTarget);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay p-4">
          <div className="modal-pop-in max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b p-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-bfp-red">Report Details</p>
                <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
                  {formatReportType(selectedReport.reportType)}
                </h2>
              </div>
              <button onClick={closeReport} className="text-2xl text-gray-400 hover:text-gray-600">&times;</button>
            </div>

            <div className="space-y-5 p-6">
              <div className="grid grid-cols-1 gap-4 rounded-lg bg-gray-50 p-4 text-sm md:grid-cols-2">
                <div><p className="text-gray-500">Status</p><StatusBadge status={selectedReport.status} /></div>
                <div><p className="text-gray-500">Report Date</p><p className="font-semibold">{new Date(selectedReport.reportDate).toLocaleDateString()}</p></div>
                <div><p className="text-gray-500">Submitted At</p><p className="font-semibold">{formatDateTime(selectedReport.submittedAt)}</p></div>
                <div><p className="text-gray-500">Submitted To</p><p className="font-semibold">{(reportDetail?.passedToRole || selectedReport.passedToRole || 'Filed').replace(/_/g, ' ')}</p></div>
                {(reportDetail?.respondingOfficer || selectedReport.respondingOfficer) && (
                  <div><p className="text-gray-500">Reporting Officer</p><p className="font-semibold">{reportDetail?.respondingOfficer || selectedReport.respondingOfficer}</p></div>
                )}
                {(reportDetail?.respondingUnits || selectedReport.respondingUnits) && (
                  <div><p className="text-gray-500">Responding Units</p><p className="font-semibold">{reportDetail?.respondingUnits || selectedReport.respondingUnits}</p></div>
                )}
              </div>

              {(reportDetail?.incident || selectedReport.incident) && (
                <div className="rounded-lg bg-yellow-50 p-4">
                  <h3 className="mb-3 font-bold text-bfp-navy">Incident Details</h3>
                  <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                    <div><p className="text-gray-500">Reference</p><p className="font-semibold">{(reportDetail?.incident || selectedReport.incident).referenceNumber}</p></div>
                    <div><p className="text-gray-500">Category</p><p className="font-semibold">{(reportDetail?.incident || selectedReport.incident).generalCategory}</p></div>
                    <div><p className="text-gray-500">Status</p><p className="font-semibold">{(reportDetail?.incident || selectedReport.incident).status}</p></div>
                  </div>
                </div>
              )}

              <CaseChain
                reports={reportDetail?.caseReports}
                currentId={selectedReport.id}
                referenceNumber={(reportDetail?.incident || selectedReport.incident)?.referenceNumber}
              />

              <div className="rounded-lg bg-gray-50 p-4">
                <h3 className="mb-3 font-bold text-bfp-navy">Attachments</h3>
                {parseJsonField(reportDetail?.attachments || selectedReport.attachments, []).length ? (
                  <AttachmentList
                    attachments={reportDetail?.attachments || selectedReport.attachments}
                    reportId={selectedReport.id}
                    canAnnotate={false}
                  />
                ) : (
                  <p className="text-sm text-gray-500">No attachments uploaded.</p>
                )}
              </div>

              {(reportDetail?.remarks || selectedReport.remarks) && (
                <div className="rounded border-l-4 border-red-500 bg-red-50 p-4">
                  <p className="text-sm font-bold text-red-700">Reviewer Remarks</p>
                  <p className="mt-1 text-sm text-red-700">{reportDetail?.remarks || selectedReport.remarks}</p>
                </div>
              )}


            </div>

            <div className="flex justify-end gap-3 border-t bg-gray-50 p-6">
              <ReportQrButton key={selectedReport.id} report={reportDetail || selectedReport} className="btn btn-secondary mr-auto" />
              <button onClick={closeReport} className="btn btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <PageHeader icon={FileText} eyebrow="Report archive" title="My Submitted Reports" border={false} />
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-medium text-gray-500">Showing</p>
          <p className="text-2xl font-semibold tabular-nums tracking-tight text-gray-900">{filteredReports.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[
          ['Submitted', statusCounts.SUBMITTED || 0, 'bg-amber-500'],
          ['Approved', statusCounts.APPROVED || 0, 'bg-green-500'],
          ['Returned', statusCounts.RETURNED || 0, 'bg-red-500'],
          ['Draft', statusCounts.DRAFT || 0, 'bg-gray-400'],
        ].map(([label, value, dotClass]) => (
          <div key={label} className="card p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-gray-500">
              <span className={`h-2 w-2 rounded-full ${dotClass}`} aria-hidden="true" />
              {label}
            </p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-gray-900">{value}</p>
          </div>
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
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="APPROVED">Approved</option>
              <option value="RETURNED">Returned</option>
            </select>
          </div>
        </div>
        <div className="border-b border-gray-200 p-5">
          <ReportSearchFilters filters={searchFilters} onChange={setSearchFilters} showStatus={false} />
        </div>

        {loading ? (
          <TableSkeleton rows={6} columns={6} />
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
                {filteredReports.map((report, index) => (
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
                      <ReportRowActions report={report} allReports={reports} onView={openReport} onForward={setForwardTarget} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {forwardTarget && (
        <ForwardReportModal
          report={forwardTarget}
          onClose={() => setForwardTarget(null)}
          onForwarded={() => {
            setForwardTarget(null);
            closeReport();
            fetchReports();
          }}
        />
      )}
    </div>
  );
}
