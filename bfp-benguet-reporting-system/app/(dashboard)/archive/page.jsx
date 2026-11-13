'use client';

import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { FolderArchive, Eye, Paperclip, Search } from 'lucide-react';
import PageHeader from '../../../components/common/PageHeader';
import TableSkeleton from '../../../components/common/TableSkeleton';
import SessionExpiredBanner from '../../../components/common/SessionExpiredBanner';
import StatusBadge from '../../../components/common/StatusBadge';
import ReportDetailsModal from '../../../components/reports/ReportDetailsModal';
import { useToast } from '../../../components/common/ToastProvider';
import { formatDateTime, isAuthError } from '../../../lib/utils';

const formatReportType = (type) =>
  type
    ?.replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || '-';

const authHeaders = () => ({ Authorization: `Bearer ${sessionStorage.getItem('token')}` });

// Read-only list of earlier report versions. Nothing here can be edited, restored or deleted.
export default function ArchivePage() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sessionExpired, setSessionExpired] = useState(false);
  const [query, setQuery] = useState('');
  const [openingId, setOpeningId] = useState(null);
  const [viewing, setViewing] = useState(null); // { item, report }

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get('/api/archive', { headers: authHeaders() });
        setItems(res.data.items || []);
      } catch (err) {
        if (isAuthError(err)) setSessionExpired(true);
        else setError(err.response?.data?.error || 'Failed to load the archive. Please try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      [item.label, item.referenceNumber, item.ownerName, item.archivedByName, formatReportType(item.report?.reportType), `#${item.originalId}`]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [items, query]);

  const openItem = async (item) => {
    setOpeningId(item.id);
    try {
      const res = await axios.get(`/api/archive/${item.id}`, { headers: authHeaders() });
      setViewing({ item, report: { ...res.data.report, isArchived: true } });
    } catch (err) {
      if (isAuthError(err)) setSessionExpired(true);
      else toast.error(err.response?.data?.error || 'Failed to open this archived report.');
    } finally {
      setOpeningId(null);
    }
  };

  const noticeFor = (item) =>
    item.kind === 'VERSION'
      ? `Archived copy: version ${item.version ?? '?'} of report #${item.originalId}, saved on ${formatDateTime(item.archivedAt)} when it was revised${item.archivedByName ? ` by ${item.archivedByName}` : ''}. The current version is in the reports list. This copy is read-only.`
      : `Archived copy of report #${item.originalId}, removed from the active list on ${formatDateTime(item.archivedAt)}${item.archivedByName ? ` by ${item.archivedByName}` : ''}. This copy is read-only.`;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <PageHeader
        icon={FolderArchive}
        eyebrow="Records"
        title="Report Archive"
        description="Reports are never deleted. When a returned report is revised, the version that was returned is kept here, with the reviewer's remarks, for the record."
      />

      {sessionExpired && <SessionExpiredBanner />}

      <div className="card overflow-hidden p-0">
        <div className="flex flex-col gap-3 border-b border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-gray-900">Archived versions</h2>
            <p className="text-sm text-gray-500">{items.length} item{items.length === 1 ? '' : 's'} on file</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search report, reference, name"
              className="form-input pl-9"
              aria-label="Search the archive"
            />
          </div>
        </div>

        {loading ? (
          <TableSkeleton rows={5} columns={5} />
        ) : error ? (
          <div className="p-10 text-center text-sm text-red-700">{error}</div>
        ) : !filtered.length ? (
          <div className="flex min-h-56 flex-col items-center justify-center p-10 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <FolderArchive className="h-6 w-6 text-gray-400" />
            </div>
            <p className="font-medium text-gray-900">{items.length ? 'No matches' : 'The archive is empty'}</p>
            <p className="mt-1 max-w-sm text-sm text-gray-500">
              {items.length
                ? 'Try a different search.'
                : 'When a returned report is revised and resubmitted, its earlier version will be kept here.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Report</th>
                  <th>Version</th>
                  <th>Status at the time</th>
                  <th>Archived</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} className="align-top">
                    <td>
                      <p className="font-medium text-gray-900">{formatReportType(item.report?.reportType)}</p>
                      <p className="text-xs text-gray-500">#{item.originalId} · {item.label}</p>
                      {item.referenceNumber && <p className="text-xs text-gray-500">Ref. {item.referenceNumber}</p>}
                      {item.ownerName && <p className="text-xs text-gray-500">Submitted by {item.ownerName}</p>}
                      {item.report?.attachmentCount > 0 && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                          <Paperclip className="h-3 w-3" /> {item.report.attachmentCount} attachment(s)
                        </p>
                      )}
                    </td>
                    <td>
                      {item.kind === 'VERSION' ? (
                        <span className="badge bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200">Version {item.version ?? '?'}</span>
                      ) : (
                        <span className="badge bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-200">Removed report</span>
                      )}
                    </td>
                    <td>
                      {item.report?.status ? <StatusBadge status={item.report.status} /> : '—'}
                      {item.report?.remarks && (
                        <p className="mt-1.5 max-w-xs text-xs text-red-700 line-clamp-2" title={item.report.remarks}>
                          Remarks: {item.report.remarks}
                        </p>
                      )}
                    </td>
                    <td>
                      <p className="text-sm">{formatDateTime(item.archivedAt)}</p>
                      {item.archivedByName && <p className="text-xs text-gray-500">by {item.archivedByName}</p>}
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => openItem(item)}
                        disabled={openingId === item.id}
                        className="btn btn-secondary px-3 py-1.5 text-xs"
                      >
                        <Eye className="h-3.5 w-3.5" /> {openingId === item.id ? 'Opening…' : 'View'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewing && (
        <ReportDetailsModal report={viewing.report} notice={noticeFor(viewing.item)} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}
