'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import StatusBadge from '@/components/common/StatusBadge';
import { useToast } from '@/components/common/ToastProvider';
import { formatDateTime } from '@/lib/utils';

export default function MunicipalReportsPage() {
  const toast = useToast();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [blastLoadingId, setBlastLoadingId] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportDetail, setReportDetail] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

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

  const canTextBlast = (report) =>
    report?.reportType === 'SPOT_INVESTIGATION' && report?.status === 'APPROVED' && !report?.passedToId;

  const statusCounts = reports.reduce(
    (counts, report) => ({
      ...counts,
      [report.status]: (counts[report.status] || 0) + 1,
    }),
    {}
  );

  const formatReportType = (type) =>
    type
      ?.replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase()) || '-';

  const parseJson = (value, fallback) => {
    if (!value) return fallback;
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  };

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

  const handleTextBlast = async (report) => {
    setBlastLoadingId(report.id);
    try {
      const token = sessionStorage.getItem('token');
      const response = await axios.post(
        `/api/reports/${report.id}/text-blast`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(response.data.message || 'Text blast sent successfully.');
      fetchReports();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to send text blast');
    } finally {
      setBlastLoadingId(null);
    }
  };

  return (
    <div className="p-8 space-y-6">
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="max-h-screen w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b p-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-bfp-red">Report Details</p>
                <h2 className="text-2xl font-bold text-bfp-navy">
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

              <div className="rounded-lg bg-gray-50 p-4">
                <h3 className="mb-3 font-bold text-bfp-navy">Attachments</h3>
                {parseJson(reportDetail?.attachments || selectedReport.attachments, []).length ? (
                  <ul className="space-y-2 text-sm">
                    {parseJson(reportDetail?.attachments || selectedReport.attachments, []).map((attachment) => (
                      <li key={attachment.url}>
                        <a href={attachment.url} target="_blank" rel="noreferrer" className="font-medium text-bfp-red hover:underline">
                          {attachment.name}
                        </a>
                      </li>
                    ))}
                  </ul>
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

            <div className="flex justify-end border-t bg-gray-50 p-6">
              <button onClick={closeReport} className="btn btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-bfp-red">Report archive</p>
          <h1 className="text-3xl font-bold text-bfp-navy">My Submitted Reports</h1>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Showing</p>
          <p className="text-2xl font-bold text-bfp-navy">{reports.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[
          ['Submitted', statusCounts.SUBMITTED || 0, 'border-bfp-amber'],
          ['Approved', statusCounts.APPROVED || 0, 'border-green-500'],
          ['Returned', statusCounts.RETURNED || 0, 'border-red-500'],
          ['Draft', statusCounts.DRAFT || 0, 'border-gray-400'],
        ].map(([label, value, borderClass]) => (
          <div key={label} className={`rounded-lg border-l-4 ${borderClass} bg-white p-4 shadow-sm`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-200 p-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-bfp-navy">Reports</h2>
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

        {loading ? (
          <div className="p-10 text-center text-gray-600">Loading reports...</div>
        ) : reports.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center bg-gray-50 p-10 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
              <FileText className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-lg font-semibold text-bfp-navy">No reports found</p>
            <p className="mt-1 text-sm text-gray-500">
              {filterStatus ? 'No reports match the selected status.' : 'Submitted reports will appear here.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-gray-50">
                <tr className="border-b border-gray-200">
                  <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">Report Type</th>
                  <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">Report Date</th>
                  <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">Submitted At</th>
                  <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-gray-900">{formatReportType(report.reportType)}</p>
                      <p className="text-xs text-gray-500">#{report.id}</p>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700">
                      {new Date(report.reportDate).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={report.status} />
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600">
                      {formatDateTime(report.submittedAt)}
                    </td>
                    <td className="px-5 py-4 text-sm">
                      {report.status === 'DRAFT' && (
                        <Link
                          href={`/municipal/reports/${report.id}/edit`}
                          className="font-semibold text-bfp-red hover:underline"
                        >
                          Edit
                        </Link>
                      )}
                      {report.status === 'RETURNED' && (
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => openReport(report)}
                            className="font-semibold text-bfp-red hover:underline"
                          >
                            View
                          </button>
                          <div>
                            <p className="font-semibold text-red-600">Needs Revision</p>
                            {report.remarks && (
                              <p className="mt-1 max-w-sm truncate text-xs text-gray-500" title={report.remarks}>
                                {report.remarks}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                      {report.status !== 'DRAFT' && report.status !== 'RETURNED' && (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openReport(report)}
                            className="font-semibold text-bfp-red hover:underline"
                          >
                            View
                          </button>
                          {canTextBlast(report) && (
                            <button
                              type="button"
                              onClick={() => handleTextBlast(report)}
                              className="btn btn-success px-3 py-1 text-sm"
                              disabled={blastLoadingId === report.id}
                            >
                              {blastLoadingId === report.id ? 'Sending...' : 'Text Blast'}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
