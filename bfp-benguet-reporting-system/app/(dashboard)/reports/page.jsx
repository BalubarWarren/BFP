'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Archive, FileCheck2, CalendarCheck, MapPin, QrCode } from 'lucide-react';
import PageHeader from '../../../components/common/PageHeader';
import StatusBadge from '../../../components/common/StatusBadge';
import SessionExpiredBanner from '../../../components/common/SessionExpiredBanner';
import TableSkeleton from '../../../components/common/TableSkeleton';
import AttachmentList from '../../../components/reports/AttachmentList';
import ReportQrModal from '../../../components/reports/ReportQrModal';
import { useToast } from '../../../components/common/ToastProvider';
import { formatDateTime, isAuthError, parseJsonField } from '../../../lib/utils';
import { useEscapeKey } from '../../../hooks/useEscapeKey';

// The shared Reports archive: every report that has cleared final approval by the Provincial
// Chief IIS. Read by the Provincial Chief IIS, the Municipal Fire Marshal and the Municipal
// Chief IIS — see APPROVED_ARCHIVE_ROLES in lib/report-access.js, which also scopes the two
// municipal roles to their own municipality. Strictly read-only: a finished report is the
// official record, and both PATCH and DELETE on /api/reports/[id] already refuse to touch one.
const REPORT_TYPE_LABELS = {
  MDFIR: 'MDFIR',
  SPOT_INVESTIGATION: 'Spot Investigation',
  PROGRESS_INVESTIGATION: 'Progress Investigation',
  FINAL_INVESTIGATION: 'Final Investigation',
  DAILY: 'Daily Report',
};

const formatReportType = (type) => REPORT_TYPE_LABELS[type] || (type || '').replace(/_/g, ' ');

export default function ApprovedReportsPage() {
  const toast = useToast();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sessionExpired, setSessionExpired] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [municipalityFilter, setMunicipalityFilter] = useState('');
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportDetail, setReportDetail] = useState(null);
  const [qrTarget, setQrTarget] = useState(null);
  const [qrLoadingId, setQrLoadingId] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    const storedUser = sessionStorage.getItem('user');
    if (storedUser) {
      try {
        setCurrentUser(JSON.parse(storedUser));
      } catch {
        setCurrentUser(null);
      }
    }

    fetchReports();

    // Same cadence as the other dashboards, and likewise skipped while the tab is hidden —
    // the focus listener below catches the user back up when they return.
    pollRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') fetchReports({ silent: true });
    }, 15000);
    const onFocus = () => fetchReports({ silent: true });
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(pollRef.current);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const fetchReports = async ({ silent } = {}) => {
    try {
      if (!silent) setLoading(true);
      const token = sessionStorage.getItem('token');
      const res = await axios.get('/api/reports?view=approved', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setReports(res.data.reports || []);
      setError('');
    } catch (err) {
      if (isAuthError(err)) {
        clearInterval(pollRef.current);
        setSessionExpired(true);
        return;
      }
      if (!silent) setError('Failed to load approved reports');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const openReport = async (report) => {
    setSelectedReport(report);
    setReportDetail(null);
    try {
      const token = sessionStorage.getItem('token');
      const res = await axios.get(`/api/reports/${report.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setReportDetail(res.data.report);
    } catch {
      setReportDetail(report);
    }
  };

  const closeReport = () => {
    setSelectedReport(null);
    setReportDetail(null);
  };

  useEscapeKey(closeReport, !!selectedReport);

  // Most reports already carry a qrToken (POST /api/reports/[id]/approve mints one the moment
  // the Provincial Chief IIS gives final approval) so this just opens the modal directly. A
  // report approved before the QR feature shipped won't have one yet — POST /api/reports/[id]/qr
  // lazily mints it on first request instead of needing a separate backfill step.
  const openQr = async (report) => {
    if (report.qrToken) {
      setQrTarget(report);
      return;
    }
    setQrLoadingId(report.id);
    try {
      const token = sessionStorage.getItem('token');
      const res = await axios.post(
        `/api/reports/${report.id}/qr`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const updatedReport = { ...report, qrToken: res.data.qrToken };
      setReports((prev) => prev.map((r) => (r.id === report.id ? updatedReport : r)));
      setQrTarget(updatedReport);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate QR code');
    } finally {
      setQrLoadingId(null);
    }
  };

  // Municipal members of the archive only ever receive their own municipality's reports from the
  // API, so the filter is only worth showing when there is more than one to choose between.
  const municipalities = useMemo(() => {
    const names = new Set(reports.map((r) => r.municipality?.name).filter(Boolean));
    return [...names].sort();
  }, [reports]);

  const reportTypes = useMemo(() => {
    const types = new Set(reports.map((r) => r.reportType).filter(Boolean));
    return [...types].sort();
  }, [reports]);

  const filteredReports = useMemo(
    () =>
      reports.filter((report) => {
        if (search) {
          const needle = search.toLowerCase();
          const haystack = [
            report.incident?.referenceNumber,
            report.municipality?.name,
            report.submittedBy?.name,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(needle)) return false;
        }
        if (typeFilter && report.reportType !== typeFilter) return false;
        if (municipalityFilter && report.municipality?.name !== municipalityFilter) return false;
        return true;
      }),
    [reports, search, typeFilter, municipalityFilter]
  );

  const approvedThisMonth = useMemo(() => {
    const now = new Date();
    return reports.filter((report) => {
      if (!report.reviewedAt) return false;
      const reviewed = new Date(report.reviewedAt);
      return reviewed.getMonth() === now.getMonth() && reviewed.getFullYear() === now.getFullYear();
    }).length;
  }, [reports]);

  const isProvincial = currentUser?.role === 'PROVINCIAL_CHIEF_IIS';
  const scopeNote = isProvincial
    ? 'All thirteen municipalities of Benguet.'
    : `${currentUser?.municipality?.name || 'Your municipality'} only.`;

  const stats = [
    { label: 'Approved Reports', value: reports.length, icon: FileCheck2 },
    { label: 'Approved This Month', value: approvedThisMonth, icon: CalendarCheck },
    { label: 'Municipalities', value: municipalities.length, icon: MapPin },
  ];

  return (
    <div className="p-8 space-y-8">
      <PageHeader
        icon={Archive}
        eyebrow="Shared Archive"
        title="Reports"
        description={`Reports that have cleared final approval by the Provincial Chief IIS. Shared, read-only record for the Provincial Chief IIS, Municipal Fire Marshal and Municipal Chief IIS. ${scopeNote}`}
      />

      {sessionExpired && <SessionExpiredBanner />}

      {!sessionExpired && error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex items-center gap-4 rounded-lg bg-white p-5 shadow-md">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-bfp-navy/10 text-bfp-navy">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
              <p className="text-2xl font-bold text-bfp-navy">{loading ? '—' : value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="min-w-[16rem] flex-1">
          <label className="form-label">Search</label>
          <input
            type="text"
            className="form-input"
            placeholder="Reference #, municipality or investigator"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="min-w-[12rem]">
          <label className="form-label">Report Type</label>
          <select className="form-input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            {reportTypes.map((type) => (
              <option key={type} value={type}>{formatReportType(type)}</option>
            ))}
          </select>
        </div>
        {municipalities.length > 1 && (
          <div className="min-w-[12rem]">
            <label className="form-label">Municipality</label>
            <select
              className="form-input"
              value={municipalityFilter}
              onChange={(e) => setMunicipalityFilter(e.target.value)}
            >
              <option value="">All municipalities</option>
              {municipalities.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <section className="bg-white rounded-lg shadow-md p-6">
        <h2 className="flex items-center gap-2 text-xl font-bold text-bfp-navy mb-4">
          <Archive className="w-5 h-5" /> Approved Reports
          {!loading && filteredReports.length > 0 && (
            <span className="text-sm font-normal text-gray-500">({filteredReports.length})</span>
          )}
        </h2>

        {loading ? (
          <TableSkeleton rows={5} columns={8} />
        ) : filteredReports.length === 0 ? (
          <p className="text-gray-500">
            {reports.length === 0
              ? 'No reports have received final approval yet. Reports appear here once the Provincial Chief IIS approves them.'
              : 'No approved reports match these filters.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference #</th>
                  <th>Type</th>
                  <th>Municipality</th>
                  <th>Report Date</th>
                  <th>Submitted By</th>
                  <th>Approved By</th>
                  <th>Approved At</th>
                  <th>Files</th>
                  <th>QR Code</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map((report, index) => (
                  <tr
                    key={report.id}
                    className="row-fade-in"
                    style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
                  >
                    <td className="font-semibold">{report.incident?.referenceNumber || '-'}</td>
                    <td>{formatReportType(report.reportType)}</td>
                    <td>{report.municipality?.name || '-'}</td>
                    <td>{new Date(report.reportDate).toLocaleDateString()}</td>
                    <td>{report.submittedBy?.name || '-'}</td>
                    <td>{report.reviewedBy?.name || 'Provincial Chief IIS'}</td>
                    <td className="text-sm text-gray-500">
                      {report.reviewedAt ? formatDateTime(report.reviewedAt) : '-'}
                    </td>
                    <td><AttachmentList attachments={report.attachments} reportId={report.id} /></td>
                    <td>
                      <button
                        onClick={() => openQr(report)}
                        disabled={qrLoadingId === report.id}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-bfp-navy hover:underline disabled:opacity-50"
                      >
                        <QrCode className="w-4 h-4" /> {qrLoadingId === report.id ? 'Generating…' : 'QR Code'}
                      </button>
                    </td>
                    <td>
                      <button onClick={() => openReport(report)} className="btn btn-primary">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Read-only detail view — no approve/return actions: this report is already final. */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="modal-pop-in bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-screen overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-bfp-red">Approved Report</p>
                <h2 className="text-2xl font-bold text-bfp-navy">
                  {selectedReport.incident?.referenceNumber || formatReportType(selectedReport.reportType)}
                </h2>
              </div>
              <button onClick={closeReport} className="text-gray-400 hover:text-gray-600 text-2xl" aria-label="Close">
                &times;
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4 text-sm">
                <div><p className="text-gray-500">Report Type</p><p className="font-semibold">{formatReportType(selectedReport.reportType)}</p></div>
                <div><p className="text-gray-500">Status</p><StatusBadge status={selectedReport.status} /></div>
                <div><p className="text-gray-500">Municipality</p><p className="font-semibold">{selectedReport.municipality?.name || '-'}</p></div>
                <div><p className="text-gray-500">Report Date</p><p className="font-semibold">{new Date(selectedReport.reportDate).toLocaleDateString()}</p></div>
                <div><p className="text-gray-500">Submitted By</p><p className="font-semibold">{selectedReport.submittedBy?.name || '-'}</p></div>
                <div><p className="text-gray-500">Submitted At</p><p className="font-semibold">{formatDateTime(selectedReport.submittedAt)}</p></div>
                <div><p className="text-gray-500">Approved By</p><p className="font-semibold">{selectedReport.reviewedBy?.name || 'Provincial Chief IIS'}</p></div>
                <div><p className="text-gray-500">Approved At</p><p className="font-semibold">{selectedReport.reviewedAt ? formatDateTime(selectedReport.reviewedAt) : '-'}</p></div>
                {(reportDetail?.respondingOfficer || selectedReport.respondingOfficer) && (
                  <div><p className="text-gray-500">Reporting Officer</p><p className="font-semibold">{reportDetail?.respondingOfficer || selectedReport.respondingOfficer}</p></div>
                )}
                {(reportDetail?.category || selectedReport.category) && (
                  <div><p className="text-gray-500">Category</p><p className="font-semibold">{(reportDetail?.category || selectedReport.category).replace(/_/g, ' ')}</p></div>
                )}
              </div>

              {parseJsonField(reportDetail?.attachments ?? selectedReport.attachments, []).length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-bold text-bfp-navy mb-3">Attachments</h3>
                  <AttachmentList
                    attachments={reportDetail?.attachments ?? selectedReport.attachments}
                    reportId={selectedReport.id}
                  />
                </div>
              )}

              {reportDetail?.incident && (
                <div className="bg-yellow-50 rounded-lg p-4">
                  <h3 className="font-bold text-bfp-navy mb-2">Incident Details</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-gray-500">Reference</p><p className="font-semibold">{reportDetail.incident.referenceNumber}</p></div>
                    <div><p className="text-gray-500">Category</p><p className="font-semibold">{reportDetail.incident.generalCategory}</p></div>
                    <div><p className="text-gray-500">Status</p><p className="font-semibold">{reportDetail.incident.status}</p></div>
                  </div>
                </div>
              )}

              {(reportDetail?.remarks || selectedReport.remarks) && (
                <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded">
                  <p className="text-sm font-semibold text-green-700">Approval Remarks</p>
                  <p className="text-sm text-green-700/80 mt-1">{reportDetail?.remarks || selectedReport.remarks}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
              <button
                onClick={() => openQr(selectedReport)}
                disabled={qrLoadingId === selectedReport.id}
                className="btn btn-secondary flex items-center gap-1.5 disabled:opacity-50"
              >
                <QrCode className="w-4 h-4" /> {qrLoadingId === selectedReport.id ? 'Generating…' : 'QR Code'}
              </button>
              <button onClick={closeReport} className="btn btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}

      {qrTarget && <ReportQrModal report={qrTarget} onClose={() => setQrTarget(null)} />}
    </div>
  );
}
