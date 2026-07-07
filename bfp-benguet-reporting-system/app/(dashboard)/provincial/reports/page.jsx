'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Flame } from 'lucide-react';
import StatusBadge from '@/components/common/StatusBadge';
import SessionExpiredBanner from '@/components/common/SessionExpiredBanner';
import { useToast } from '@/components/common/ToastProvider';
import { formatDateTime, isAuthError } from '@/lib/utils';

export default function ProvincialReportsPage() {
  const toast = useToast();
  const [incomingReports, setIncomingReports] = useState([]);
  const [reviewedReports, setReviewedReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sessionExpired, setSessionExpired] = useState(false);
  const pollRef = useRef(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportDetail, setReportDetail] = useState(null);
  const [comments, setComments] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchReports();

    pollRef.current = setInterval(() => fetchReports({ silent: true }), 15000);
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
      const [inRes, outRes] = await Promise.all([
        axios.get('/api/reports?view=incoming', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/reports?view=outgoing', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setIncomingReports(inRes.data.reports || []);
      setReviewedReports(outRes.data.reports || []);
    } catch (err) {
      if (isAuthError(err)) {
        clearInterval(pollRef.current);
        setSessionExpired(true);
        return;
      }
      if (!silent) setError('Failed to load reports');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const openReview = async (report) => {
    setSelectedReport(report);
    setComments('');
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

  const closeReview = () => {
    setSelectedReport(null);
    setReportDetail(null);
    setComments('');
  };

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      await axios.post(
        `/api/reports/${selectedReport.id}/approve`,
        { action: 'approve', remarks: comments || null },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      closeReview();
      fetchReports();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to approve report');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReturn = async () => {
    if (!comments.trim()) {
      toast.error('Please enter correction comments before returning the report.');
      return;
    }
    setActionLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      await axios.post(
        `/api/reports/${selectedReport.id}/approve`,
        { action: 'reject', remarks: comments },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      closeReview();
      fetchReports();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to return report');
    } finally {
      setActionLoading(false);
    }
  };

  const parseAttachments = (attachments) => {
    if (!attachments) return [];
    try { return typeof attachments === 'string' ? JSON.parse(attachments) : attachments; }
    catch { return []; }
  };

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold text-bfp-navy">Provincial Chief IIS — Reports</h1>

      {sessionExpired && <SessionExpiredBanner />}

      {!sessionExpired && error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">{error}</div>
      )}

      {loading ? (
        <p className="text-gray-600">Loading reports...</p>
      ) : (
        <>
          {/* Fire Incident Reports — incoming from municipalities */}
          <section className="bg-white rounded-lg shadow-md p-6">
            <h2 className="flex items-center gap-2 text-xl font-bold text-bfp-navy mb-4"><Flame className="w-5 h-5" /> Fire Incident Reports — For Review</h2>
            {incomingReports.length === 0 ? (
              <p className="text-gray-500">No pending reports for review.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Municipality</th>
                      <th>Type</th>
                      <th>Report Date</th>
                      <th>Submitted By</th>
                      <th>Status</th>
                      <th>Received At</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incomingReports.map((report) => (
                      <tr key={report.id}>
                        <td className="font-semibold">{report.municipality?.name}</td>
                        <td>{report.reportType}</td>
                        <td>{new Date(report.reportDate).toLocaleDateString()}</td>
                        <td>{report.submittedBy?.name}</td>
                        <td><StatusBadge status={report.status} /></td>
                        <td className="text-sm text-gray-500">{formatDateTime(report.submittedAt)}</td>
                        <td>
                          <button
                            onClick={() => openReview(report)}
                            className="btn btn-primary"
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Already reviewed fire incident reports */}
          <section className="bg-white rounded-lg shadow-md p-6">
            <h2 className="flex items-center gap-2 text-xl font-bold text-bfp-navy mb-4"><Flame className="w-5 h-5" /> Fire Incident Reports — Already Reviewed</h2>
            {reviewedReports.length === 0 ? (
              <p className="text-gray-500">No reviewed reports yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Municipality</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Returned To</th>
                      <th>Reviewed At</th>
                      <th>Comments</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewedReports.map((report) => (
                      <tr key={report.id}>
                        <td className="font-semibold">{report.municipality?.name}</td>
                        <td>{report.reportType}</td>
                        <td><StatusBadge status={report.status} /></td>
                        <td>{report.status === 'RETURNED' ? (report.submittedBy?.name || '-') : '-'}</td>
                        <td className="text-sm text-gray-500">{report.reviewedAt ? formatDateTime(report.reviewedAt) : '-'}</td>
                        <td className="text-sm text-gray-600 max-w-xs truncate">{report.remarks || '-'}</td>
                        <td>
                          <button onClick={() => openReview(report)} className="text-bfp-red hover:underline text-sm">View</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* Review Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-screen overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-2xl font-bold text-bfp-navy">Report Review</h2>
              <button onClick={closeReview} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>

            <div className="p-6 space-y-6">
              {/* Report Meta */}
              <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4 text-sm">
                <div><p className="text-gray-500">Municipality</p><p className="font-semibold">{reportDetail?.municipality?.name || selectedReport.municipality?.name}</p></div>
                <div><p className="text-gray-500">Report Type</p><p className="font-semibold">{selectedReport.reportType}</p></div>
                <div><p className="text-gray-500">Report Date</p><p className="font-semibold">{new Date(selectedReport.reportDate).toLocaleDateString()}</p></div>
                <div><p className="text-gray-500">Status</p><StatusBadge status={selectedReport.status} /></div>
                <div><p className="text-gray-500">Submitted By</p><p className="font-semibold">{selectedReport.submittedBy?.name}</p></div>
                <div><p className="text-gray-500">Submitted At</p><p className="font-semibold">{formatDateTime(selectedReport.submittedAt)}</p></div>
                {reportDetail?.respondingOfficer && (
                  <div><p className="text-gray-500">Reporting Officer</p><p className="font-semibold">{reportDetail.respondingOfficer}</p></div>
                )}
                {reportDetail?.reportingOfficerRank && (
                  <div><p className="text-gray-500">Rank</p><p className="font-semibold">{reportDetail.reportingOfficerRank}</p></div>
                )}
              </div>

              {/* Always-visible attachments list */}
              <div className="mt-3">
                {(parseAttachments(reportDetail?.attachments).length || parseAttachments(selectedReport?.attachments).length) > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-bold text-bfp-navy mb-3">Attachments</h3>
                    <ul className="space-y-2 text-sm">
                      {(parseAttachments(reportDetail?.attachments).length ? parseAttachments(reportDetail.attachments) : parseAttachments(selectedReport?.attachments)).map((attachment) => (
                        <li key={attachment.url}>
                          <a href={attachment.url} target="_blank" rel="noreferrer" className="font-medium text-bfp-red hover:underline">{attachment.name}</a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Incident info */}
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



              {/* Previous remarks */}
              {reportDetail?.remarks && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
                  <p className="text-sm font-semibold text-red-700">Previous Remarks</p>
                  <p className="text-sm text-red-600 mt-1">{reportDetail.remarks}</p>
                </div>
              )}

              {/* Comments box — always visible so reviewer can comment at any time */}
              <div>
                <label className="form-label">Correction Comments <span className="text-gray-400 font-normal">(required when returning)</span></label>
                <textarea
                  className="form-textarea w-full"
                  rows={6}
                  placeholder="Enter corrections or notes here..."
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                />
              </div>


            </div>

            {/* Action Buttons — show for SUBMITTED status */}
            <div className="flex gap-3 justify-end p-6 border-t bg-gray-50">
              <button onClick={closeReview} className="btn btn-secondary" disabled={actionLoading}>Cancel</button>
              {selectedReport.status === 'SUBMITTED' && (
                <>
                  <button onClick={handleReturn} disabled={actionLoading} className="btn btn-danger">
                    {actionLoading ? 'Processing...' : 'Return'}
                  </button>
                  <button onClick={handleApprove} disabled={actionLoading} className="btn btn-success">
                    {actionLoading ? 'Processing...' : 'Approve'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
