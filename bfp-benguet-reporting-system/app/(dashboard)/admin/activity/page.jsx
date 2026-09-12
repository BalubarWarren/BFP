'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { History, CheckCircle2, Undo2, MessageSquare } from 'lucide-react';
import SessionExpiredBanner from '../../../../components/common/SessionExpiredBanner';
import PageHeader from '../../../../components/common/PageHeader';
import TableSkeleton from '../../../../components/common/TableSkeleton';
import { formatDateTime, isAuthError, parseJsonField } from '../../../../lib/utils';

const ACTION_META = {
  APPROVE_REPORT: { label: 'Approved', icon: CheckCircle2, className: 'bg-bfp-green/15 text-bfp-green' },
  RETURN_REPORT: { label: 'Returned', icon: Undo2, className: 'bg-bfp-red/10 text-bfp-red' },
  TEXT_BLAST_REPORT: { label: 'Text Blast', icon: MessageSquare, className: 'bg-bfp-navy/10 text-bfp-navy' },
};

const formatReportType = (type) =>
  type
    ?.replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || '-';

const describeChanges = (entry) => {
  const changes = parseJsonField(entry.changes, {});
  if (entry.action === 'APPROVE_REPORT' || entry.action === 'RETURN_REPORT') {
    return changes.remarks ? `"${changes.remarks}"` : '—';
  }
  if (entry.action === 'TEXT_BLAST_REPORT') {
    return `Sent to ${changes.recipientCount ?? '?'} recipient(s), ${changes.newlySentCount ?? '?'} newly notified`;
  }
  return '—';
};

export default function ActivityLogPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('');
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    fetchEntries();
  }, [filterAction]);

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const token = sessionStorage.getItem('token');
      const params = new URLSearchParams();
      if (filterAction) params.append('action', filterAction);
      const res = await axios.get(`/api/audit-log?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setEntries(res.data.entries || []);
    } catch (err) {
      if (isAuthError(err)) {
        setSessionExpired(true);
        return;
      }
      console.error('Failed to load activity log:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        icon={History}
        eyebrow="System Administrator"
        title="Activity Log"
        description="Every report approval, return, and text blast, in one place."
      />

      {sessionExpired && <SessionExpiredBanner />}

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-200 p-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-bfp-navy">Recent Activity ({entries.length})</h2>
            <p className="text-sm text-gray-500">Most recent 200 actions across the whole system.</p>
          </div>
          <div className="w-full md:w-64">
            <label className="form-label">Action</label>
            <select
              className="form-select"
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
            >
              <option value="">All Actions</option>
              <option value="APPROVE_REPORT">Approved</option>
              <option value="RETURN_REPORT">Returned</option>
              <option value="TEXT_BLAST_REPORT">Text Blast</option>
            </select>
          </div>
        </div>

        {loading ? (
          <TableSkeleton rows={8} columns={5} />
        ) : entries.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center bg-gray-50 p-10 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
              <History className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-lg font-semibold text-bfp-navy">No activity found</p>
            <p className="mt-1 text-sm text-gray-500">
              {filterAction ? 'No actions match the selected filter.' : 'Activity will appear here as reports are reviewed.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-gray-50">
                <tr className="border-b border-gray-200">
                  <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">When</th>
                  <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">Action</th>
                  <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">Actor</th>
                  <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">Report</th>
                  <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {entries.map((entry, index) => {
                  const meta = ACTION_META[entry.action] || { label: entry.action, icon: History, className: 'bg-gray-100 text-gray-800' };
                  const Icon = meta.icon;
                  return (
                    <tr
                      key={entry.id}
                      className="row-fade-in hover:bg-gray-50"
                      style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
                    >
                      <td className="px-5 py-4 text-sm text-gray-600 whitespace-nowrap">{formatDateTime(entry.createdAt)}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${meta.className}`}>
                          <Icon className="w-3.5 h-3.5" /> {meta.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm">
                        <p className="font-semibold text-gray-900">{entry.actor?.name || 'Unknown user'}</p>
                        <p className="text-xs text-gray-500">{entry.actor?.role?.replace(/_/g, ' ') || '—'}</p>
                      </td>
                      <td className="px-5 py-4 text-sm">
                        {entry.report ? (
                          <>
                            <p className="font-semibold text-gray-900">{formatReportType(entry.report.reportType)}</p>
                            <p className="text-xs text-gray-500">
                              {entry.report.incident?.referenceNumber || `#${entry.report.id}`} · {entry.report.municipality?.name}
                            </p>
                          </>
                        ) : (
                          <p className="text-xs italic text-gray-400">Report no longer exists</p>
                        )}
                      </td>
                      <td className="px-5 py-4 max-w-xs truncate text-sm text-gray-600" title={describeChanges(entry)}>
                        {describeChanges(entry)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
