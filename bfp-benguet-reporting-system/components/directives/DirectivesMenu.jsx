'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { MessageSquare, Megaphone, Send, CheckCircle2 } from 'lucide-react';
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
// Marshal sent them. Replying marks a directive as received; starting an assignment marks it as
// read and opens the report form; submitting that report completes the assignment on its own.
export default function DirectivesMenu() {
  const toast = useToast();
  const router = useRouter();
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

  const patch = (directive, body) => axios.patch(`/api/directives/${directive.id}`, body, {
    headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
  });

  const sendReply = async (directive) => {
    const response = (replies[directive.id] || '').trim();
    if (!response) return;
    setBusyId(directive.id);
    try {
      await patch(directive, { action: 'REPLY', response });
      setReplies((prev) => ({ ...prev, [directive.id]: '' }));
      toast.success('Reply sent to the Fire Marshal.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send the reply');
    } finally {
      setBusyId(null);
      fetchDirectives();
    }
  };

  // Opening the assigned form tells the Fire Marshal it was read; the form opens either way.
  const startReport = async (directive, form) => {
    setBusyId(directive.id);
    try {
      if (directive.status === 'PENDING') await patch(directive, { action: 'START' });
    } catch {
      // Not worth blocking the investigator over; it's marked read on the next attempt.
    } finally {
      setBusyId(null);
      setShow(false);
      router.push(form.path);
      fetchDirectives();
    }
  };

  const open = directives.filter(isOpenStatus);
  const closed = directives.filter((directive) => !isOpenStatus(directive));
  const unread = directives.filter((directive) => directive.status === 'PENDING').length;
  const shown = [...open, ...(showClosed ? closed : [])];

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setShow(!show)}
        className={`relative flex h-9 w-9 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white ${
          show ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white' : ''
        }`}
        aria-label={unread > 0 ? `Orders from Fire Marshal (${unread} new)` : 'Orders from Fire Marshal'}
        title="Orders from Fire Marshal"
      >
        <MessageSquare className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-bfp-red px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white dark:ring-gray-950">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {show && (
        <div className="dropdown-in fixed inset-x-4 top-14 z-50 mt-1 max-h-[32rem] overflow-y-auto rounded-xl bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[30rem]">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Megaphone className="h-4 w-4 text-bfp-red" /> Orders from Fire Marshal
              {unread > 0 && (
                <span className="rounded-md bg-bfp-red/10 px-1.5 py-0.5 text-[11px] font-medium text-bfp-red">{unread} new</span>
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
              <p className="text-sm text-gray-500">No orders right now. You&rsquo;re all caught up.</p>
            </div>
          ) : (
            <div className="space-y-3 p-3">
              {shown.map((directive) => {
                const isOpen = isOpenStatus(directive);
                const form = directive.kind === 'ASSIGNMENT' ? ASSIGNABLE_REPORT_TYPES[directive.reportType] : null;
                const busy = busyId === directive.id;
                const draft = replies[directive.id] || '';
                return (
                  <div
                    key={directive.id}
                    className={`rounded-lg border p-3 ${
                      directive.status === 'PENDING' ? 'border-bfp-red/30 bg-red-50/30' : isOpen ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-bfp-navy">{directiveTitle(directive)}</p>
                      {directive.status === 'PENDING' ? (
                        <span className="rounded-full bg-bfp-red px-2.5 py-0.5 text-xs font-semibold text-white">New</span>
                      ) : directive.status === 'ACKNOWLEDGED' ? (
                        <span className="rounded-full bg-bfp-navy/10 px-2.5 py-0.5 text-xs font-semibold text-bfp-navy">
                          {directive.kind === 'ASSIGNMENT' ? 'In progress' : 'Seen'}
                        </span>
                      ) : (
                        <DirectiveStatusBadge status={directive.status} />
                      )}
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
                      <div className="mt-2 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
                        <p className="text-xs font-semibold text-gray-500">Your reply</p>
                        <p className="whitespace-pre-line">{directive.response}</p>
                      </div>
                    )}
                    {directive.status === 'COMPLETED' && directive.kind === 'ASSIGNMENT' && (
                      <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-bfp-green">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Report submitted
                      </p>
                    )}

                    {directive.status !== 'CANCELLED' && (
                      <form
                        className="mt-3 flex gap-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          sendReply(directive);
                        }}
                      >
                        <input
                          type="text"
                          className="form-input min-w-0 flex-1"
                          maxLength={500}
                          placeholder="Reply to the Fire Marshal"
                          value={draft}
                          onChange={(e) => setReplies((prev) => ({ ...prev, [directive.id]: e.target.value }))}
                        />
                        <button type="submit" disabled={busy || !draft.trim()} className="btn btn-secondary px-3" aria-label="Send reply">
                          <Send className="h-4 w-4" /> <span className="hidden sm:inline">Send</span>
                        </button>
                      </form>
                    )}

                    {isOpen && form && (
                      <button onClick={() => startReport(directive, form)} disabled={busy} className="btn btn-primary mt-2 w-full sm:w-auto">
                        Start {form.label} Report
                      </button>
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
