'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { FlaskConical, Loader2, Trash2 } from 'lucide-react';
import { useToast } from '../common/ToastProvider';
import { usePrivateField } from '../../hooks/usePrivateField';

const authHeaders = () => ({ Authorization: `Bearer ${sessionStorage.getItem('token')}` });

// Admin dashboard: create or remove the sample cases (lib/sample-data.js) that put real,
// openable reports and PDF files behind the dashboards' placeholder numbers.
export default function SampleDataPanel() {
  const toast = useToast();
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordEditable, setPasswordEditable] = useState(false);
  const privateField = usePrivateField();

  const loadStatus = async () => {
    try {
      const res = await axios.get('/api/admin/sample-data', { headers: authHeaders() });
      setStatus(res.data);
    } catch {
      setStatus(null);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const generate = async () => {
    setBusy(true);
    let total = 0;
    try {
      // One month per request; keep going until the server says everything is converted.
      for (let i = 0; i < 200; i += 1) {
        const res = await axios.post('/api/admin/sample-data', { action: 'generate' }, { headers: authHeaders() });
        if (res.data.done) break;
        total += res.data.created || 0;
        setProgress(`${res.data.label}: ${res.data.created} cases (${total} so far)…`);
      }
      toast.success(total ? `Created ${total} sample cases with their reports and files.` : 'Sample data is already up to date.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not create sample data. Click again to continue where it stopped.');
    } finally {
      setBusy(false);
      setProgress('');
      loadStatus();
    }
  };

  const remove = async (event) => {
    event.preventDefault();
    setBusy(true);
    let removed = 0;
    try {
      // A batch of cases per request; keep going until the server says none are left.
      for (let i = 0; i < 500; i += 1) {
        const res = await axios.post('/api/admin/sample-data', { action: 'remove', password }, { headers: authHeaders() });
        removed += res.data.removedReports || 0;
        if (res.data.done) break;
        setProgress(`Removed ${removed} sample reports so far…`);
      }
      toast.success(`Removed ${removed} sample reports. The placeholder numbers are back.`);
      setConfirmingRemove(false);
      setPassword('');
      setPasswordEditable(false);
    } catch (err) {
      toast.error(
        err.response?.data?.error ||
          `Could not finish removing sample data${removed ? ` (${removed} reports removed so far)` : ''}. Click Remove again to continue.`
      );
    } finally {
      setBusy(false);
      setProgress('');
      loadStatus();
    }
  };

  const hasSamples = status?.sampleCases > 0;
  const pending = status?.seedRemaining > 0;

  return (
    <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 sm:p-5 dark:border-amber-700/50 dark:bg-amber-950/20">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="flex items-center gap-2 font-semibold text-gray-900">
            <FlaskConical className="h-5 w-5 text-amber-600" /> Sample data for testing
          </h2>
          <p className="mt-1 text-sm text-gray-700">
            Turns the dashboard&apos;s placeholder numbers into real sample cases: each fire becomes an approved Spot report
            (plus Progress and Final reports for finished cases) with a matching PDF file, a barangay and casualty counts. Every
            number on the monitoring boards can then be opened down to its reports. Sample cases use reference numbers starting
            with <span className="font-mono">SAMPLE-</span> and every file is stamped &ldquo;Sample data&rdquo;.
          </p>
          <p className="mt-2 text-xs text-gray-600">
            {status
              ? `${status.sampleCases} sample cases (${status.sampleReports} reports) · ${status.firesRemaining} fires in the dashboard numbers still without reports`
              : 'Loading status…'}
          </p>
          {progress && <p className="mt-1 text-xs font-medium text-amber-800">{progress}</p>}
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={generate} disabled={busy || (hasSamples && !pending)} className="btn btn-primary inline-flex items-center gap-1.5">
            {busy && !confirmingRemove ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
            {hasSamples ? (pending ? 'Finish creating' : 'Sample data created') : 'Create sample data'}
          </button>
          {(hasSamples || status?.seedReplaced > 0) && !confirmingRemove && (
            <button type="button" onClick={() => setConfirmingRemove(true)} disabled={busy} className="btn btn-secondary inline-flex items-center gap-1.5">
              <Trash2 className="h-4 w-4" /> Remove sample data
            </button>
          )}
        </div>
      </div>

      {confirmingRemove && (
        <form onSubmit={remove} className="mt-4 flex flex-wrap items-end gap-2 border-t border-amber-200 pt-4">
          <div>
            <label className="form-label text-xs" htmlFor="sample-remove-password">Your password, to remove every sample case</label>
            <input
              id="sample-remove-password"
              name="confirm-sample-removal"
              {...privateField}
              className={`form-input ${privateField.className}`}
              readOnly={!passwordEditable}
              onFocus={() => setPasswordEditable(true)}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" disabled={busy || !password} className="btn btn-danger">
            {busy ? 'Removing…' : 'Remove'}
          </button>
          <button type="button" onClick={() => { setConfirmingRemove(false); setPassword(''); }} disabled={busy} className="btn btn-secondary">
            Cancel
          </button>
        </form>
      )}
    </section>
  );
}
