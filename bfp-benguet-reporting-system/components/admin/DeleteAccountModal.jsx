'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { Lock, AlertTriangle, Eye, EyeOff, X } from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { isAuthError } from '../../lib/utils';

const CONFIRM_WORD = 'DELETE';

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

// Two-step account delete:
//   1. the admin re-enters their own password (checked by the server before step 2 opens);
//   2. they see exactly what will be removed and type DELETE to confirm.
// The server checks the password again on the delete itself.
export default function DeleteAccountModal({ target, onClose, onDeleted, onSessionExpired }) {
  const [step, setStep] = useState('password'); // 'password' | 'confirm'
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // Browsers' password managers fill a saved password into any password field as soon as it
  // appears. Browsers don't autofill read-only fields, so it stays read-only until the admin
  // clicks or tabs into it, and must be typed (or picked from the browser's list) deliberately.
  const [passwordUnlocked, setPasswordUnlocked] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [impact, setImpact] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEscapeKey(onClose, !busy);

  const headers = () => ({ Authorization: `Bearer ${sessionStorage.getItem('token')}` });

  const handleError = (err, fallback) => {
    if (isAuthError(err) && err.response?.data?.code !== 'PASSWORD_INCORRECT') {
      onSessionExpired?.();
      return;
    }
    setError(err.response?.data?.error || fallback);
  };

  const verifyPassword = async (event) => {
    event.preventDefault();
    if (!password) return;
    setBusy(true);
    setError('');
    try {
      const res = await axios.post(`/api/users/${target.id}/delete-check`, { password }, { headers: headers() });
      setImpact(res.data);
      setStep('confirm');
    } catch (err) {
      handleError(err, 'Could not verify your password.');
    } finally {
      setBusy(false);
    }
  };

  const deleteAccount = async (event) => {
    event.preventDefault();
    if (confirmText !== CONFIRM_WORD) return;
    setBusy(true);
    setError('');
    try {
      await axios.delete(`/api/users/${target.id}?force=true`, { headers: headers(), data: { password } });
      onDeleted();
    } catch (err) {
      handleError(err, 'Failed to delete account.');
      if (err.response?.data?.code === 'PASSWORD_INCORRECT') {
        setStep('password');
        setPassword('');
      }
    } finally {
      setBusy(false);
    }
  };

  const nothingElse = impact && !impact.reportCount && !impact.incidentCount && !impact.annotationCount;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center modal-overlay p-4" onClick={busy ? undefined : onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        className="modal-pop-in w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-5">
          <div className="min-w-0">
            <p className="text-xs font-medium text-red-600">Delete account · Step {step === 'password' ? 1 : 2} of 2</p>
            <h2 id="delete-account-title" className="truncate text-lg font-semibold tracking-tight text-gray-900">
              {target.name}
            </h2>
            <p className="truncate text-sm text-gray-500">{target.email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === 'password' ? (
          <form onSubmit={verifyPassword} className="space-y-4 p-5">
            <div className="flex items-start gap-3 text-sm text-gray-600">
              <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
              <p>For security, enter <strong>your own</strong> FireTrack password to continue.</p>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="confirm-admin-password"
                className="form-input pr-10"
                placeholder="Click here and type your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                readOnly={!passwordUnlocked}
                onFocus={() => setPasswordUnlocked(true)}
                aria-label="Your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={onClose} disabled={busy} className="btn btn-secondary">Cancel</button>
              <button type="submit" disabled={busy || !password} className="btn btn-primary">
                {busy ? 'Checking…' : 'Continue'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={deleteAccount} className="space-y-4 p-5">
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900">
              <p className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" /> This cannot be undone.
              </p>
              {nothingElse ? (
                <p className="mt-1.5">Only the account itself will be deleted. It has no reports, incidents or comments.</p>
              ) : (
                <>
                  <p className="mt-1.5">Deleting this account will also permanently delete:</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5">
                    {impact.reportCount > 0 && <li><strong>{plural(impact.reportCount, 'report')}</strong> they submitted</li>}
                    {impact.incidentCount > 0 && <li>{plural(impact.incidentCount, 'incident')} they created</li>}
                    {impact.annotationCount > 0 && <li>{plural(impact.annotationCount, 'comment')} they left on reports</li>}
                  </ul>
                </>
              )}
            </div>
            {!nothingElse && (
              <p className="text-sm text-gray-600">
                If you only want to stop them signing in, close this and use <strong>Deactivate</strong> instead. Their reports will be kept.
              </p>
            )}
            <div>
              <label htmlFor="delete-confirm" className="form-label">
                Type <span className="font-mono font-semibold text-red-600">{CONFIRM_WORD}</span> to confirm
              </label>
              <input
                id="delete-confirm"
                className="form-input font-mono"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoComplete="off"
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={onClose} disabled={busy} className="btn btn-secondary">Cancel</button>
              <button type="submit" disabled={busy || confirmText !== CONFIRM_WORD} className="btn btn-danger">
                {busy ? 'Deleting…' : 'Delete Account'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
