'use client';

import { useState } from 'react';
import axios from 'axios';
import { FolderArchive, Eye, PencilLine } from 'lucide-react';
import ReportDetailsModal from './ReportDetailsModal';
import { formatDateTime, parseJsonField } from '../../lib/utils';

// Shown in a report's view when it has been returned and revised: the investigator's notes on
// what they changed, and each earlier version (kept in the Report Archive) with the remarks it
// was returned with. "View" opens that version read-only, files and reviewer comments included.
// `report` must be the full record from GET /api/reports/:id (it carries `archivedVersions`).
export default function RevisionHistory({ report }) {
  const [opening, setOpening] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [error, setError] = useState('');

  const versions = report?.archivedVersions || [];
  if (!versions.length) return null;

  const notes = parseJsonField(report.content, {}).corrections;

  const open = async (version) => {
    setOpening(version.id);
    setError('');
    try {
      const res = await axios.get(`/api/archive/${version.id}`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
      });
      setViewing({ version, report: { ...res.data.report, isArchived: true } });
    } catch (err) {
      setError(err.response?.data?.error || 'Could not open that version.');
    } finally {
      setOpening(null);
    }
  };

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900 dark:bg-amber-950/20">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
        <FolderArchive className="h-4 w-4 text-amber-600" />
        Revised {versions.length} time{versions.length === 1 ? '' : 's'}
      </p>

      {notes && (
        <div className="mt-3 rounded-md bg-white p-3 text-sm ring-1 ring-inset ring-amber-200 dark:bg-gray-900 dark:ring-amber-900">
          <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
            <PencilLine className="h-3.5 w-3.5" /> Investigator&apos;s notes on the latest revision
          </p>
          <p className="mt-1 whitespace-pre-wrap text-gray-800">{notes}</p>
        </div>
      )}

      <ol className="mt-3 space-y-2">
        {versions.map((version) => (
          <li
            key={version.id}
            className="flex flex-col gap-2 rounded-md bg-white p-3 ring-1 ring-inset ring-gray-200 sm:flex-row sm:items-center sm:justify-between dark:bg-gray-900 dark:ring-gray-800"
          >
            <div className="min-w-0 text-sm">
              <p className="font-medium text-gray-900">
                Version {version.version ?? '?'}
                <span className="font-normal text-gray-500"> · replaced {formatDateTime(version.archivedAt)}</span>
              </p>
              {version.remarks && (
                <p className="mt-0.5 line-clamp-2 text-xs text-red-700" title={version.remarks}>
                  Returned with: {version.remarks}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => open(version)}
              disabled={opening === version.id}
              className="btn btn-secondary flex-shrink-0 px-2.5 py-1.5 text-xs"
            >
              <Eye className="h-3.5 w-3.5" /> {opening === version.id ? 'Opening…' : 'View'}
            </button>
          </li>
        ))}
      </ol>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {/* ReportDetailsModal portals itself to <body>, after the window this panel sits in, so it opens on top. */}
      {viewing && (
        <ReportDetailsModal
          report={viewing.report}
          notice={`Earlier version ${viewing.version.version ?? '?'} of report #${report.id}, as it was before it was revised on ${formatDateTime(viewing.version.archivedAt)}. Read-only.`}
          onClose={() => setViewing(null)}
        />
      )}
    </section>
  );
}
