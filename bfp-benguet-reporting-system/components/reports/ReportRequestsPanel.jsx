'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { RotateCcw, UserPlus, Users, FileText, X } from 'lucide-react';
import { useToast } from '../common/ToastProvider';
import { uploadDirect } from '../../lib/submit-report';
import { formatDateTime } from '../../lib/utils';

const authHeaders = () => ({ Authorization: `Bearer ${sessionStorage.getItem('token')}` });
const isFinallyApproved = (report) => report?.status === 'APPROVED' && !report?.passedToId;

const STATUS_LABEL = {
  PENDING: 'Waiting for Chief IIS',
  APPROVED: 'Approved',
  DECLINED: 'Declined',
  REVOKED: 'Access removed',
  CANCELLED: 'Cancelled',
};

// In the investigator's report window: who else may edit this report (co-investigators by Letter
// of Order), the reopen / co-investigator requests made for it, and the forms to make them. The
// Municipal Chief IIS decides them (components/reports/ReportRequestsInbox.jsx).
export default function ReportRequestsPanel({ report }) {
  const toast = useToast();
  const [me, setMe] = useState(null);
  const [requests, setRequests] = useState([]);
  const [mode, setMode] = useState(null); // 'REOPEN' | 'COLLABORATOR' | null
  const [reason, setReason] = useState('');
  const [investigators, setInvestigators] = useState([]);
  const [targetUserId, setTargetUserId] = useState('');
  const [letter, setLetter] = useState(null);
  const [busy, setBusy] = useState(false);

  const reportId = report?.id;

  const load = async () => {
    if (!(reportId > 0)) return;
    try {
      const res = await axios.get(`/api/reports/${reportId}/requests`, { headers: authHeaders() });
      setRequests(res.data.requests || []);
    } catch {
      setRequests([]);
    }
  };

  useEffect(() => {
    try {
      setMe(JSON.parse(sessionStorage.getItem('user') || 'null'));
    } catch {
      setMe(null);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  useEffect(() => {
    if (mode !== 'COLLABORATOR' || investigators.length) return;
    axios
      .get('/api/report-requests/investigators', { headers: authHeaders() })
      .then((res) => setInvestigators(res.data.investigators || []))
      .catch(() => setInvestigators([]));
  }, [mode, investigators.length]);

  if (!(reportId > 0) || !me || me.role !== 'INVESTIGATOR') return null;

  const isOwner = report.submittedById === me.id;
  const collaborators = requests.filter((r) => r.type === 'COLLABORATOR' && r.status === 'APPROVED');
  const pendingReopen = requests.find((r) => r.type === 'REOPEN' && r.status === 'PENDING');
  const canAskReopen = report.reportType === 'FINAL_INVESTIGATION' && isFinallyApproved(report) && !pendingReopen;
  const canAddCollaborator = isOwner && !isFinallyApproved(report);
  const history = requests.filter((r) => !(r.type === 'COLLABORATOR' && r.status === 'APPROVED'));

  const reset = () => {
    setMode(null);
    setReason('');
    setTargetUserId('');
    setLetter(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === 'REOPEN') {
        await axios.post(`/api/reports/${reportId}/requests`, { type: 'REOPEN', reason }, { headers: authHeaders() });
        toast.success('Request sent. The Municipal Chief IIS will decide whether to reopen the report.');
      } else {
        if (!letter) throw new Error('Attach the Letter of Order.');
        const [document] = await uploadDirect([letter], authHeaders());
        await axios.post(
          `/api/reports/${reportId}/requests`,
          { type: 'COLLABORATOR', targetUserId, reason, document },
          { headers: authHeaders() }
        );
        toast.success('Request sent to the Municipal Chief IIS for approval.');
      }
      reset();
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Could not send the request.');
    } finally {
      setBusy(false);
    }
  };

  const act = async (req, action) => {
    try {
      await axios.patch(`/api/report-requests/${req.id}`, { action }, { headers: authHeaders() });
      toast.success(action === 'CANCEL' ? 'Request cancelled.' : `${req.targetUser?.name} can no longer edit this report.`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not update the request.');
    }
  };

  if (!isOwner && !collaborators.length && !canAskReopen && !history.length) return null;

  return (
    <section className="rounded-lg border border-gray-200 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <Users className="h-4 w-4 text-gray-400" /> Investigators &amp; requests
        </p>
        <div className="flex flex-wrap gap-2">
          {canAskReopen && mode !== 'REOPEN' && (
            <button type="button" onClick={() => setMode('REOPEN')} className="btn btn-secondary inline-flex items-center gap-1.5 text-xs">
              <RotateCcw className="h-3.5 w-3.5" /> Request to reopen
            </button>
          )}
          {canAddCollaborator && mode !== 'COLLABORATOR' && (
            <button type="button" onClick={() => setMode('COLLABORATOR')} className="btn btn-secondary inline-flex items-center gap-1.5 text-xs">
              <UserPlus className="h-3.5 w-3.5" /> Add co-investigator
            </button>
          )}
        </div>
      </div>

      <ul className="space-y-1 text-sm text-gray-700">
        <li>
          <span className="font-medium">{isOwner ? 'You' : report.submittedBy?.name || 'Submitter'}</span>
          <span className="text-gray-500"> · submitted the report</span>
        </li>
        {collaborators.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
            <span>
              <span className="font-medium">{c.targetUserId === me.id ? 'You' : c.targetUser?.name}</span>
              <span className="text-gray-500"> · co-investigator by Letter of Order</span>
              {c.documentUrl && (
                <a href={c.documentUrl} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 text-xs text-bfp-navy hover:underline dark:text-blue-400">
                  <FileText className="h-3 w-3" /> Letter
                </a>
              )}
            </span>
            {isOwner && (
              <button type="button" onClick={() => act(c, 'REVOKE')} className="text-xs text-gray-500 hover:text-bfp-red">
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>

      {history.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-gray-100 pt-3 text-xs text-gray-600">
          {history.map((req) => (
            <li key={req.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {req.type === 'REOPEN' ? 'Reopen request' : `Co-investigator request for ${req.targetUser?.name}`} · {STATUS_LABEL[req.status] || req.status} ·{' '}
                {formatDateTime(req.decidedAt || req.createdAt)}
                {req.decisionNote && <span className="italic"> — {req.decisionNote}</span>}
              </span>
              {req.status === 'PENDING' && req.requestedById === me.id && (
                <button type="button" onClick={() => act(req, 'CANCEL')} className="text-gray-500 hover:text-bfp-red">
                  Cancel
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {mode && (
        <form onSubmit={submit} className="mt-3 space-y-3 rounded-md bg-gray-50 p-3 dark:bg-white/5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">
              {mode === 'REOPEN' ? 'Ask to reopen this Final Investigation Report' : 'Ask to add a co-investigator'}
            </p>
            <button type="button" onClick={reset} aria-label="Close" className="text-gray-400 hover:text-gray-700">
              <X className="h-4 w-4" />
            </button>
          </div>
          {mode === 'COLLABORATOR' && (
            <>
              <div>
                <label className="form-label text-xs">Investigator</label>
                <select className="form-input" value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} required>
                  <option value="">Select an investigator</option>
                  {investigators.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.rank ? `${inv.rank} ` : ''}{inv.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label text-xs">Letter of Order (PDF or photo)</label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  onChange={(e) => setLetter(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-bfp-navy file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
                  required
                />
              </div>
            </>
          )}
          <div>
            <label className="form-label text-xs">{mode === 'REOPEN' ? 'Why does it need to be reopened?' : 'Note (optional)'}</label>
            <textarea
              className="form-input"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={1000}
              required={mode === 'REOPEN'}
              minLength={mode === 'REOPEN' ? 10 : undefined}
              placeholder={mode === 'REOPEN' ? 'e.g. New laboratory results change the cause of fire.' : ''}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={reset} className="btn btn-secondary text-sm">Cancel</button>
            <button type="submit" disabled={busy} className="btn btn-primary text-sm">
              {busy ? 'Sending…' : 'Send to Chief IIS'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
