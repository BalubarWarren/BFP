'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { MessageSquare, Megaphone } from 'lucide-react';
import { useToast } from '../common/ToastProvider';
import { formatDateTime, isAuthError } from '../../lib/utils';
import { ASSIGNABLE_REPORT_TYPES } from '../../lib/constants';
import { useOutsideClick } from '../../hooks/useOutsideClick';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { DirectiveStatusBadge, directiveTitle, isOverdue } from './DirectiveBadges';

// Fired (e.g. by a "new order" notification) to open this menu from anywhere.
export const OPEN_DIRECTIVES_EVENT = 'firetrack:open-directives';

const isOpenStatus = (directive) => ['PENDING', 'ACKNOWLEDGED'].includes(directive.status);

// Header message icon for investigators: the messages and report assignments the Municipal Fire
// Marshal sent them, in a dropdown. Open ones are listed first; finished/cancelled ones collapse
// behind a toggle.
export default function DirectivesMenu() {
  const toast = useToast();
  const [directives, setDirectives] = useState([]);
  const [replies, setReplies] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [showClosed, setShowClosed] = useState(false);
  const [show, setShow] = useState(false);
  const pollRef = useRef(null);
  const menuRef = useRef(null);

  useOutsideClick(menuRef, () => setShow(false), show);
  useEscapeKey(() => setShow(false), show);

  useEffect(() => {
    fetchDirectives();
    pollRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') fetchDirectives();
    }, 30000);
    const openMenu = () => {
      fetchDirectives();
      setShow(true);
    };
    window.addEventListener('focus', fetchDirectives);
    window.addEventListener(OPEN_DIRECTIVES_EVENT, openMenu);
    return () => {
      clearInterval(pollRef.current);
      window.removeEventListener('focus', fetchDirectives);
      window.removeEventListener(OPEN_DIRECTIVES_EVENT, openMenu);
    };
  }, []);

  async function fetchDirectives() {
    try {
      const res = await axios.get('/api/directives', {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
      });
      setDirectives(res.data.directives || []);
    } catch (err) {
      // Stop only once the session is gone; a transient failure just waits for the next tick.
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

  const open = directives.filter(isOpenStatus);
  const closed = directives.filter((directive) => !isOpenStatus(directive));
  const pending = directives.filter((directive) => directive.status === 'PENDING').length;
  const shown = [...open, ...(showClosed ? closed : [])];

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setShow(!show)}
        className={`relative flex h-9 w-9 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white ${
          show ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white' : ''
        }`}
        aria-label={open.length > 0 ? `Orders from Fire Marshal (${open.length} open)` : 'Orders from Fire Marshal'}
        title="Orders from Fire Marshal"
      >
        <MessageSquare className="h-[18px] w-[18px]" />
        {open.length > 0 && (
          <span
            className={`absolute right-1 top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white dark:ring-gray-950 ${
              pending > 0 ? 'bg-bfp-red' : 'bg-gray-400'
            }`}
          >
            {open.length > 9 ? '9+' : open.length}
          </span>
        )}
      </button>

      {show && (
        <div className="dropdown-in fixed inset-x-4 top-14 z-50 mt-1 max-h-[32rem] overflow-y-auto rounded-xl bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[30rem]">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Megaphone className="h-4 w-4 text-bfp-red" /> Orders from Fire Marshal
              {open.length > 0 && (
                <span className="rounded-md bg-bfp-red/10 px-1.5 py-0.5 text-[11px] font-medium text-bfp-red">{open.length} open</span>
              )}
            </h3>
            {closed.length > 0 && (
              <button onClick={() => setShowClosed(!showClosed)} className="text-xs font-medium text-bfp-navy hover:underline">
                {showClosed ? 'Hide' : 'Show'} finished ({closed.length})
              </button>
            )}
          </div>

          {shown.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <MessageSquare className="h-5 w-5 text-gray-300" />
              <p className="text-sm text-gray-500">No open orders. You&rsquo;re all caught up.</p>
            </div>
          ) : (
            <div className="space-y-3 p-3">
              {shown.map((directive) => {
                const isOpen = isOpenStatus(directive);
                const form = ASSIGNABLE_REPORT_TYPES[directive.reportType];
                return (
                  <div key={directive.id} className={`rounded-lg border border-gray-200 p-3 ${isOpen ? 'bg-white' : 'bg-gray-50'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-bfp-navy">{directiveTitle(directive)}</p>
                      <DirectiveStatusBadge status={directive.status} />
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">
                      From {directive.sender?.rank ? `${directive.sender.rank} ` : ''}{directive.sender?.name} · {formatDateTime(directive.createdAt)}
                      {directive.dueAt && (
                        <span className={isOverdue(directive) ? 'font-semibold text-bfp-red' : ''}>
                          {' '}· Due {formatDateTime(directive.dueAt)}{isOverdue(directive) ? ' (overdue)' : ''}
                        </span>
                      )}
                    </p>
                    <p className="mt-2 whitespace-pre-line text-sm text-gray-800">{directive.message}</p>
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
                            <Link href={form.path} onClick={() => setShow(false)} className="btn btn-primary">
                              Start {form.label}
                            </Link>
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
          )}
        </div>
      )}
    </div>
  );
}
