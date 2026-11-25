'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { Inbox, RotateCcw, UserPlus, FileText, Check, X, Eye, UserMinus } from 'lucide-react';
import { useToast } from '../common/ToastProvider';
import ReportDetailsModal from './ReportDetailsModal';
import { fetchReportForModal } from '../../lib/notification-target';
import { formatDateTime } from '../../lib/utils';

const authHeaders = () => ({ Authorization: `Bearer ${sessionStorage.getItem('token')}` });

const TYPE_META = {
  REOPEN: { label: 'Reopen Final Investigation Report', icon: RotateCcw },
  COLLABORATOR: { label: 'Add co-investigator', icon: UserPlus },
};

const STATUS_STYLES = {
  PENDING: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  APPROVED: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  DECLINED: 'bg-red-50 text-red-700 ring-red-600/20',
  REVOKED: 'bg-gray-100 text-gray-600 ring-gray-500/20',
  CANCELLED: 'bg-gray-100 text-gray-600 ring-gray-500/20',
};

// Municipal Chief IIS: investigators' requests to reopen a finalized Final Investigation Report or
// to add a co-investigator (with Letter of Order) — approve or decline here. See
// lib/report-requests.js.
export default function ReportRequestsInbox() {
  const toast = useToast();
  const [requests, setRequests] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [notes, setNotes] = useState({});
  const [openReport, setOpenReport] = useState(null);

  const load = async () => {
    try {
      const res = await axios.get('/api/report-requests', { headers: authHeaders() });
      setRequests(res.data.requests || []);
    } catch {
      setRequests([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Opened from a request notification (#report-requests): bring the inbox into view once loaded.
  useEffect(() => {
    if (requests && window.location.hash === '#report-requests') {
      document.getElementById('report-requests')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [requests]);

  const act = async (req, action) => {
    setBusyId(req.id);
    try {
      await axios.patch(`/api/report-requests/${req.id}`, { action, note: notes[req.id] || '' }, { headers: authHeaders() });
      toast.success(
        action === 'APPROVE'
          ? req.type === 'REOPEN'
            ? `${req.report?.incident?.referenceNumber || 'The report'} was reopened and returned to the investigator.`
            : `${req.targetUser?.name} can now edit ${req.report?.incident?.referenceNumber || 'the report'}.`
          : action === 'REVOKE'
          ? `${req.targetUser?.name} can no longer edit ${req.report?.incident?.referenceNumber || 'the report'}.`
          : 'Request declined.'
      );
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not update the request.');
    } finally {
      setBusyId(null);
    }
  };

  const viewReport = async (reportId) => {
    try {
      setOpenReport(await fetchReportForModal(reportId));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const pending = (requests || []).filter((r) => r.status === 'PENDING');
  const shown = showAll ? requests || [] : pending;

  return (
    <section id="report-requests" className="scroll-mt-20 rounded-lg bg-white p-4 shadow-md sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-gray-900">
            <Inbox className="h-5 w-5 text-gray-400" /> Investigator Requests
            {pending.length > 0 && (
              <span className="rounded-full bg-bfp-red px-2 py-0.5 text-xs font-semibold text-white">{pending.length}</span>
            )}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Requests to reopen a finalized Final Investigation Report, or to let another investigator edit a report under a Letter of Order.
          </p>
        </div>
        <button type="button" onClick={() => setShowAll((v) => !v)} className="btn btn-secondary text-sm">
          {showAll ? 'Show pending only' : 'Show all requests'}
        </button>
      </div>

      {requests === null ? (
        <div className="h-16 animate-pulse rounded-md bg-gray-100" />
      ) : shown.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
          {showAll ? 'No requests yet.' : 'No requests waiting for your decision.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {shown.map((req) => {
            const meta = TYPE_META[req.type] || TYPE_META.REOPEN;
            const Icon = meta.icon;
            const busy = busyId === req.id;
            return (
              <li key={req.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-semibold text-gray-900">
                      <Icon className="h-4 w-4 text-bfp-navy dark:text-blue-400" /> {meta.label}
                      <span className={`badge ring-1 ring-inset ${STATUS_STYLES[req.status] || ''}`}>{req.status.toLowerCase()}</span>
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      {req.report?.incident?.referenceNumber || 'Report'} · requested by{' '}
                      <span className="font-medium text-gray-800">{req.requestedBy?.name}</span> · {formatDateTime(req.createdAt)}
                    </p>
                    {req.type === 'COLLABORATOR' && (
                      <p className="mt-1 text-sm text-gray-600">
                        Co-investigator: <span className="font-medium text-gray-800">{req.targetUser?.name}</span>
                      </p>
                    )}
                    {req.reason && <p className="mt-2 rounded-md bg-gray-50 p-2.5 text-sm text-gray-700">&ldquo;{req.reason}&rdquo;</p>}
                    {req.decisionNote && <p className="mt-1 text-xs text-gray-500">Decision note: {req.decisionNote}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {req.documentUrl && (
                      <a href={req.documentUrl} target="_blank" rel="noreferrer" className="btn btn-secondary inline-flex items-center gap-1.5 text-sm">
                        <FileText className="h-4 w-4" /> Letter of Order
                      </a>
                    )}
                    <button type="button" onClick={() => viewReport(req.reportId)} className="btn btn-secondary inline-flex items-center gap-1.5 text-sm">
                      <Eye className="h-4 w-4" /> Report
                    </button>
                  </div>
                </div>

                {req.status === 'PENDING' && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                    <input
                      type="text"
                      className="form-input min-w-[12rem] flex-1 text-sm"
                      placeholder="Note to the investigator (optional)"
                      value={notes[req.id] || ''}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [req.id]: e.target.value }))}
                      maxLength={1000}
                    />
                    <button type="button" disabled={busy} onClick={() => act(req, 'DECLINE')} className="btn btn-secondary inline-flex items-center gap-1.5 text-sm">
                      <X className="h-4 w-4" /> Decline
                    </button>
                    <button type="button" disabled={busy} onClick={() => act(req, 'APPROVE')} className="btn btn-primary inline-flex items-center gap-1.5 text-sm">
                      <Check className="h-4 w-4" /> {busy ? 'Saving…' : 'Approve'}
                    </button>
                  </div>
                )}

                {req.type === 'COLLABORATOR' && req.status === 'APPROVED' && (
                  <div className="mt-3 flex justify-end border-t border-gray-100 pt-3">
                    <button type="button" disabled={busy} onClick={() => act(req, 'REVOKE')} className="btn btn-secondary inline-flex items-center gap-1.5 text-sm">
                      <UserMinus className="h-4 w-4" /> Remove access
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {openReport && <ReportDetailsModal report={openReport} onClose={() => setOpenReport(null)} />}
    </section>
  );
}
