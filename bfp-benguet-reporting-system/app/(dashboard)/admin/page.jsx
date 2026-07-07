'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Undo2, Check, CheckCircle2, MapPin, User, Calendar, Tag } from 'lucide-react';
import StatusBadge from '@/components/common/StatusBadge';
import SessionExpiredBanner from '@/components/common/SessionExpiredBanner';
import { formatDateTime, isAuthError } from '@/lib/utils';

const ROLE_LABELS = {
  INVESTIGATOR: 'Investigator',
  MUNICIPAL_CHIEF_IIS: 'Municipal Chief IIS',
  MUNICIPAL_CHIEF_OPERATION: 'Municipal Chief Operation',
  MUNICIPAL_FIRE_MARSHAL: 'Municipal Fire Marshal',
  PROVINCIAL_CHIEF_IIS: 'Provincial Chief IIS',
  MARSHAL: 'Marshal',
  SUPER_ADMIN: 'Admin',
  ADMIN: 'Admin',
};

const WORKFLOW_STEPS = {
  MDFIR: ['INVESTIGATOR', 'MUNICIPAL_CHIEF_IIS', 'MUNICIPAL_FIRE_MARSHAL', 'PROVINCIAL_CHIEF_IIS'],
  SPOT_INVESTIGATION: ['INVESTIGATOR', 'MUNICIPAL_CHIEF_IIS', 'MUNICIPAL_FIRE_MARSHAL', 'PROVINCIAL_CHIEF_IIS'],
  PROGRESS_INVESTIGATION: ['INVESTIGATOR', 'MUNICIPAL_CHIEF_OPERATION', 'PROVINCIAL_CHIEF_IIS'],
  FINAL_INVESTIGATION: ['INVESTIGATOR', 'MUNICIPAL_CHIEF_IIS', 'PROVINCIAL_CHIEF_IIS'],
};

function WorkflowTracker({ report }) {
  const steps = WORKFLOW_STEPS[report.reportType] || ['INVESTIGATOR', 'PROVINCIAL_CHIEF_IIS'];

  const getCurrentStep = () => {
    if (report.status === 'APPROVED') return steps.length;
    if (report.status === 'RETURNED') return 0;
    const passedToRole = report.passedToRole;
    if (!passedToRole) return steps.length;
    const idx = steps.indexOf(passedToRole);
    return idx >= 0 ? idx : 1;
  };

  const currentStep = getCurrentStep();

  return (
    <div className="mt-3">
      <div className="flex items-center gap-0">
        {steps.map((step, idx) => {
          const isDone = idx < currentStep || report.status === 'APPROVED';
          const isCurrent = idx === currentStep && report.status !== 'APPROVED' && report.status !== 'RETURNED';
          const isReturned = report.status === 'RETURNED' && idx === 0;
          return (
            <div key={step} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                    ${isReturned ? 'bg-red-500 text-white' :
                      isDone ? 'bg-green-500 text-white' :
                      isCurrent ? 'bg-bfp-navy text-white ring-2 ring-bfp-gold' :
                      'bg-gray-200 text-gray-500'}`}
                >
                  {isReturned ? <Undo2 className="w-3.5 h-3.5" /> : isDone ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                </div>
                <p className="text-[10px] text-center text-gray-500 mt-1 w-16 leading-tight truncate" title={ROLE_LABELS[step]}>
                  {ROLE_LABELS[step]}
                </p>
              </div>
              {idx < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 ${idx < currentStep || report.status === 'APPROVED' ? 'bg-green-400' : 'bg-gray-200'}`} />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-xs text-gray-500">Currently with:</span>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-bfp-navy">
          {report.status === 'APPROVED' ? (
            <><CheckCircle2 className="w-3.5 h-3.5" /> Approved — Filed</>
          ) : report.status === 'RETURNED' ? (
            <><Undo2 className="w-3.5 h-3.5" /> Returned to {ROLE_LABELS[report.submittedBy?.role] || 'Investigator'}</>
          ) : (
            report.passedTo?.name || ROLE_LABELS[report.passedToRole] || 'In Review'
          )}
        </span>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterMunicipality, setFilterMunicipality] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [municipalities, setMunicipalities] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    fetchAll();

    pollRef.current = setInterval(() => fetchAll({ silent: true }), 15000);
    const onFocus = () => fetchAll({ silent: true });
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(pollRef.current);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const fetchAll = async ({ silent } = {}) => {
    try {
      if (!silent) setLoading(true);
      const token = sessionStorage.getItem('token');
      const [rRes, mRes] = await Promise.all([
        axios.get('/api/reports?view=all', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/municipalities', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setReports(rRes.data.reports || []);
      setMunicipalities(mRes.data.municipalities || []);
    } catch (err) {
      if (isAuthError(err)) {
        clearInterval(pollRef.current);
        setSessionExpired(true);
        return;
      }
      if (!silent) {
        setError('Failed to load report data');
        console.error(err);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const filtered = reports.filter((r) => {
    if (filterMunicipality && r.municipality?.name !== filterMunicipality) return false;
    if (filterType && r.reportType !== filterType) return false;
    if (filterStatus && r.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.municipality?.name?.toLowerCase().includes(q) ||
        r.reportType?.toLowerCase().includes(q) ||
        r.submittedBy?.name?.toLowerCase().includes(q) ||
        r.incident?.referenceNumber?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const statusCounts = reports.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  const fmtType = (t) =>
    t?.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) || '-';

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-bfp-red">System Administrator</p>
        <h1 className="text-3xl font-bold text-bfp-navy">Report Tracking Dashboard</h1>
        <p className="text-gray-500 mt-1">Full visibility of every report — from submission to final approval.</p>
      </div>

      {sessionExpired && <SessionExpiredBanner />}

      {!sessionExpired && error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">{error}</div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ['Total Reports', reports.length, 'border-bfp-navy', 'text-bfp-navy'],
          ['Pending Review', statusCounts.SUBMITTED || 0, 'border-bfp-amber', 'text-bfp-amber'],
          ['Approved', statusCounts.APPROVED || 0, 'border-green-500', 'text-green-600'],
          ['Returned', statusCounts.RETURNED || 0, 'border-red-500', 'text-red-600'],
        ].map(([label, val, border, text]) => (
          <div key={label} className={`bg-white rounded-lg border-l-4 ${border} p-4 shadow-sm`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${text}`}>{val}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="form-label text-xs">Search</label>
            <input
              type="text"
              className="form-input"
              placeholder="Name, type, reference…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label text-xs">Municipality</label>
            <select className="form-select" value={filterMunicipality} onChange={(e) => setFilterMunicipality(e.target.value)}>
              <option value="">All Municipalities</option>
              {municipalities.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label text-xs">Report Type</label>
            <select className="form-select" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="">All Types</option>
              <option value="MDFIR">MDFIR</option>
              <option value="SPOT_INVESTIGATION">Spot Investigation</option>
              <option value="PROGRESS_INVESTIGATION">Progress Investigation</option>
              <option value="FINAL_INVESTIGATION">Final Investigation</option>
            </select>
          </div>
          <div>
            <label className="form-label text-xs">Status</label>
            <select className="form-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="APPROVED">Approved</option>
              <option value="RETURNED">Returned</option>
              <option value="DRAFT">Draft</option>
            </select>
          </div>
        </div>
      </div>

      {/* Report Tracking Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="font-bold text-bfp-navy text-lg">All Reports ({filtered.length})</h2>
          <p className="text-xs text-gray-500 mt-0.5">Click a row to see full workflow progress</p>
        </div>

        {loading ? (
          <div className="p-10 text-center text-gray-500">Loading reports…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-gray-500">No reports match your filters.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((report) => (
              <div key={report.id} className="hover:bg-gray-50 transition-colors">
                {/* Summary row */}
                <div
                  className="flex flex-col gap-2 px-5 py-4 cursor-pointer sm:flex-row sm:items-center sm:justify-between"
                  onClick={() => setExpandedId(expandedId === report.id ? null : report.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-gray-900">{fmtType(report.reportType)}</span>
                      <StatusBadge status={report.status} />
                      {report.isDemo && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded font-semibold">DEMO</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {report.municipality?.name}</span>
                      <span className="inline-flex items-center gap-1"><User className="w-3 h-3" /> {report.submittedBy?.name}</span>
                      <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(report.reportDate).toLocaleDateString()}</span>
                      {report.incident?.referenceNumber && (
                        <span className="inline-flex items-center gap-1"><Tag className="w-3 h-3" /> {report.incident.referenceNumber}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right text-xs text-gray-400">
                      <div>Submitted {formatDateTime(report.submittedAt)}</div>
                      {report.reviewedAt && <div className="text-green-600">Reviewed {formatDateTime(report.reviewedAt)}</div>}
                    </div>
                    <span className="text-gray-400 text-sm">{expandedId === report.id ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Expanded workflow */}
                {expandedId === report.id && (
                  <div className="px-5 pb-5 border-t border-gray-100 bg-gray-50">
                    <div className="grid grid-cols-1 gap-5 pt-4 md:grid-cols-2">
                      {/* Workflow tracker */}
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Workflow Progress</p>
                        <WorkflowTracker report={report} />
                      </div>

                      {/* Details */}
                      <div className="space-y-2 text-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Details</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-gray-400 text-xs">Submitted By</p>
                            <p className="font-semibold">{report.submittedBy?.name || '—'}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-xs">Submitted To</p>
                            <p className="font-semibold">{ROLE_LABELS[report.passedToRole] || '—'}</p>
                          </div>
                          {report.reviewedBy && (
                            <>
                              <div>
                                <p className="text-gray-400 text-xs">Reviewed By</p>
                                <p className="font-semibold">{report.reviewedBy?.name || '—'}</p>
                              </div>
                              <div>
                                <p className="text-gray-400 text-xs">Reviewed At</p>
                                <p className="font-semibold">{report.reviewedAt ? formatDateTime(report.reviewedAt) : '—'}</p>
                              </div>
                            </>
                          )}
                          {report.remarks && (
                            <div className="col-span-2">
                              <p className="text-gray-400 text-xs">Remarks</p>
                              <p className="font-semibold text-red-700 text-xs">{report.remarks}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
