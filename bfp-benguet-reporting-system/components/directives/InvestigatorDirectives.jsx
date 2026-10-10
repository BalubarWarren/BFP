'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { Megaphone } from 'lucide-react';
import { useToast } from '../common/ToastProvider';
import { formatDateTime, isAuthError } from '../../lib/utils';
import { ASSIGNABLE_REPORT_TYPES } from '../../lib/constants';
import { DirectiveStatusBadge, directiveTitle, isOverdue } from './DirectiveBadges';

// Messages and report assignments the Municipal Fire Marshal sent this investigator. Open ones are
// listed first; finished/cancelled ones collapse behind a toggle so the panel stays short.
export default function InvestigatorDirectives() {
  const toast = useToast();
  const [directives, setDirectives] = useState([]);
  const [replies, setReplies] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [showClosed, setShowClosed] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    fetchDirectives();
    pollRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') fetchDirectives();
    }, 30000);
    window.addEventListener('focus', fetchDirectives);
    return () => {
      clearInterval(pollRef.current);
      window.removeEventListener('focus', fetchDirectives);
    };
  }, []);

  async function fetchDirectives() {
    try {
      const res = await axios.get('/api/directives', {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
      });
      setDirectives(res.data.directives || []);
    } catch (err) {
      // Stop only once the session is gone (the dashboard's own poll surfaces that); a transient
      // failure just waits for the next tick.
      if (isAuthError(err)) clearInterval(pollRef.current);
    }
  }

  const updateStatus = async (directive, status) => {
    setBusyId(directive.id);
    try {
      await axios.patch(
        `/api/directives/${directive.id}`,
        { status, response: replies[directive.id] || '' },
        { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } }
      );
      setReplies((prev) => ({ ...prev, [directive.id]: '' }));
      toast.success(status === 'COMPLETED' ? 'Marked as done — the Fire Marshal has been notified.' : 'Acknowledged — the Fire Marshal has been notified.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update');
    } finally {
      setBusyId(null);
      fetchDirectives();
    }
  };

  const open = directives.filter((directive) => ['PENDING', 'ACKNOWLEDGED'].includes(directive.status));
  const closed = directives.filter((directive) => !['PENDING', 'ACKNOWLEDGED'].includes(directive.status));

  if (directives.length === 0) return null;

  return (
    <section className="bg-white rounded-lg shadow-md p-6 mb-8 border-l-4 border-bfp-red">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="flex items-center gap-2 text-xl font-bold text-bfp-navy">
          <Megaphone className="w-5 h-5 text-bfp-red" /> Orders from Fire Marshal
          {open.length > 0 && (
            <span className="rounded-full bg-bfp-red px-2 py-0.5 text-xs font-bold text-white">{open.length}</span>
          )}
        </h2>
        {closed.length > 0 && (
          <button onClick={() => setShowClosed(!showClosed)} className="text-sm text-bfp-navy hover:underline">
            {showClosed ? 'Hide' : 'Show'} finished ({closed.length})
          </button>
        )}
      </div>

      {open.length === 0 && <p className="text-gray-600">No open orders. You&apos;re all caught up.</p>}

      <div className="space-y-4">
        {[...open, ...(showClosed ? closed : [])].map((directive) => {
          const isOpen = ['PENDING', 'ACKNOWLEDGED'].includes(directive.status);
          const form = ASSIGNABLE_REPORT_TYPES[directive.reportType];
          return (
            <div key={directive.id} className={`rounded-lg border p-4 ${isOpen ? 'bg-white' : 'bg-gray-50'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-bfp-navy">{directiveTitle(directive)}</p>
                <DirectiveStatusBadge status={directive.status} />
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                From {directive.sender?.rank ? `${directive.sender.rank} ` : ''}{directive.sender?.name} · {formatDateTime(directive.createdAt)}
                {directive.dueAt && (
                  <span className={isOverdue(directive) ? 'text-bfp-red font-semibold' : ''}>
                    {' '}· Due {formatDateTime(directive.dueAt)}{isOverdue(directive) ? ' (overdue)' : ''}
                  </span>
                )}
              </p>
              <p className="mt-2 text-sm text-gray-800 whitespace-pre-line">{directive.message}</p>
              {directive.response && (
                <p className="mt-2 text-sm text-gray-600"><span className="font-semibold">Your reply:</span> {directive.response}</p>
              )}

              {isOpen && (
                <div className="mt-3 space-y-2">
                  <input
                    type="text"
                    className="form-input w-full"
                    maxLength={2000}
                    placeholder="Reply to the Fire Marshal (optional)"
                    value={replies[directive.id] || ''}
                    onChange={(e) => setReplies((prev) => ({ ...prev, [directive.id]: e.target.value }))}
                  />
                  <div className="flex flex-wrap gap-2">
                    {form && (
                      <Link href={form.path} className="btn btn-primary">Start {form.label}</Link>
                    )}
                    {directive.status === 'PENDING' && (
                      <button onClick={() => updateStatus(directive, 'ACKNOWLEDGED')} disabled={busyId === directive.id} className="btn btn-secondary">
                        Acknowledge
                      </button>
                    )}
                    <button onClick={() => updateStatus(directive, 'COMPLETED')} disabled={busyId === directive.id} className="btn btn-success">
                      Mark as Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
