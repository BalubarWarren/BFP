'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { MapPin, User, Calendar, Tag, ChevronUp, ChevronDown, ClipboardList, Eye } from 'lucide-react';
import StatusBadge from '../../../components/common/StatusBadge';
import SessionExpiredBanner from '../../../components/common/SessionExpiredBanner';
import PageHeader from '../../../components/common/PageHeader';
import ConfirmDeleteModal from '../../../components/reports/ConfirmDeleteModal';
import WorkflowTracker, { ROLE_LABELS } from '../../../components/reports/WorkflowTracker';
import ReportDetailsModal from '../../../components/reports/ReportDetailsModal';
import ReportSearchFilters from '../../../components/reports/ReportSearchFilters';
import { EMPTY_REPORT_FILTERS, matchesReportFilters } from '../../../lib/report-search';
import { useToast } from '../../../components/common/ToastProvider';
import { formatDateTime, isAuthError } from '../../../lib/utils';

export default function AdminDashboard() {
  const toast = useToast();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterMunicipality, setFilterMunicipality] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchFilters, setSearchFilters] = useState(EMPTY_REPORT_FILTERS);
  const [viewTarget, setViewTarget] = useState(null);
  const [municipalities, setMunicipalities] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const pollRef = useRef(null);

  useEffect(() => {
    fetchAll();

    // Skip the tick while this tab isn't visible — the `focus` listener below already
    // re-fetches once the user comes back, so a background tab doesn't keep hitting the DB.
    pollRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') fetchAll({ silent: true });
    }, 15000);
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
      // Clear a previous failure message once a later refresh succeeds.
      setError('');
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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      const token = sessionStorage.getItem('token');
      await axios.delete(`/api/reports/${deleteTarget.id}`, { headers: { Authorization: `Bearer ${token}` } });
      setDeleteTarget(null);
      setExpandedId(null);
      toast.success('Report moved to Trash. You can restore it from the Trash page.');
      fetchAll({ silent: true });
    } catch (err) {
      setDeleteError(err.response?.data?.error || 'Failed to delete report.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const filtered = reports.filter((r) => {
    if (filterMunicipality && r.municipality?.name !== filterMunicipality) return false;
    if (filterType && r.reportType !== filterType) return false;
    if (filterStatus && r.status !== filterStatus) return false;
    return matchesReportFilters(r, searchFilters);
  });

  const statusCounts = reports.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  const fmtType = (t) =>
    t?.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) || '-';

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <PageHeader
        icon={ClipboardList}
        eyebrow="System Administrator"
        title="Report Tracking Dashboard"
        description="Full visibility of every report — from submission to final approval."
      />

      {sessionExpired && <SessionExpiredBanner />}

      {!sessionExpired && error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">{error}</div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:grid-cols-4">
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
      <div className="space-y-4 bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <ReportSearchFilters filters={searchFilters} onChange={setSearchFilters} showStatus={false} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
          <p className="text-xs text-gray-500 mt-0.5">Click a row for workflow progress, or View Details for the complete report</p>
        </div>

        {loading ? (
          <div className="animate-pulse divide-y divide-gray-100">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2 px-5 py-4">
                <div className="h-4 w-1/3 rounded bg-gray-200" />
                <div className="h-3 w-2/3 rounded bg-gray-100" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-gray-500">No reports match your filters.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((report, index) => (
              <div
                key={report.id}
                className="row-fade-in hover:bg-gray-50 transition-colors"
                style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
              >
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
                  <div className="flex items-center justify-between gap-3 flex-shrink-0 sm:justify-end">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewTarget(report);
                      }}
                      className="btn btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs order-last sm:order-none"
                    >
                      <Eye className="w-3.5 h-3.5" /> View Details
                    </button>
                    <div className="text-left text-xs text-gray-400 sm:text-right">
                      <div>Submitted {formatDateTime(report.submittedAt)}</div>
                      {report.reviewedAt && <div className="text-green-600">Reviewed {formatDateTime(report.reviewedAt)}</div>}
                    </div>
                    <span className="text-gray-400">{expandedId === report.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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

                    <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-gray-200 pt-4">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewTarget(report);
                        }}
                        className="btn btn-primary flex items-center gap-1.5 text-sm py-1 px-3"
                      >
                        <Eye className="w-4 h-4" /> View Details
                      </button>
                    {!report.isDemo && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(report);
                          }}
                          className="btn btn-danger text-sm py-1 px-3"
                        >
                          Delete Report
                        </button>
                    )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {viewTarget && (
        <ReportDetailsModal report={viewTarget} onClose={() => setViewTarget(null)} showHistory />
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          message={`Delete this ${fmtType(deleteTarget.reportType)} report submitted by ${deleteTarget.submittedBy?.name || 'this user'}? It will be moved to the Trash, where it can be restored within 30 days.`}
          loading={deleteLoading}
          error={deleteError}
          onConfirm={handleDelete}
          onCancel={() => {
            setDeleteTarget(null);
            setDeleteError('');
          }}
        />
      )}
    </div>
  );
}
