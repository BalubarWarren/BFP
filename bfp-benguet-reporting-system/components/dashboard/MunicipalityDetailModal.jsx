'use client';

import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { X, MapPin, Flame, HeartPulse, Coins, Inbox, FileSearch, Home, Building2, TreePine, Truck, Eye, ChevronRight } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';
import AttachmentList from '../reports/AttachmentList';
import ReportQrButton from '../reports/ReportQrButton';
import ReportDetailsModal from '../reports/ReportDetailsModal';
import { useEscapeKey } from '../../hooks/useEscapeKey';

const CATEGORY_META = [
  { field: 'residential', key: 'RESIDENTIAL', label: 'Residential', icon: Home, bar: 'bg-blue-500', text: 'text-blue-800', chip: 'bg-blue-50' },
  { field: 'nonResidential', key: 'NON_RESIDENTIAL', label: 'Non-Residential', icon: Building2, bar: 'bg-red-500', text: 'text-red-800', chip: 'bg-red-50' },
  { field: 'nonStructural', key: 'NON_STRUCTURAL', label: 'Non-Structural', icon: TreePine, bar: 'bg-orange-500', text: 'text-orange-800', chip: 'bg-orange-50' },
  { field: 'transport', key: 'TRANSPORT', label: 'Transport', icon: Truck, bar: 'bg-green-500', text: 'text-green-800', chip: 'bg-green-50' },
];
const CATEGORY_LABEL = Object.fromEntries(CATEGORY_META.map((c) => [c.key, c.label]));

const humanize = (value) =>
  String(value || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

const peso = (value) => `₱${Number(value || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;

// Everything the dashboard knows about one municipality for the selected period: the Monitoring
// Board counts (daily tallies + filed reports) broken down by category/sub-category, plus its
// recorded incidents (GET /api/incidents) with casualties, damage and status.
export default function MunicipalityDetailModal({ row, rank, municipalityCount, periodLabel, periodStart, periodEnd, filedReports, onClose }) {
  const [incidents, setIncidents] = useState(null);
  const [incidentError, setIncidentError] = useState('');
  // A filed report opened in full (ReportDetailsModal) on top of this popup.
  const [viewReport, setViewReport] = useState(null);
  const filedReportsRef = useRef(null);

  useEscapeKey(onClose, true);

  useEffect(() => {
    if (!row?.municipalityId) return;
    axios
      .get(`/api/incidents?municipalityId=${row.municipalityId}`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
      })
      .then((res) => setIncidents(res.data.incidents || []))
      .catch((err) => {
        setIncidents([]);
        setIncidentError(err.response?.data?.error || 'Could not load incident records.');
      });
  }, [row?.municipalityId]);

  const periodIncidents = (incidents || []).filter((incident) => {
    const date = new Date(incident.dateOfIncident);
    return date >= periodStart && date <= periodEnd;
  });
  const injured = periodIncidents.reduce((sum, i) => sum + (i.casualtiesInjured || 0), 0);
  const fatalities = periodIncidents.reduce((sum, i) => sum + (i.casualtiesFatalities || 0), 0);
  const damage = periodIncidents.reduce((sum, i) => sum + Number(i.estimatedDamage || 0), 0);
  const statusCounts = periodIncidents.reduce((acc, i) => ({ ...acc, [i.status]: (acc[i.status] || 0) + 1 }), {});

  const total = row?.total || 0;
  const tallyCount = Math.max(total - filedReports.length, 0);
  const maxCategory = Math.max(1, ...CATEGORY_META.map((c) => row?.[c.field] || 0));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="modal-pop-in flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${row?.municipality} incident information`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 bg-bfp-navy/5 p-4 sm:p-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-bfp-navy text-white shadow-sm">
              <MapPin className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-600">{periodLabel}</p>
              <h2 className="text-2xl font-bold leading-tight text-bfp-navy">{row?.municipality}</h2>
              {total > 0 && <p className="text-sm text-gray-600">Ranked #{rank} of {municipalityCount} municipalities</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/70 text-gray-500 shadow-sm transition hover:bg-white hover:text-gray-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-6 overflow-y-auto p-4 sm:p-6">
          {/* Stat strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Total Incidents', value: total, icon: Flame, className: 'bg-red-50 text-bfp-red' },
              { label: 'Filed Reports', value: filedReports.length, icon: FileSearch, className: 'bg-gray-50 text-gray-800' },
              { label: 'Casualties', value: incidents === null ? '…' : `${injured} / ${fatalities}`, hint: 'injured / deaths', icon: HeartPulse, className: 'bg-gray-50 text-gray-800' },
              { label: 'Est. Damage', value: incidents === null ? '…' : peso(damage), icon: Coins, className: 'bg-gray-50 text-gray-800' },
            ].map(({ label, value, hint, icon: Icon, className }) => {
              const body = (
                <>
                  <Icon className="h-4 w-4 opacity-70" />
                  <p className="mt-1 truncate text-xl font-bold">{value}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">{label}</p>
                  {hint && <p className="text-[10px] text-gray-400">{hint}</p>}
                </>
              );
              // "Filed Reports" jumps to the list of those reports, where each can be opened.
              return label === 'Filed Reports' && filedReports.length > 0 ? (
                <button
                  key={label}
                  type="button"
                  onClick={() => filedReportsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  title="Show the filed reports"
                  className={`group relative rounded-xl p-3 text-left ring-1 ring-bfp-navy/20 transition hover:ring-2 hover:ring-bfp-navy/40 ${className}`}
                >
                  {body}
                  <span className="absolute right-2 top-2 flex items-center text-[10px] font-semibold text-gray-600 group-hover:text-bfp-navy">
                    View <ChevronRight className="h-3 w-3" />
                  </span>
                </button>
              ) : (
                <div key={label} className={`rounded-xl p-3 ${className}`}>{body}</div>
              );
            })}
          </div>
          {tallyCount > 0 && (
            <p className="-mt-3 text-xs text-gray-400">
              {tallyCount} of the {total} incidents come from Daily Report tallies, which have no individual record.
            </p>
          )}

          {/* By classification */}
          <div>
            <h3 className="mb-2 font-bold text-bfp-navy">By Classification</h3>
            <ul className="space-y-2">
              {CATEGORY_META.map(({ field, label, icon: Icon, bar, text, chip }) => {
                const count = row?.[field] || 0;
                const subs = Object.entries(row?.subCategories?.[field] || {}).sort((a, b) => b[1] - a[1]);
                return (
                  <li key={field} className={`rounded-lg p-3 ${chip}`}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className={`flex items-center gap-2 font-semibold ${text}`}>
                        <Icon className="h-4 w-4" /> {label}
                      </span>
                      <span className={`font-bold ${text}`}>{count}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                      <div className={`h-full rounded-full ${bar}`} style={{ width: `${(count / maxCategory) * 100}%` }} />
                    </div>
                    {subs.length > 0 && (
                      <p className="mt-2 text-xs text-gray-600">
                        {subs.map(([sub, n]) => `${sub} (${n})`).join(' · ')}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Filed reports that reached the provincial level — each can be opened in full, and its
              files and QR code opened straight from here */}
          {filedReports.length > 0 && (
            <div ref={filedReportsRef} className="scroll-mt-4">
              <h3 className="mb-2 flex items-center gap-1.5 font-bold text-bfp-navy">
                <FileSearch className="h-4 w-4" /> Filed Investigation Reports ({filedReports.length})
              </h3>
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                {filedReports.map((report) => (
                  <li key={report.id} className="space-y-2 px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-semibold text-gray-800">{report.referenceNumber || `#${report.id}`}</span>
                        <span className="block text-xs text-gray-500">
                          {humanize(report.reportType)} · {new Date(report.reportDate).toLocaleDateString()}
                          {report.submittedBy ? ` · ${report.submittedBy}` : ''}
                        </span>
                      </div>
                      <StatusBadge status={report.status} />
                    </div>
                    <div className="flex flex-wrap items-start gap-2">
                      <button
                        type="button"
                        onClick={() => setViewReport(report)}
                        className="btn btn-primary inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs"
                      >
                        <Eye className="h-3.5 w-3.5" /> View Report
                      </button>
                      <AttachmentList attachments={report.attachments} reportId={report.id} />
                      <ReportQrButton report={report} className="btn btn-secondary px-2.5 py-1.5 text-xs" />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Incident status */}
          {periodIncidents.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(statusCounts).map(([status, count]) => (
                <span key={status} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                  {humanize(status)}: {count}
                </span>
              ))}
            </div>
          )}

          {/* Incident records */}
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 font-bold text-bfp-navy">
              <Flame className="h-4 w-4" /> Incident Records ({incidents === null ? '…' : periodIncidents.length})
            </h3>
            {incidents === null ? (
              <p className="py-6 text-center text-sm text-gray-400">Loading incidents…</p>
            ) : incidentError ? (
              <p className="py-6 text-center text-sm text-red-600">{incidentError}</p>
            ) : periodIncidents.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-200 py-8 text-center">
                <Inbox className="h-6 w-6 text-gray-300" />
                <p className="text-sm text-gray-400">No recorded incidents for this period.</p>
              </div>
            ) : (
              <>
                {/* Cards on phones, table from sm up */}
                <ul className="space-y-2 sm:hidden">
                  {periodIncidents.map((incident) => (
                    <li key={incident.id} className="rounded-lg border border-gray-200 p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-bfp-navy">{incident.referenceNumber}</span>
                        <span className="text-xs text-gray-500">{new Date(incident.dateOfIncident).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-gray-600">
                        {[incident.barangay, incident.address].filter(Boolean).join(', ') || 'No location recorded'}
                      </p>
                      <p className="mt-1 text-xs text-gray-600">
                        {CATEGORY_LABEL[incident.generalCategory] || humanize(incident.generalCategory)}
                        {incident.subCategory ? ` · ${incident.subCategory}` : ''} · {humanize(incident.status)}
                      </p>
                    </li>
                  ))}
                </ul>
                <div className="hidden overflow-x-auto rounded-lg sm:block">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Reference #</th>
                        <th>Date</th>
                        <th>Location</th>
                        <th>Classification</th>
                        <th>Status</th>
                        <th className="text-right">Injured / Deaths</th>
                        <th className="text-right">Damage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {periodIncidents.map((incident) => (
                        <tr key={incident.id}>
                          <td className="font-semibold">{incident.referenceNumber}</td>
                          <td>{new Date(incident.dateOfIncident).toLocaleDateString()}</td>
                          <td>{[incident.barangay, incident.address].filter(Boolean).join(', ') || '—'}</td>
                          <td>
                            {CATEGORY_LABEL[incident.generalCategory] || humanize(incident.generalCategory)}
                            {incident.subCategory && <span className="block text-xs text-gray-500">{incident.subCategory}</span>}
                          </td>
                          <td>{humanize(incident.status)}</td>
                          <td className="text-right">{incident.casualtiesInjured || 0} / {incident.casualtiesFatalities || 0}</td>
                          <td className="text-right">{incident.estimatedDamage != null ? peso(incident.estimatedDamage) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

        </div>

        <div className="flex justify-end border-t border-gray-100 bg-gray-50 px-4 py-3 sm:px-6">
          <button onClick={onClose} className="btn btn-secondary px-6">Close</button>
        </div>
      </div>

      {viewReport && (
        // Its own clicks must not reach this popup's backdrop, which would close both.
        <div onClick={(e) => e.stopPropagation()}>
          <ReportDetailsModal
            report={{ ...viewReport, municipality: { name: viewReport.municipality } }}
            onClose={() => setViewReport(null)}
          />
        </div>
      )}
    </div>
  );
}
