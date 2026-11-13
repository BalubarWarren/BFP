'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { Link2, CheckCircle2 } from 'lucide-react';
import { getOpenCases } from '../../lib/report-workflow';

const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : '');

const caseLabel = (c) => {
  const ref = c.incident?.referenceNumber || `Case #${c.incidentId}`;
  const category = c.incident?.generalCategory || c.spot.category || 'Spot report';
  const date = formatDate(c.incident?.dateOfIncident || c.spot.reportDate);
  return `${ref} — ${category}${date ? ` (${date})` : ''} · Spot report #${c.spot.id}`;
};

// Picks the case (incident) a Progress or Final report continues. Only cases whose Spot report has
// final approval and that have no Final report yet are offered, so the new report is always tied
// to its Spot report. Opened from the Spot report's "Start Progress/Final Report" button (the
// incident is preselected), the case is locked and shown as a card instead of a dropdown.
export default function CaseSelect({ value, onChange, locked = false }) {
  const [cases, setCases] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get('/api/reports', {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
        });
        if (!cancelled) setCases(getOpenCases(res.data.reports || []));
      } catch {
        if (!cancelled) {
          setCases([]);
          setLoadError('Could not load your cases. Refresh the page to try again.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (cases === null) {
    return <p className="text-sm text-gray-500">Loading your cases…</p>;
  }

  const selected = cases.find((c) => String(c.incidentId) === String(value));

  if (locked && selected) {
    return (
      <div className="rounded-md border border-bfp-navy/30 bg-bfp-navy/5 p-3 text-sm dark:bg-white/5">
        <p className="flex items-center gap-1.5 font-semibold text-gray-900">
          <Link2 className="h-4 w-4 text-bfp-navy dark:text-blue-400" />
          Continues {selected.incident?.referenceNumber || `Case #${selected.incidentId}`}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-gray-600">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          Spot report #{selected.spot.id} · {selected.incident?.generalCategory || selected.spot.category || 'Spot report'}
          {selected.incident?.dateOfIncident ? ` · ${formatDate(selected.incident.dateOfIncident)}` : ''}
        </p>
        {selected.progressReports.length > 0 && (
          <p className="mt-1 text-xs text-gray-500">
            Progress report{selected.progressReports.length > 1 ? 's' : ''} already filed:{' '}
            {selected.progressReports.map((r) => `#${r.id}`).join(', ')}
          </p>
        )}
      </div>
    );
  }

  if (!cases.length) {
    return (
      <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
        {loadError ||
          'No open case yet. A Progress or Final report continues a Spot report, so it can be filed once your Spot report has final approval.'}
      </p>
    );
  }

  return (
    <>
      <select
        name="incidentId"
        value={selected ? value : ''}
        onChange={onChange}
        className="form-input"
        required
      >
        <option value="" className="text-gray-400">Select the Spot report this continues</option>
        {cases.map((c) => (
          <option key={c.incidentId} value={c.incidentId}>
            {caseLabel(c)}
          </option>
        ))}
      </select>
      {locked && value && !selected && (
        <p className="mt-1 text-xs text-bfp-red">
          That case can&apos;t take a new report (its Spot report isn&apos;t fully approved, or a Final report was already filed). Pick another.
        </p>
      )}
    </>
  );
}
