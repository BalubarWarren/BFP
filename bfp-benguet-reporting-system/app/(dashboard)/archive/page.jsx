'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { FolderArchive, FileCheck2, CalendarCheck, MapPin, QrCode, Eye } from 'lucide-react';
import PageHeader from '../../../components/common/PageHeader';
import SessionExpiredBanner from '../../../components/common/SessionExpiredBanner';
import TableSkeleton from '../../../components/common/TableSkeleton';
import ReportSearchFilters from '../../../components/reports/ReportSearchFilters';
import { EMPTY_REPORT_FILTERS, matchesReportFilters } from '../../../lib/report-search';
import ReportQrModal from '../../../components/reports/ReportQrModal';
import ReportDetailsModal from '../../../components/reports/ReportDetailsModal';
import { useToast } from '../../../components/common/ToastProvider';
import { formatDateTime, isAuthError } from '../../../lib/utils';
import { canViewApprovedReports } from '../../../lib/constants';
import CasualtyBoard from '../../../components/reports/CasualtyBoard';

// The Archive: finished reports — every report that has cleared final approval by the Provincial
// Chief IIS. Investigators see their own (and the ones they co-investigate), municipal reviewers
// their municipality's, provincial reviewers and admins all of them (GET /api/reports?view=approved).
// Strictly read-only: a finished report is the official record. Earlier versions of a revised
// report, and the files a revision replaced, are shown in its details under Revision history.
const REPORT_TYPE_LABELS = {
  MDFIR: 'MDFIR',
  SPOT_INVESTIGATION: 'Spot Investigation',
  PROGRESS_INVESTIGATION: 'Progress Investigation',
  FINAL_INVESTIGATION: 'Final Investigation',
  DAILY: 'Daily Report',
};

const formatReportType = (type) => REPORT_TYPE_LABELS[type] || (type || '').replace(/_/g, ' ');

const ALL_MUNICIPALITY_ROLES = ['PROVINCIAL_CHIEF_IIS', 'MARSHAL', 'CHIEF_INVESTIGATOR_IIS', 'ADMIN', 'SUPER_ADMIN'];

export default function ArchivePage() {
  const toast = useToast();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sessionExpired, setSessionExpired] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [searchFilters, setSearchFilters] = useState(EMPTY_REPORT_FILTERS);
  const [typeFilter, setTypeFilter] = useState('');
  const [municipalityFilter, setMunicipalityFilter] = useState('');
  const [viewing, setViewing] = useState(null);
  const [qrTarget, setQrTarget] = useState(null);
  const [qrLoadingId, setQrLoadingId] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    try {
      const storedUser = sessionStorage.getItem('user');
      if (storedUser) setCurrentUser(JSON.parse(storedUser));
    } catch {
      setCurrentUser(null);
    }

    fetchReports();

    // Same cadence as the other dashboards, skipped while the tab is hidden.
    pollRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') fetchReports({ silent: true });
    }, 15000);
    const onFocus = () => fetchReports({ silent: true });
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(pollRef.current);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const fetchReports = async ({ silent } = {}) => {
    try {
      if (!silent) setLoading(true);
      const res = await axios.get('/api/reports?view=approved', {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
      });
      setReports(res.data.reports || []);
      setError('');
    } catch (err) {
      if (isAuthError(err)) {
        clearInterval(pollRef.current);
        setSessionExpired(true);
        return;
      }
      if (!silent) setError('Failed to load the Archive. Please try again.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Most reports already carry a qrToken; one from before QR codes existed gets it minted here.
  const openQr = async (report) => {
    if (report.qrToken) {
      setQrTarget(report);
      return;
    }
    setQrLoadingId(report.id);
    try {
      const res = await axios.post(
        `/api/reports/${report.id}/qr`,
        {},
        { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } }
      );
      const updatedReport = { ...report, qrToken: res.data.qrToken };
      setReports((prev) => prev.map((r) => (r.id === report.id ? updatedReport : r)));
      setQrTarget(updatedReport);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate QR code');
    } finally {
      setQrLoadingId(null);
    }
  };

  const municipalities = useMemo(() => {
    const names = new Set(reports.map((r) => r.municipality?.name).filter(Boolean));
    return [...names].sort();
  }, [reports]);

  const reportTypes = useMemo(() => {
    const types = new Set(reports.map((r) => r.reportType).filter(Boolean));
    return [...types].sort();
  }, [reports]);

  const filteredReports = useMemo(
    () =>
      reports.filter((report) => {
        if (!matchesReportFilters(report, searchFilters)) return false;
        if (typeFilter && report.reportType !== typeFilter) return false;
        if (municipalityFilter && report.municipality?.name !== municipalityFilter) return false;
        return true;
      }),
    [reports, searchFilters, typeFilter, municipalityFilter]
  );

  const finalizedThisMonth = useMemo(() => {
    const now = new Date();
    return reports.filter((report) => {
      if (!report.reviewedAt) return false;
      const reviewed = new Date(report.reviewedAt);
      return reviewed.getMonth() === now.getMonth() && reviewed.getFullYear() === now.getFullYear();
    }).length;
  }, [reports]);

  const role = currentUser?.role;
  const isInvestigator = role === 'INVESTIGATOR';
  const seesAllMunicipalities = ALL_MUNICIPALITY_ROLES.includes(role);
  const scopeNote = isInvestigator
    ? 'Your reports, including ones you co-investigate.'
    : seesAllMunicipalities
      ? 'All thirteen municipalities of Benguet.'
      : `${currentUser?.municipality?.name || 'Your municipality'} only.`;
  // The casualty board's API is limited to reviewers and admins.
  const showCasualtyBoard = !!role && (canViewApprovedReports(role) || role === 'ADMIN' || role === 'SUPER_ADMIN');

  const stats = [
    { label: 'Finished Reports', value: reports.length, icon: FileCheck2 },
    { label: 'Finalized This Month', value: finalizedThisMonth, icon: CalendarCheck },
    ...(seesAllMunicipalities ? [{ label: 'Municipalities', value: municipalities.length, icon: MapPin }] : []),
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8">
      <PageHeader
        icon={FolderArchive}
        eyebrow="Records"
        title="Archive"
        description={`Finished reports that have received final approval from the Provincial Chief IIS. Read-only. ${scopeNote}`}
      />

      {sessionExpired && <SessionExpiredBanner />}

      {!sessionExpired && error && <div className="alert alert-error">{error}</div>}

      <div className={`grid grid-cols-1 gap-4 ${stats.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex items-center gap-4 rounded-lg bg-white p-5 shadow-md">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-bfp-navy/10 text-bfp-navy">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
              <p className="text-2xl font-semibold tracking-tight text-gray-900">{loading ? '—' : value}</p>
            </div>
          </div>
        ))}
      </div>

      {!sessionExpired && showCasualtyBoard && <CasualtyBoard />}

      <ReportSearchFilters filters={searchFilters} onChange={setSearchFilters} showStatus={false} />

      <div className="flex flex-wrap gap-4">
        <div className="min-w-[12rem]">
          <label className="form-label">Report Type</label>
          <select className="form-input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            {reportTypes.map((type) => (
              <option key={type} value={type}>{formatReportType(type)}</option>
            ))}
          </select>
        </div>
        {municipalities.length > 1 && (
          <div className="min-w-[12rem]">
            <label className="form-label">Municipality</label>
            <select className="form-input" value={municipalityFilter} onChange={(e) => setMunicipalityFilter(e.target.value)}>
              <option value="">All municipalities</option>
              {municipalities.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <section className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-gray-900 mb-4">
          <FolderArchive className="w-5 h-5" /> Finished Reports
          {!loading && filteredReports.length > 0 && (
            <span className="text-sm font-normal text-gray-500">({filteredReports.length})</span>
          )}
        </h2>

        {loading ? (
          <TableSkeleton rows={5} columns={8} />
        ) : filteredReports.length === 0 ? (
          <p className="text-gray-500">
            {reports.length === 0
              ? 'No finished reports yet. A report moves here once the Provincial Chief IIS gives it final approval.'
              : 'No finished reports match these filters.'}
          </p>
        ) : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="data-table !overflow-visible [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-gray-50 dark:[&_th]:bg-gray-900">
              <thead>
                <tr>
                  <th>Reference #</th>
                  <th>Type</th>
                  <th>Municipality</th>
                  <th>Report Date</th>
                  <th>Submitted By</th>
                  <th>Approved By</th>
                  <th>Finalized</th>
                  <th>QR Code</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map((report, index) => (
                  <tr key={report.id} className="row-fade-in" style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}>
                    <td className="font-semibold whitespace-nowrap">{report.incident?.referenceNumber || '-'}</td>
                    <td>{formatReportType(report.reportType)}</td>
                    <td>{report.municipality?.name || '-'}</td>
                    <td>{new Date(report.reportDate).toLocaleDateString()}</td>
                    <td>{report.submittedBy?.name || '-'}</td>
                    <td>{report.reviewedBy?.name || 'Provincial Chief IIS'}</td>
                    <td className="text-sm text-gray-500">{report.reviewedAt ? formatDateTime(report.reviewedAt) : '-'}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => openQr(report)}
                        disabled={qrLoadingId === report.id}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium text-bfp-navy hover:underline disabled:opacity-50 dark:text-blue-400"
                      >
                        <QrCode className="w-4 h-4" /> {qrLoadingId === report.id ? 'Generating…' : 'QR Code'}
                      </button>
                    </td>
                    <td>
                      <button type="button" onClick={() => setViewing(report)} className="btn btn-primary inline-flex items-center gap-1.5 py-1 px-3 text-sm">
                        <Eye className="h-3.5 w-3.5" /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Full read-only view: progress, case links, Revision history (with replaced files), files, QR. */}
      {viewing && <ReportDetailsModal report={viewing} onClose={() => setViewing(null)} />}

      {qrTarget && <ReportQrModal report={qrTarget} onClose={() => setQrTarget(null)} />}
    </div>
  );
}
