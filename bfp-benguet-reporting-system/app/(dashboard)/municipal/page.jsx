'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { FileEdit, Search, Clock, CheckCircle2, Check, MessageSquare } from 'lucide-react';
import StatusBadge from '@/components/common/StatusBadge';
import SessionExpiredBanner from '@/components/common/SessionExpiredBanner';
import { useToast } from '@/components/common/ToastProvider';
import { formatDateTime, isAuthError } from '@/lib/utils';

// ── Report review progress tracker ─────────────────────────────────────────────
const PROGRESS_STEP_LABELS = ['Submitted', 'Municipal Chief IIS', 'Municipal Fire Marshal', 'Provincial Chief IIS'];
const REVIEW_TIER_LABELS = ['Municipal Chief IIS', 'Municipal Fire Marshal', 'Provincial Chief IIS'];

const roleTierIndex = (role) => {
  if (role === 'MUNICIPAL_CHIEF_IIS' || role === 'MUNICIPAL_CHIEF_OPERATION') return 0;
  if (role === 'MUNICIPAL_FIRE_MARSHAL') return 1;
  if (role === 'PROVINCIAL_CHIEF_IIS') return 2;
  return null;
};

// Figures out which step of the review chain a report is currently at, for
// display in ReportProgressBar. Returns null for reports that aren't submitted yet.
const getReportProgress = (report) => {
  if (!report || report.status === 'DRAFT') return null;

  if (report.status === 'SUBMITTED') {
    const tier = roleTierIndex(report.passedToRole) ?? 0;
    return {
      activeIndex: tier + 1,
      variant: 'pending',
      description: `Awaiting review by ${REVIEW_TIER_LABELS[tier]}.`,
    };
  }

  if (report.status === 'RETURNED') {
    const tier = roleTierIndex(report.reviewedBy?.role) ?? 0;
    return {
      activeIndex: tier + 1,
      variant: 'returned',
      description: `Returned by ${REVIEW_TIER_LABELS[tier]} — needs revision.`,
    };
  }

  if (report.status === 'APPROVED') {
    const tier = roleTierIndex(report.reviewedBy?.role) ?? 0;
    if (!report.passedToId) {
      return {
        activeIndex: PROGRESS_STEP_LABELS.length,
        variant: 'done',
        description: `Approved by ${REVIEW_TIER_LABELS[tier]} — finalized.`,
      };
    }
    const nextTier = Math.min(tier + 1, REVIEW_TIER_LABELS.length - 1);
    return {
      activeIndex: nextTier + 1,
      variant: 'awaiting-forward',
      description: `Approved by ${REVIEW_TIER_LABELS[tier]} — proceed to next step: submit to ${REVIEW_TIER_LABELS[nextTier]}.`,
    };
  }

  return null;
};

function ReportProgressBar({ progress, compact }) {
  if (!progress) return null;
  const { activeIndex, variant, description } = progress;

  const activeColor = {
    pending: 'bg-blue-500',
    returned: 'bg-red-500',
    'awaiting-forward': 'bg-bfp-amber',
    done: 'bg-bfp-green',
  }[variant] || 'bg-blue-500';

  const descriptionColor = {
    pending: 'text-blue-700',
    returned: 'text-red-600',
    'awaiting-forward': 'text-bfp-navy',
    done: 'text-bfp-green',
  }[variant] || 'text-gray-600';

  return (
    <div className={compact ? 'mt-2 max-w-xs' : 'mt-1'}>
      <div className="flex items-center">
        {PROGRESS_STEP_LABELS.map((label, i) => {
          const isDone = i < activeIndex;
          const isActive = i === activeIndex;
          return (
            <div key={label} className={`flex items-center ${i < PROGRESS_STEP_LABELS.length - 1 ? 'flex-1' : ''}`}>
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className={`flex items-center justify-center rounded-full font-bold text-white ${compact ? 'w-5 h-5 text-[9px]' : 'w-7 h-7 text-xs'} ${
                    isDone ? 'bg-bfp-green' : isActive ? activeColor : 'bg-gray-300'
                  }`}
                >
                  {isDone ? <Check className={compact ? 'w-3 h-3' : 'w-4 h-4'} /> : i + 1}
                </div>
                {!compact && (
                  <span className={`mt-1 text-[10px] text-center leading-tight w-16 ${isActive ? 'font-bold text-gray-800' : 'text-gray-500'}`}>
                    {label}
                  </span>
                )}
              </div>
              {i < PROGRESS_STEP_LABELS.length - 1 && (
                <div className={`flex-1 h-1 mx-1 rounded ${i < activeIndex ? 'bg-bfp-green' : 'bg-gray-300'}`} />
              )}
            </div>
          );
        })}
      </div>
      {description && <p className={`text-xs mt-2 ${descriptionColor}`}>{description}</p>}
    </div>
  );
}

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
                  <ul className="space-y-2 text-sm">
                    {parseAttachments(reportDetail?.attachments || selectedReport.attachments).map((a) => (
                      <li key={a.url}>
                        <a href={a.url} target="_blank" rel="noreferrer" className="text-bfp-red hover:underline font-medium">{a.name}</a>
                      </li>
                    ))}
                  </ul>
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
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-bfp-navy mb-4">My Submitted Reports</h2>

        {loading ? (
          <p className="text-gray-600">Loading reports...</p>
        ) : reports.length === 0 ? (
          <p className="text-gray-600">No reports submitted yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Report Type</th>
                  <th>Report Date</th>
                  <th>Status</th>
                  <th>Submitted At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.slice(0, 10).map((report) => (
                  <tr key={report.id}>
                    <td className="font-semibold">{report.reportType}</td>
                    <td>{new Date(report.reportDate).toLocaleDateString()}</td>
                    <td>
                      <StatusBadge status={report.status} />
                    </td>
                    <td className="text-sm">
                      {formatDateTime(report.submittedAt)}
                    </td>
                    <td>
                      <div className="flex gap-2 items-center">
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

        {reports.length > 10 && (
          <div className="mt-4">
            <Link
              href="/municipal/reports"
              className="text-bfp-red hover:underline font-semibold"
            >
              View All Reports ({reports.length})
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
