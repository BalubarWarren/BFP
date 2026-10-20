'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { X, FileText, Flame, History, Paperclip, QrCode, ExternalLink } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';
import AttachmentList from './AttachmentList';
import WorkflowTracker, { ROLE_LABELS } from './WorkflowTracker';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { formatDateTime, parseJsonField } from '../../lib/utils';

const humanize = (value) =>
  String(value || '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

// camelCase content keys (dateOfIncident) → "Date Of Incident"
const labelForKey = (key) =>
  key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());

const AUDIT_LABELS = {
  APPROVE_REPORT: 'Approved',
  RETURN_REPORT: 'Returned for revision',
  TEXT_BLAST_REPORT: 'Text blast sent',
  TRASH_REPORT: 'Moved to Trash',
  RESTORE_REPORT: 'Restored from Trash',
};

function Field({ label, value, wide = false }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="break-words font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function Section({ icon: Icon, title, children, tone = 'bg-gray-50' }) {
  return (
    <section className={`rounded-lg p-4 ${tone}`}>
      <h3 className="mb-3 flex items-center gap-2 font-bold text-bfp-navy">
        <Icon className="h-4 w-4" /> {title}
      </h3>
      {children}
    </section>
  );
}

// Read-only, complete view of one report and where it currently is in the review chain — opened
// from Report Tracking's "View Details". `report` is the list row (shown immediately); the full
// record and its review history are fetched on open.
export default function ReportDetailsModal({ report, onClose, showHistory = false }) {
  const [detail, setDetail] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadError, setLoadError] = useState('');

  useEscapeKey(onClose, true);

  useEffect(() => {
    if (report.isDemo) return;
    const headers = { Authorization: `Bearer ${sessionStorage.getItem('token')}` };
    axios
      .get(`/api/reports/${report.id}`, { headers })
      .then((res) => setDetail(res.data.report))
      .catch((err) => setLoadError(err.response?.data?.error || 'Could not load the full report.'));
    if (showHistory) {
      axios
        .get(`/api/audit-log?reportId=${report.id}`, { headers })
        .then((res) => setHistory(res.data.entries || []))
        .catch(() => setHistory([]));
    }
  }, [report.id, report.isDemo, showHistory]);

  const r = { ...report, ...(detail || {}) };
  const incident = r.incident || {};
  const content = parseJsonField(r.content, {});
  const contentEntries = Object.entries(content).filter(
    ([, value]) => value !== null && value !== undefined && value !== '' && typeof value !== 'object'
  );
  const attachments = parseJsonField(r.attachments, []);
  const currentHolder =
    r.status === 'APPROVED' && !r.passedToId
      ? 'Approved — Filed'
      : r.status === 'RETURNED'
        ? `Returned to ${r.submittedBy?.name || 'the investigator'}`
        : r.passedTo?.name
          ? `${r.passedTo.name} (${ROLE_LABELS[r.passedToRole] || humanize(r.passedToRole)})`
          : ROLE_LABELS[r.passedToRole] || humanize(r.passedToRole) || '—';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="modal-pop-in flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Report details"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-4 sm:p-6">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-bfp-red">Report Details · #{r.id}</p>
            <h2 className="mt-0.5 text-xl font-bold text-bfp-navy sm:text-2xl">{humanize(r.reportType)}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-600">
              <StatusBadge status={r.status} />
              {incident.referenceNumber && <span className="font-medium">{incident.referenceNumber}</span>}
              <span>· {r.municipality?.name}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto p-4 sm:p-6">
          {loadError && (
            <div className="rounded border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
              {loadError} Showing the summary only.
            </div>
          )}

          {/* Current status */}
          <section className="rounded-lg border border-bfp-navy/15 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Current Status</p>
            <p className="mt-1 text-lg font-bold text-bfp-navy">{currentHolder}</p>
            <div className="overflow-x-auto">
              <div className="min-w-[22rem]">
                <WorkflowTracker report={r} />
              </div>
            </div>
            {r.remarks && (
              <div className="mt-4 rounded border-l-4 border-red-400 bg-red-50 p-3">
                <p className="text-xs font-semibold text-red-700">Latest Remarks</p>
                <p className="mt-0.5 text-sm text-red-700">{r.remarks}</p>
              </div>
            )}
          </section>

          {/* Report information */}
          <Section icon={FileText} title="Report Information">
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <Field label="Report Type" value={humanize(r.reportType)} />
              <Field label="Report Date" value={r.reportDate && new Date(r.reportDate).toLocaleDateString()} />
              <Field label="Municipality" value={r.municipality?.name} />
              <Field label="Classification" value={r.category && humanize(r.category)} />
              <Field label="Submitted By" value={r.submittedBy && `${r.submittedBy.rank ? `${r.submittedBy.rank} ` : ''}${r.submittedBy.name}`} />
              <Field label="Submitted At" value={r.submittedAt && formatDateTime(r.submittedAt)} />
              <Field label="Submitted To" value={ROLE_LABELS[r.passedToRole] || (r.passedToRole && humanize(r.passedToRole))} />
              <Field label="Last Reviewed By" value={r.reviewedBy?.name} />
              <Field label="Last Reviewed At" value={r.reviewedAt && formatDateTime(r.reviewedAt)} />
              <Field label="Reporting Officer" value={r.respondingOfficer} />
              <Field label="Officer Rank" value={r.reportingOfficerRank} />
              <Field label="Responding Units" value={r.respondingUnits} />
              <Field label="Chief In-Charge" value={r.stationCommanderName} />
              {contentEntries.map(([key, value]) => (
                <Field
                  key={key}
                  label={labelForKey(key)}
                  value={/category/i.test(key) && /^[A-Z_]+$/.test(String(value)) ? humanize(value) : String(value)}
                  wide={String(value).length > 60}
                />
              ))}
            </div>
            {!detail && !loadError && !report.isDemo && <p className="mt-3 text-xs text-gray-400">Loading full report…</p>}
          </Section>

          {/* Incident */}
          {r.incident && (
            <Section icon={Flame} title="Incident Information" tone="bg-amber-50">
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <Field label="Reference #" value={incident.referenceNumber} />
                <Field label="Incident Status" value={incident.status && humanize(incident.status)} />
                <Field label="Date of Incident" value={incident.dateOfIncident && new Date(incident.dateOfIncident).toLocaleDateString()} />
                <Field label="Time of Incident" value={incident.timeOfIncident} />
                <Field label="Barangay" value={incident.barangay} />
                <Field label="Address" value={incident.address} />
                <Field label="Classification" value={incident.generalCategory && humanize(incident.generalCategory)} />
                <Field label="Sub-Category" value={incident.subCategory} />
                <Field label="Injured" value={incident.casualtiesInjured ?? null} />
                <Field label="Fatalities" value={incident.casualtiesFatalities ?? null} />
                <Field
                  label="Estimated Damage"
                  value={incident.estimatedDamage != null ? `₱${Number(incident.estimatedDamage).toLocaleString()}` : null}
                />
                <Field label="Affected Area" value={incident.estimatedAffectedArea} />
                <Field label="Cause of Fire" value={incident.causeOfFire} wide />
                <Field label="Description" value={incident.description} wide />
                <Field label="Investigation Findings" value={incident.fireInvestigationFindings} wide />
              </div>
            </Section>
          )}

          {/* Attachments */}
          {attachments.length > 0 && (
            <Section icon={Paperclip} title={`Attachments (${attachments.length})`}>
              <AttachmentList attachments={attachments} reportId={r.id} />
            </Section>
          )}

          {/* Review history */}
          {showHistory && history.length > 0 && (
            <Section icon={History} title="Review History">
              <ol className="space-y-3 border-l-2 border-gray-200 pl-4">
                {[...history].reverse().map((entry) => {
                  const changes = parseJsonField(entry.changes, {});
                  return (
                    <li key={entry.id} className="relative text-sm">
                      <span className="absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full bg-bfp-navy" />
                      <p className="font-semibold text-gray-900">
                        {AUDIT_LABELS[entry.action] || humanize(entry.action)}
                        {entry.actor && <span className="font-normal text-gray-600"> by {entry.actor.name}</span>}
                      </p>
                      <p className="text-xs text-gray-500">{formatDateTime(entry.createdAt)}</p>
                      {changes.remarks && <p className="mt-0.5 text-xs italic text-gray-600">&ldquo;{changes.remarks}&rdquo;</p>}
                    </li>
                  );
                })}
              </ol>
            </Section>
          )}

          {/* QR verification */}
          {r.qrToken && (
            <Section icon={QrCode} title="Verification">
              <a
                href={`/verify/${r.qrToken}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-bfp-navy hover:underline"
              >
                Open public verification page <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Section>
          )}
        </div>

        <div className="flex justify-end border-t border-gray-200 bg-gray-50 px-4 py-3 sm:px-6">
          <button type="button" onClick={onClose} className="btn btn-secondary px-6">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
