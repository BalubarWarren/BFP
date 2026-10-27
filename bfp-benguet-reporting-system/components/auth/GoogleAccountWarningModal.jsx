'use client';

import { useState } from 'react';
import axios from 'axios';
import { ShieldAlert, UserX, Send, CheckCircle2, Mail, KeyRound, RefreshCw } from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';

const NOTE_MAX_LENGTH = 300;

// Shown on the login page when "Continue with Google" picks an account that can't use FireTrack
// (see the `code` returned by POST /api/auth/google): either no account exists for that Gmail, or
// it was deactivated. Explains why, what to do instead, and lets the person ask the admins for
// access (POST /api/auth/google/request-access) without leaving the page.
export default function GoogleAccountWarningModal({ warning, onClose, onUsePassword }) {
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // 'sent' | 'already'

  useEscapeKey(onClose, !sending);

  const isInactive = warning.code === 'GOOGLE_ACCOUNT_INACTIVE';

  const handleRequest = async () => {
    setError('');
    setSending(true);
    try {
      const res = await axios.post('/api/auth/google/request-access', {
        accessToken: warning.accessToken,
        note,
      });
      setResult(res.data.alreadyRequested ? 'already' : 'sent');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not send the request. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4"
      onClick={sending ? undefined : onClose}
    >
      <div
        className="modal-pop-in w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-2xl"
        role="alertdialog"
        aria-labelledby="google-warning-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-amber-200 bg-amber-50 px-6 py-4 rounded-t-lg">
          {isInactive ? (
            <UserX className="h-7 w-7 flex-shrink-0 text-amber-600" />
          ) : (
            <ShieldAlert className="h-7 w-7 flex-shrink-0 text-amber-600" />
          )}
          <div>
            <h2 id="google-warning-title" className="text-lg font-bold text-amber-800">
              {isInactive ? 'Account Deactivated' : 'Google Account Not Registered'}
            </h2>
            <p className="text-sm text-amber-700">You can&rsquo;t sign in to FireTrack with this account.</p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4 text-sm text-gray-700">
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <Mail className="h-4 w-4 flex-shrink-0 text-gray-500" />
            <div className="min-w-0">
              {warning.name && <p className="font-semibold text-bfp-navy truncate">{warning.name}</p>}
              <p className="truncate text-gray-600">{warning.email}</p>
            </div>
          </div>

          {result ? (
            <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-3 text-green-800">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">
                  {result === 'sent' ? 'Request sent to the administrators' : 'Request already sent'}
                </p>
                <p className="mt-1">
                  {result === 'sent'
                    ? 'They have been notified by email and in FireTrack.'
                    : 'You already asked for access in the last 24 hours — the administrators have it.'}{' '}
                  {isInactive
                    ? 'Once your account is reactivated you can sign in again.'
                    : `Once your account is created, you'll receive your login details at ${warning.email}.`}
                </p>
              </div>
            </div>
          ) : (
            <>
              <p>
                {isInactive
                  ? 'This FireTrack account has been deactivated by an administrator, so it can no longer sign in.'
                  : 'This Gmail address is not linked to any FireTrack account. Only accounts created by a BFP Benguet administrator can sign in — you cannot register yourself.'}
              </p>

              <div>
                <p className="font-semibold text-bfp-navy mb-2">What you can do</p>
                <ul className="space-y-2">
                  {!isInactive && (
                    <>
                      <li className="flex items-start gap-2">
                        <RefreshCw className="h-4 w-4 flex-shrink-0 mt-0.5 text-bfp-navy" />
                        <span>
                          If your FireTrack account uses a <strong>different Gmail</strong>, close this and choose
                          that account in &ldquo;Continue with Google&rdquo;.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <KeyRound className="h-4 w-4 flex-shrink-0 mt-0.5 text-bfp-navy" />
                        <span>
                          If your account uses a <strong>non-Gmail address</strong>, sign in with your email and
                          password instead.
                        </span>
                      </li>
                    </>
                  )}
                  <li className="flex items-start gap-2">
                    <Send className="h-4 w-4 flex-shrink-0 mt-0.5 text-bfp-navy" />
                    <span>
                      {isInactive
                        ? 'Ask an administrator to reactivate it below.'
                        : 'If you should have access, request an account from the administrators below.'}
                    </span>
                  </li>
                </ul>
              </div>

              <div>
                <label className="form-label" htmlFor="access-request-note">
                  Your rank, station and municipality <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <textarea
                  id="access-request-note"
                  className="form-input"
                  rows={2}
                  maxLength={NOTE_MAX_LENGTH}
                  placeholder="e.g. FO2, La Trinidad Fire Station — Investigator"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-400 bg-red-100 px-3 py-2 text-red-700">{error}</div>
              )}
            </>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t bg-gray-50 px-6 py-4 rounded-b-lg">
          {result ? (
            <button type="button" onClick={onClose} className="btn btn-primary" autoFocus>
              OK
            </button>
          ) : (
            <>
              {!isInactive && (
                <button type="button" onClick={onUsePassword} disabled={sending} className="btn btn-secondary mr-auto">
                  Use Email &amp; Password
                </button>
              )}
              <button type="button" onClick={onClose} disabled={sending} className="btn btn-secondary">
                Close
              </button>
              <button type="button" onClick={handleRequest} disabled={sending} className="btn btn-primary">
                {sending ? 'Sending…' : isInactive ? 'Request Reactivation' : 'Request Access'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
