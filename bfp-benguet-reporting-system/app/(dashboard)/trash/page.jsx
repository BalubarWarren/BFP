'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Trash2, ArchiveRestore, Paperclip } from 'lucide-react';
import PageHeader from '../../../components/common/PageHeader';
import TableSkeleton from '../../../components/common/TableSkeleton';
import SessionExpiredBanner from '../../../components/common/SessionExpiredBanner';
import ConfirmDeleteModal from '../../../components/reports/ConfirmDeleteModal';
import StatusBadge from '../../../components/common/StatusBadge';
import { useToast } from '../../../components/common/ToastProvider';
import { formatDateTime, isAuthError } from '../../../lib/utils';

const formatReportType = (type) =>
  type
    ?.replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || '-';

const daysLeft = (expiresAt) => Math.max(0, Math.ceil((new Date(expiresAt) - Date.now()) / (24 * 60 * 60 * 1000)));

const authHeaders = () => ({ Authorization: `Bearer ${sessionStorage.getItem('token')}` });

export default function TrashPage() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sessionExpired, setSessionExpired] = useState(false);
  const [busyId, setBusyId] = useState(null);
  // { item } for a single permanent delete, { all: true } for Empty Trash
  const [purgeTarget, setPurgeTarget] = useState(null);
  const [purging, setPurging] = useState(false);
  const [purgeError, setPurgeError] = useState('');

  useEffect(() => {
    fetchItems();
  }, []);

  const handleAuthError = (err) => {
    if (isAuthError(err)) {
      setSessionExpired(true);
      return true;
    }
    return false;
  };

  const fetchItems = async () => {
    try {
      setError('');
      const res = await axios.get('/api/trash', { headers: authHeaders() });
      setItems(res.data.items || []);
    } catch (err) {
      if (handleAuthError(err)) return;
      setError(err.response?.data?.error || 'Failed to load the Trash. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (item) => {
    setBusyId(item.id);
    try {
      await axios.post(`/api/trash/${item.id}/restore`, {}, { headers: authHeaders() });
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      toast.success(`${item.label} was restored.`);
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(err.response?.data?.error || 'Failed to restore this item.');
      if (err.response?.status === 404) fetchItems();
    } finally {
      setBusyId(null);
    }
  };

  const handlePurge = async () => {
    if (!purgeTarget) return;
    setPurging(true);
    setPurgeError('');
    try {
      if (purgeTarget.all) {
        const res = await axios.delete('/api/trash', { headers: authHeaders() });
        toast.success(`Trash emptied — ${res.data.count} item(s) permanently deleted.`);
      } else {
        await axios.delete(`/api/trash/${purgeTarget.item.id}`, { headers: authHeaders() });
        toast.success(`${purgeTarget.item.label} was permanently deleted.`);
      }
      setPurgeTarget(null);
      fetchItems();
    } catch (err) {
      if (handleAuthError(err)) return;
      setPurgeError(err.response?.data?.error || 'Failed to delete permanently.');
    } finally {
      setPurging(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <PageHeader
        icon={Trash2}
        eyebrow="Recycle Bin"
        title="Trash"
        description="Deleted reports are kept here for 30 days. Restore one to put it back exactly where it was."
      />

      {sessionExpired && <SessionExpiredBanner />}

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-200 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-bfp-navy">Deleted Reports ({items.length})</h2>
            <p className="text-sm text-gray-500">Items are permanently deleted, with their attachments, once their 30 days run out.</p>
          </div>
          <button
            type="button"
            onClick={() => setPurgeTarget({ all: true })}
            disabled={loading || !items.length}
            className="btn btn-danger flex items-center justify-center gap-2 px-4"
          >
            <Trash2 className="w-4 h-4" /> Empty Trash
          </button>
        </div>

        {loading ? (
          <TableSkeleton rows={5} columns={5} />
        ) : error ? (
          <div className="p-10 text-center text-sm text-red-700">{error}</div>
        ) : !items.length ? (
          <div className="flex min-h-56 flex-col items-center justify-center bg-gray-50 p-10 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
              <Trash2 className="w-7 h-7 text-gray-400" />
            </div>
            <p className="font-semibold text-bfp-navy">The Trash is empty</p>
            <p className="mt-1 text-sm text-gray-500">Reports you delete will show up here so you can recover them.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-3">Report</th>
                  <th className="px-5 py-3">Status When Deleted</th>
                  <th className="px-5 py-3">Deleted</th>
                  <th className="px-5 py-3">Auto-delete In</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => {
                  const remaining = daysLeft(item.expiresAt);
                  return (
                    <tr key={item.id} className="align-top">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-bfp-navy">{formatReportType(item.report?.reportType)}</p>
                        <p className="text-xs text-gray-500">{item.label}</p>
                        {item.referenceNumber && <p className="text-xs text-gray-500">Ref. {item.referenceNumber}</p>}
                        {item.ownerName && <p className="text-xs text-gray-500">Submitted by {item.ownerName}</p>}
                        {item.report?.attachmentCount > 0 && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                            <Paperclip className="w-3 h-3" /> {item.report.attachmentCount} attachment(s)
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4">{item.report?.status ? <StatusBadge status={item.report.status} /> : '—'}</td>
                      <td className="px-5 py-4">
                        <p>{formatDateTime(item.deletedAt)}</p>
                        {item.deletedByName && <p className="text-xs text-gray-500">by {item.deletedByName}</p>}
                      </td>
                      <td className="px-5 py-4">
                        <span className={remaining <= 3 ? 'font-semibold text-bfp-red' : 'text-gray-700'}>
                          {remaining === 0 ? 'Today' : `${remaining} day${remaining === 1 ? '' : 's'}`}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleRestore(item)}
                            disabled={busyId === item.id}
                            className="btn btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs"
                          >
                            <ArchiveRestore className="w-3.5 h-3.5" /> {busyId === item.id ? 'Restoring…' : 'Restore'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setPurgeTarget({ item })}
                            disabled={busyId === item.id}
                            className="btn btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs text-bfp-red"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete Forever
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {purgeTarget && (
        <ConfirmDeleteModal
          title={purgeTarget.all ? 'Empty Trash' : 'Delete Forever'}
          message={
            purgeTarget.all
              ? `Permanently delete all ${items.length} item(s) in the Trash, including their attachments? This cannot be undone.`
              : `Permanently delete "${purgeTarget.item.label}" and its attachments? This cannot be undone.`
          }
          loading={purging}
          error={purgeError}
          onConfirm={handlePurge}
          onCancel={() => {
            setPurgeTarget(null);
            setPurgeError('');
          }}
        />
      )}
    </div>
  );
}
