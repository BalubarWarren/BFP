'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { FileEdit, Search, Clock, CheckCircle2, MessageSquare, FileText } from 'lucide-react';
import StatusBadge from '../../../components/common/StatusBadge';
import SessionExpiredBanner from '../../../components/common/SessionExpiredBanner';
import { useToast } from '../../../components/common/ToastProvider';
import { formatDateTime, isAuthError } from '../../../lib/utils';
import ReportProgressBar, { getReportProgress } from '../../../components/reports/ReportProgressBar';
import AttachmentList from '../../../components/reports/AttachmentList';
import CaseFollowUpCta from '../../../components/reports/CaseFollowUpCta';

export default function MunicipalDashboard() {
  const toast = useToast();
  const [user, setUser] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportDetail, setReportDetail] = useState(null);
  const [blastLoadingId, setBlastLoadingId] = useState(null);
  const [forwardLoading, setForwardLoading] = useState(false);
  const [forwardTarget, setForwardTarget] = useState(null);
  const [forwardRole, setForwardRole] = useState('');
  const [sessionExpired, setSessionExpired] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const pollRef = useRef(null);

  useEffect(() => {
    const userData = sessionStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
    fetchReports();

    pollRef.current = setInterval(fetchReports, 15000);
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

  const needsForwarding = (report) =>
    report?.status === 'APPROVED' && !!report?.passedToId;

  const canTextBlast = (report) =>
    report?.reportType === 'SPOT_INVESTIGATION' && isFinallyApproved(report);

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

  const FORWARD_ROLE_LABELS = {
    MUNICIPAL_FIRE_MARSHAL: 'Municipal Fire Marshal',
    PROVINCIAL_CHIEF_IIS: 'Provincial Chief IIS',
  };

  const openForward = (report) => {
    const suggested = getApprovalInfo(report).nextStep === 'Municipal Fire Marshal'
      ? 'MUNICIPAL_FIRE_MARSHAL'
      : 'PROVINCIAL_CHIEF_IIS';
    setForwardTarget(report);
    setForwardRole(suggested);
  };

  const closeForward = () => {
    setForwardTarget(null);
    setForwardRole('');
  };

  const confirmForward = async () => {
    if (!forwardTarget || !forwardRole) return;
    setForwardLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      await axios.patch(
        `/api/reports/${forwardTarget.id}`,
        { status: 'SUBMITTED', passedToRole: forwardRole },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      closeForward();
      closeView();
      await fetchReports();
      toast.success(`Report submitted to ${FORWARD_ROLE_LABELS[forwardRole]} for review.`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to forward report');
    } finally {
      setForwardLoading(false);
    }
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

  const parseAttachments = (attachments) => {
    if (!attachments) return [];
    try { return typeof attachments === 'string' ? JSON.parse(attachments) : attachments; }
    catch { return []; }
  };

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
    .filter((r) =>
      search ? r.incident?.referenceNumber?.toLowerCase().includes(search.toLowerCase()) : true
    );

  return (
    <div className="p-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-bfp-navy mb-2">Welcome, {user?.name}</h1>
        <p className="text-gray-600">
          Municipality: <strong>{user?.municipality?.name}</strong>
        </p>
      </div>

      {sessionExpired && (
        <div className="mb-6">
          <SessionExpiredBanner />
        </div>
      )}

      {/* Report View Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-screen overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-2xl font-bold text-bfp-navy">Report Details</h2>
              <button onClick={closeView} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>

            <div className="p-6 space-y-6">
              {/* Meta */}
              <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4 text-sm">
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
                  <p className="flex items-center gap-1.5 text-sm font-bold text-bfp-green mb-1">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> Approved by {reportDetail?.reviewedBy?.name || 'Reviewer'}
                  </p>
                  <p className="text-sm text-bfp-green">This report has been given final approval and is ready to pass to the system.</p>
                </div>
              )}


            </div>

            <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
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
              {canTextBlast(selectedReport) && (
                <button
                  type="button"
                  onClick={() => handleTextBlast(selectedReport)}
                  className="btn btn-success"
                  disabled={blastLoadingId === selectedReport.id}
                >
                  {blastLoadingId === selectedReport.id ? 'Sending...' : (
                    <span className="flex items-center gap-1.5"><MessageSquare className="w-4 h-4" /> Text Blast</span>
                  )}
                </button>
              )}
              <button onClick={closeView} className="btn btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Forward (Submit) Modal — choose who receives the approved report next */}
      {forwardTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm">
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold text-bfp-navy">Submit Report</h3>
              <p className="text-sm text-gray-500 mt-1">Choose who should receive this report next.</p>
            </div>
            <div className="p-6 space-y-3">
              {Object.entries(FORWARD_ROLE_LABELS).map(([role, label]) => (
                <label
                  key={role}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${
                    forwardRole === role ? 'border-bfp-navy bg-bfp-navy/5' : 'border-gray-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="forwardRole"
                    value={role}
                    checked={forwardRole === role}
                    onChange={() => setForwardRole(role)}
                  />
                  <span className="font-medium text-gray-800">{label}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
              <button onClick={closeForward} className="btn btn-secondary" disabled={forwardLoading}>Cancel</button>
              <button onClick={confirmForward} className="btn btn-primary" disabled={forwardLoading || !forwardRole}>
                {forwardLoading ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Action Cards */}
      <div className="flex flex-col items-center gap-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-6xl mx-auto">
          <Link
            href="/municipal/reports/mdfir"
            className="card hover:shadow-lg transition-shadow cursor-pointer text-center"
          >
            <FileEdit className="w-9 h-9 mb-2 mx-auto text-bfp-red" />
            <h3 className="text-xl font-bold text-bfp-navy mb-2">MDFIR</h3>
            <p className="text-gray-600 mb-4">
              Submit a minimal damage fire incident report
            </p>
            <button className="btn btn-primary w-full">Submit Report →</button>
          </Link>

          <Link
            href="/municipal/reports/spot"
            className="card hover:shadow-lg transition-shadow cursor-pointer text-center"
          >
            <Search className="w-9 h-9 mb-2 mx-auto text-bfp-red" />
            <h3 className="text-xl font-bold text-bfp-navy mb-2">Spot Investigation</h3>
            <p className="text-gray-600 mb-4">
              Submit an on-site spot investigation report
            </p>
            <button className="btn btn-primary w-full">Submit Report →</button>
          </Link>

          <Link
            href="/municipal/reports/progress"
            className="card hover:shadow-lg transition-shadow cursor-pointer text-center"
          >
            <Clock className="w-9 h-9 mb-2 mx-auto text-bfp-red" />
            <h3 className="text-xl font-bold text-bfp-navy mb-2">Progress Investigation</h3>
            <p className="text-gray-600 mb-4">
              Update an ongoing fire investigation report
            </p>
            <button className="btn btn-primary w-full">Submit Report →</button>
          </Link>

          <Link
            href="/municipal/reports/final"
            className="card hover:shadow-lg transition-shadow cursor-pointer text-center"
          >
            <CheckCircle2 className="w-9 h-9 mb-2 mx-auto text-bfp-red" />
            <h3 className="text-xl font-bold text-bfp-navy mb-2">Final Investigation</h3>
            <p className="text-gray-600 mb-4">
              Submit the completed final investigation report
            </p>
            <button className="btn btn-primary w-full">Submit Report →</button>
          </Link>
        </div>
      </div>

      {/* My Reports Section */}
      <div className="space-y-4">
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
            <div className="w-full md:w-64">
              <label className="form-label">Search Reference #</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. BFP-BEN-2026-001"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
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
              </select>
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-gray-600">Loading reports...</div>
          ) : filteredReports.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center bg-gray-50 p-10 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
                <FileText className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-lg font-semibold text-bfp-navy">No reports found</p>
              <p className="mt-1 text-sm text-gray-500">
                {search ? 'No reports match that reference number.' : filterStatus ? 'No reports match the selected status.' : 'Submitted reports will appear here.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-gray-50">
                  <tr className="border-b border-gray-200">
                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">Report Type</th>
                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">Reference #</th>
                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">Report Date</th>
                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">Submitted At</th>
                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredReports.slice(0, 10).map((report) => (
                    <tr key={report.id} className="hover:bg-gray-50">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-900">{formatReportType(report.reportType)}</p>
                        <p className="text-xs text-gray-500">#{report.id}</p>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700">{report.incident?.referenceNumber || '-'}</td>
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
                        <div className="flex flex-wrap gap-2 items-center">
                          <button
                            onClick={() => openView(report)}
                            className="btn btn-primary text-sm py-1 px-3"
                          >
                            View
                          </button>
                          {report.status === 'RETURNED' && (
                            <Link href={`/municipal/reports/${report.id}/edit`} className="btn btn-danger text-sm py-1 px-3">
                              Revise
                            </Link>
                          )}
                          {needsForwarding(report) && (
                            <button
                              type="button"
                              onClick={() => openForward(report)}
                              className="btn btn-primary text-sm py-1 px-3"
                            >
                              Submit
                            </button>
                          )}
                          {canTextBlast(report) && (
                            <button
                              type="button"
                              onClick={() => handleTextBlast(report)}
                              className="btn btn-success text-sm py-1 px-3"
                              disabled={blastLoadingId === report.id}
                            >
                              {blastLoadingId === report.id ? 'Sending...' : 'Text Blast'}
                            </button>
                          )}
                        </div>
                        <ReportProgressBar progress={getReportProgress(report)} compact />
                        {['SPOT_INVESTIGATION', 'PROGRESS_INVESTIGATION'].includes(report.reportType) && isFinallyApproved(report) && (
                          <CaseFollowUpCta report={report} allReports={reports} />
                        )}
                        {report.status === 'RETURNED' && report.remarks && (
                          <p className="text-xs text-red-600 mt-1 max-w-xs truncate" title={report.remarks}>
                            {report.remarks}
                          </p>
                        )}
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
