'use client';

import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Users, MessageSquare, ClipboardList } from 'lucide-react';
import PageHeader from '../../../../../components/common/PageHeader';
import SessionExpiredBanner from '../../../../../components/common/SessionExpiredBanner';
import TableSkeleton from '../../../../../components/common/TableSkeleton';
import { useToast } from '../../../../../components/common/ToastProvider';
import { useEscapeKey } from '../../../../../hooks/useEscapeKey';
import { formatDateTime, isAuthError } from '../../../../../lib/utils';
import { ASSIGNABLE_REPORT_TYPES } from '../../../../../lib/constants';
import { DirectiveStatusBadge, directiveTitle, isOverdue } from '../../../../../components/directives/DirectiveBadges';

const timeAgo = (date) => {
  if (!date) return 'Never signed in';
  const minutes = Math.round((Date.now() - new Date(date).getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return formatDateTime(date);
};

const emptyForm = { kind: 'MESSAGE', reportType: 'SPOT_INVESTIGATION', dueAt: '', message: '' };

export default function MarshalTeamPage() {
  const toast = useToast();
  const [investigators, setInvestigators] = useState([]);
  const [directives, setDirectives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sessionExpired, setSessionExpired] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [target, setTarget] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [sending, setSending] = useState(false);
  const [filterRecipient, setFilterRecipient] = useState('');
  const pollRef = useRef(null);

  useEffect(() => {
    fetchData();
    // Same visible-tab polling as the review dashboards, so "online" dots and investigator replies
    // stay current without a manual refresh.
    pollRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') fetchData({ silent: true });
    }, 30000);
    const onFocus = () => fetchData({ silent: true });
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(pollRef.current);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const fetchData = async ({ silent } = {}) => {
    try {
      if (!silent) setLoading(true);
      const headers = { Authorization: `Bearer ${sessionStorage.getItem('token')}` };
      const [teamRes, directivesRes] = await Promise.all([
        axios.get('/api/team', { headers }),
        axios.get('/api/directives', { headers }),
      ]);
      setInvestigators(teamRes.data.investigators || []);
      setDirectives(directivesRes.data.directives || []);
      setError('');
    } catch (err) {
      if (isAuthError(err)) {
        clearInterval(pollRef.current);
        setSessionExpired(true);
        return;
      }
      if (!silent) setError('Failed to load investigators');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const openCompose = (investigator, kind) => {
    setTarget(investigator);
    setForm({ ...emptyForm, kind });
  };

  const closeCompose = () => {
    setTarget(null);
    setForm(emptyForm);
  };

  useEscapeKey(closeCompose, !!target && !sending);

  const handleSend = async () => {
    if (!form.message.trim()) {
      toast.error(form.kind === 'ASSIGNMENT' ? 'Please enter instructions for this assignment.' : 'Please enter a message.');
      return;
    }
    setSending(true);
    try {
      await axios.post(
        '/api/directives',
        {
          kind: form.kind,
          recipientId: target.id,
          message: form.message,
          reportType: form.kind === 'ASSIGNMENT' ? form.reportType : null,
          // datetime-local has no zone; converting here sends the marshal's local time as UTC.
          dueAt: form.kind === 'ASSIGNMENT' && form.dueAt ? new Date(form.dueAt).toISOString() : null,
        },
        { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } }
      );
      toast.success(form.kind === 'ASSIGNMENT' ? `Report assigned to ${target.name}.` : `Message sent to ${target.name}.`);
      closeCompose();
      fetchData({ silent: true });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const handleCancel = async (directive) => {
    try {
      await axios.patch(
        `/api/directives/${directive.id}`,
        { status: 'CANCELLED' },
        { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } }
      );
      toast.success('Directive cancelled.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to cancel');
    } finally {
      fetchData({ silent: true });
    }
  };

  const visibleInvestigators = investigators
    .filter((investigator) => showInactive || investigator.isActive)
    // Online first, then most recently seen.
    .sort((a, b) => (b.isOnline - a.isOnline)
      || (new Date(b.lastSeenAt || 0) - new Date(a.lastSeenAt || 0)));
  const onlineCount = investigators.filter((investigator) => investigator.isOnline).length;
  const activeCount = investigators.filter((investigator) => investigator.isActive).length;
  const filteredDirectives = filterRecipient
    ? directives.filter((directive) => String(directive.recipientId) === filterRecipient)
    : directives;

  return (
    <div className="p-8 space-y-8">
      <PageHeader
        icon={Users}
        eyebrow="Municipal Fire Marshal"
        title="My Investigators"
        description="See which investigators in your municipality are on the system, send them a message, or assign them a report to prepare. They are notified in-app and by email, and their replies show up below."
      />

      {sessionExpired && <SessionExpiredBanner />}

      {!sessionExpired && error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">{error}</div>
      )}

      {loading ? (
        <div className="bg-white rounded-lg shadow-md p-6">
          <TableSkeleton rows={4} columns={5} />
        </div>
      ) : (
        <>
          <section className="bg-white rounded-lg shadow-md p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xl font-bold text-bfp-navy">Investigators</h2>
                <p className="text-sm text-gray-500">
                  {onlineCount} online now · {activeCount} active account{activeCount === 1 ? '' : 's'}
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
                Show deactivated accounts
              </label>
            </div>

            {visibleInvestigators.length === 0 ? (
              <p className="text-gray-600">No investigator accounts in your municipality yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Investigator</th>
                      <th>Status</th>
                      <th>Open Orders</th>
                      <th>Reports Needing Action</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleInvestigators.map((investigator) => (
                      <tr key={investigator.id}>
                        <td>
                          <p className="font-semibold">{investigator.rank ? `${investigator.rank} ` : ''}{investigator.name}</p>
                          <p className="text-xs text-gray-500">{investigator.email}</p>
                        </td>
                        <td>
                          {!investigator.isActive ? (
                            <span className="text-sm text-gray-400">Deactivated</span>
                          ) : (
                            <span className="flex items-center gap-2 text-sm">
                              <span className={`h-2.5 w-2.5 rounded-full ${investigator.isOnline ? 'bg-bfp-green' : 'bg-gray-300'}`} />
                              {investigator.isOnline ? 'Online' : `Last seen: ${timeAgo(investigator.lastSeenAt)}`}
                            </span>
                          )}
                        </td>
                        <td>{investigator.openDirectives}</td>
                        <td>{investigator.reportsNeedingAction}</td>
                        <td>
                          {investigator.isActive && (
                            <div className="flex flex-wrap gap-2">
                              <button onClick={() => openCompose(investigator, 'MESSAGE')} className="btn btn-secondary flex items-center gap-1">
                                <MessageSquare className="w-4 h-4" /> Message
                              </button>
                              <button onClick={() => openCompose(investigator, 'ASSIGNMENT')} className="btn btn-primary flex items-center gap-1">
                                <ClipboardList className="w-4 h-4" /> Assign Report
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="bg-white rounded-lg shadow-md p-6">
            <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
              <h2 className="text-xl font-bold text-bfp-navy">Sent Messages &amp; Assignments</h2>
              <div className="w-60">
                <label className="form-label">Investigator</label>
                <select className="form-select w-full" value={filterRecipient} onChange={(e) => setFilterRecipient(e.target.value)}>
                  <option value="">All investigators</option>
                  {investigators.map((investigator) => (
                    <option key={investigator.id} value={investigator.id}>{investigator.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {filteredDirectives.length === 0 ? (
              <p className="text-gray-600">Nothing sent yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Sent</th>
                      <th>To</th>
                      <th>Type</th>
                      <th>Message</th>
                      <th>Due</th>
                      <th>Status</th>
                      <th>Reply</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDirectives.map((directive) => (
                      <tr key={directive.id}>
                        <td className="text-sm whitespace-nowrap">{formatDateTime(directive.createdAt)}</td>
                        <td>{directive.recipient?.name}</td>
                        <td className="font-semibold whitespace-nowrap">{directiveTitle(directive)}</td>
                        <td className="text-sm text-gray-700 whitespace-pre-line">{directive.message}</td>
                        <td className={`text-sm whitespace-nowrap ${isOverdue(directive) ? 'text-bfp-red font-semibold' : ''}`}>
                          {directive.dueAt ? formatDateTime(directive.dueAt) : '-'}
                          {isOverdue(directive) && <span className="block text-xs">Overdue</span>}
                        </td>
                        <td><DirectiveStatusBadge status={directive.status} /></td>
                        <td className="text-sm text-gray-600">{directive.response || '-'}</td>
                        <td>
                          {['PENDING', 'ACKNOWLEDGED'].includes(directive.status) && (
                            <button onClick={() => handleCancel(directive)} className="text-sm text-bfp-red hover:underline">Cancel</button>
                          )}
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

      {target && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="modal-pop-in bg-white rounded-lg shadow-2xl w-full max-w-lg max-h-screen overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-2xl font-bold text-bfp-navy">
                {form.kind === 'ASSIGNMENT' ? 'Assign Report' : 'Send Message'}
              </h2>
              <button onClick={closeCompose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                To: <span className="font-semibold text-gray-900">{target.rank ? `${target.rank} ` : ''}{target.name}</span>
              </p>

              <div className="flex gap-2">
                {['MESSAGE', 'ASSIGNMENT'].map((kind) => (
                  <button
                    key={kind}
                    onClick={() => setForm({ ...form, kind })}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      form.kind === kind ? 'bg-bfp-navy text-white border-bfp-navy' : 'bg-white text-bfp-navy border-bfp-navy hover:bg-gray-50'
                    }`}
                  >
                    {kind === 'ASSIGNMENT' ? 'Assign Report' : 'Message'}
                  </button>
                ))}
              </div>

              {form.kind === 'ASSIGNMENT' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Report to prepare</label>
                    <select className="form-select w-full" value={form.reportType} onChange={(e) => setForm({ ...form, reportType: e.target.value })}>
                      {Object.entries(ASSIGNABLE_REPORT_TYPES).map(([value, { label }]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Due <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input type="datetime-local" className="form-input w-full" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
                  </div>
                </div>
              )}

              <div>
                <label className="form-label">{form.kind === 'ASSIGNMENT' ? 'Instructions' : 'Message'}</label>
                <textarea
                  className="form-textarea w-full"
                  rows={5}
                  maxLength={2000}
                  placeholder={form.kind === 'ASSIGNMENT'
                    ? 'e.g. Conduct the spot investigation for the fire at Brgy. Poblacion this morning (Ref. BFP-BEN-2026-014).'
                    : 'Type your message or order...'}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end p-6 border-t bg-gray-50">
              <button onClick={closeCompose} className="btn btn-secondary" disabled={sending}>Cancel</button>
              <button onClick={handleSend} className="btn btn-primary" disabled={sending}>
                {sending ? 'Sending...' : form.kind === 'ASSIGNMENT' ? 'Assign' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
