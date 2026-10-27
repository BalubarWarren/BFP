'use client';

import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
  X, MapPin, Flame, HeartPulse, Coins, Inbox, FileSearch, Home, Building2, TreePine, Truck, Eye, ChevronRight, ChevronDown,
} from 'lucide-react';
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

// What the Casualties / Est. Damage cards (and the chips above the table) do to Incident Records.
const INCIDENT_VIEWS = {
  all: 'All',
  casualties: 'With casualties',
  damage: 'Highest damage first',
};

const humanize = (value) =>
  String(value || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

const peso = (value) => `₱${Number(value || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;

const scrollTo = (ref) => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

// One filed report: reference, type/date/investigator, status, and its actions.
function FiledReport({ report, onView, showCategory = false }) {
  return (
    <li className="space-y-2 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="font-semibold text-gray-800">{report.referenceNumber || `#${report.id}`}</span>
          <span className="block text-xs text-gray-500">
            {humanize(report.reportType)} · {new Date(report.reportDate).toLocaleDateString()}
            {report.submittedBy ? ` · ${report.submittedBy}` : ''}
            {showCategory && report.category
              ? ` · ${CATEGORY_META.find((c) => c.field === report.category)?.label}${report.subCategory ? ` (${report.subCategory})` : ''}`
              : ''}
          </span>
        </div>
        <StatusBadge status={report.status} />
      </div>
      <div className="flex flex-wrap items-start gap-2">
        <button
          type="button"
          onClick={() => onView(report)}
          className="btn btn-primary inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs"
        >
          <Eye className="h-3.5 w-3.5" /> View Report
        </button>
        <AttachmentList attachments={report.attachments} reportId={report.id} />
        <ReportQrButton report={report} className="btn btn-secondary px-2.5 py-1.5 text-xs" />
      </div>
    </li>
  );
}

// Everything the dashboard knows about one municipality for the selected period: the Monitoring
// Board counts (daily tallies + filed reports) broken down by category/sub-category, plus its
// recorded incidents (GET /api/incidents) with casualties, damage and status. Every number leads
// somewhere: the stat cards jump to (and filter) the matching section, and each classification
// opens to the filed reports counted in it, filterable by sub-category.
export default function MunicipalityDetailModal({ row, rank, municipalityCount, periodLabel, periodStart, periodEnd, filedReports, onClose }) {
  const [incidents, setIncidents] = useState(null);
  const [incidentError, setIncidentError] = useState('');
  // A filed report opened in full (ReportDetailsModal) on top of this popup.
  const [viewReport, setViewReport] = useState(null);
  const [openCategories, setOpenCategories] = useState([]);
  const [subFilter, setSubFilter] = useState({}); // field -> sub-category being shown
  const [incidentView, setIncidentView] = useState('all');
  const classificationRef = useRef(null);
  const filedReportsRef = useRef(null);
  const incidentsRef = useRef(null);

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

  const shownIncidents = incidentView === 'casualties'
    ? periodIncidents.filter((i) => (i.casualtiesInjured || 0) + (i.casualtiesFatalities || 0) > 0)
    : incidentView === 'damage'
      ? [...periodIncidents].sort((a, b) => Number(b.estimatedDamage || 0) - Number(a.estimatedDamage || 0))
      : periodIncidents;

  const total = row?.total || 0;
  const tallyCount = Math.max(total - filedReports.length, 0);
  const maxCategory = Math.max(1, ...CATEGORY_META.map((c) => row?.[c.field] || 0));

  const toggleCategory = (field) =>
    setOpenCategories((open) => (open.includes(field) ? open.filter((f) => f !== field) : [...open, field]));

  const showIncidents = (view) => {
    setIncidentView(view);
    scrollTo(incidentsRef);
  };

  const statCards = [
    {
      label: 'Total Incidents', value: total, icon: Flame, className: 'bg-red-50 text-bfp-red',
      title: 'Open every classification',
      onClick: () => {
        setOpenCategories(CATEGORY_META.filter((c) => (row?.[c.field] || 0) > 0).map((c) => c.field));
        scrollTo(classificationRef);
      },
    },
    {
      label: 'Filed Reports', value: filedReports.length, icon: FileSearch, className: 'bg-gray-50 text-gray-800',
      title: 'Show the filed reports',
      onClick: () => scrollTo(filedReportsRef),
    },
    {
      label: 'Casualties', value: incidents === null ? '…' : `${injured} / ${fatalities}`, hint: 'injured / deaths',
      icon: HeartPulse, className: 'bg-gray-50 text-gray-800',
      title: 'Show incidents with casualties',
      onClick: () => showIncidents('casualties'),
    },
    {
      label: 'Est. Damage', value: incidents === null ? '…' : peso(damage), icon: Coins, className: 'bg-gray-50 text-gray-800',
      title: 'Show incidents by damage, highest first',
      onClick: () => showIncidents('damage'),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="modal-pop-in flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
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
          {/* Stat strip — each card jumps to (and filters) the section behind its number */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {statCards.map(({ label, value, hint, icon: Icon, className, title, onClick }) => (
              <button
                key={label}
                type="button"
                onClick={onClick}
                title={title}
                className={`group relative rounded-xl p-3 text-left ring-1 ring-bfp-navy/15 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-2 hover:ring-bfp-navy/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-bfp-navy ${className}`}
              >
                <Icon className="h-4 w-4 opacity-70" />
                <p className="mt-1 truncate text-xl font-bold">{value}</p>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">{label}</p>
                {hint && <p className="text-[10px] text-gray-400">{hint}</p>}
                <span className="absolute right-2 top-2 flex items-center text-[10px] font-semibold text-gray-600 group-hover:text-bfp-navy">
                  View <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>
            ))}
          </div>
          {tallyCount > 0 && (
            <p className="-mt-3 text-xs text-gray-400">
              {tallyCount} of the {total} incidents come from Daily Report tallies, which have no individual record.
            </p>
          )}

          {/* By classification — each opens to the filed reports counted in it */}
          <div ref={classificationRef} className="scroll-mt-4">
            <h3 className="mb-1 font-bold text-bfp-navy">By Classification</h3>
            <p className="mb-2 text-xs text-gray-500">Click a classification to see its reports.</p>
            <ul className="space-y-2">
              {CATEGORY_META.map(({ field, label, icon: Icon, bar, text, chip }) => {
                const count = row?.[field] || 0;
                const subs = Object.entries(row?.subCategories?.[field] || {}).sort((a, b) => b[1] - a[1]);
                const reports = filedReports.filter((report) => report.category === field);
                const activeSub = subFilter[field] || null;
                const shown = activeSub ? reports.filter((report) => report.subCategory === activeSub) : reports;
                const tallies = Math.max(count - reports.length, 0);
                const isOpen = openCategories.includes(field);
                const panelId = `classification-${field}`;
                return (
                  <li key={field} className={`overflow-hidden rounded-lg ${chip}`}>
                    <button
                      type="button"
                      onClick={() => toggleCategory(field)}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      className="group w-full p-3 text-left transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-bfp-navy"
                    >
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className={`flex items-center gap-2 font-semibold ${text}`}>
                          <Icon className="h-4 w-4" /> {label}
                        </span>
                        <span className={`flex items-center gap-2 font-bold ${text}`}>
                          {count}
                          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                        <div className={`h-full rounded-full ${bar}`} style={{ width: `${(count / maxCategory) * 100}%` }} />
                      </div>
                      {!isOpen && subs.length > 0 && (
                        <p className="mt-2 text-xs text-gray-600">{subs.map(([sub, n]) => `${sub} (${n})`).join(' · ')}</p>
                      )}
                    </button>

                    {isOpen && (
                      <div id={panelId} className="space-y-2 border-t border-black/5 px-3 pb-3 pt-2">
                        {subs.length > 0 && (
                          <div className="flex flex-wrap gap-1.5" role="group" aria-label={`${label} sub-categories`}>
                            {[[null, reports.length], ...subs].map(([sub, n]) => (
                              <button
                                key={sub || 'all'}
                                type="button"
                                aria-pressed={activeSub === sub}
                                onClick={() => setSubFilter((current) => ({ ...current, [field]: sub }))}
                                className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                                  activeSub === sub ? 'bg-bfp-navy text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
                                }`}
                              >
                                {sub ? `${sub} (${n})` : `All (${n})`}
                              </button>
                            ))}
                          </div>
                        )}
                        {shown.length > 0 ? (
                          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
                            {shown.map((report) => (
                              <FiledReport key={report.id} report={report} onView={setViewReport} />
                            ))}
                          </ul>
                        ) : (
                          <p className="rounded-lg bg-white px-3 py-4 text-center text-sm text-gray-500">
                            {count === 0
                              ? `No ${label.toLowerCase()} incidents in this period.`
                              : activeSub
                                ? `No filed ${activeSub} reports — those come from daily tallies.`
                                : 'No individually filed reports — this count comes from daily tallies.'}
                          </p>
                        )}
                        {tallies > 0 && shown.length > 0 && !activeSub && (
                          <p className="text-xs text-gray-500">
                            + {tallies} more from Daily Report tallies, which have no individual record.
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* All filed reports that reached the provincial level */}
          {filedReports.length > 0 && (
            <div ref={filedReportsRef} className="scroll-mt-4">
              <h3 className="mb-2 flex items-center gap-1.5 font-bold text-bfp-navy">
                <FileSearch className="h-4 w-4" /> Filed Investigation Reports ({filedReports.length})
              </h3>
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                {filedReports.map((report) => (
                  <FiledReport key={report.id} report={report} onView={setViewReport} showCategory />
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
          <div ref={incidentsRef} className="scroll-mt-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 font-bold text-bfp-navy">
                <Flame className="h-4 w-4" /> Incident Records ({incidents === null ? '…' : shownIncidents.length})
              </h3>
              {periodIncidents.length > 0 && (
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show incidents">
                  {Object.entries(INCIDENT_VIEWS).map(([view, label]) => (
                    <button
                      key={view}
                      type="button"
                      aria-pressed={incidentView === view}
                      onClick={() => setIncidentView(view)}
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                        incidentView === view ? 'bg-bfp-navy text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {incidents === null ? (
              <p className="py-6 text-center text-sm text-gray-400">Loading incidents…</p>
            ) : incidentError ? (
              <p className="py-6 text-center text-sm text-red-600">{incidentError}</p>
            ) : shownIncidents.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-200 py-8 text-center">
                <Inbox className="h-6 w-6 text-gray-300" />
                <p className="text-sm text-gray-400">
                  {incidentView === 'casualties' && periodIncidents.length > 0
                    ? 'No incidents with injuries or deaths in this period.'
                    : 'No recorded incidents for this period.'}
                </p>
              </div>
            ) : (
              <>
                {/* Cards on phones, table from sm up */}
                <ul className="space-y-2 sm:hidden">
                  {shownIncidents.map((incident) => (
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
                      <p className="mt-1 text-xs text-gray-600">
                        Injured/deaths {incident.casualtiesInjured || 0}/{incident.casualtiesFatalities || 0} · Damage{' '}
                        {incident.estimatedDamage != null ? peso(incident.estimatedDamage) : '—'}
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
                      {shownIncidents.map((incident) => (
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
