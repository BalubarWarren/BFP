'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import axios from 'axios';
import {
  FileEdit, FileText, File as FileIcon, MessageSquare, Upload, Undo2, RotateCcw, Trash2, Plus, FolderArchive, Send, AlertTriangle,
} from 'lucide-react';
import StatusBadge from '../../../../../../components/common/StatusBadge';
import BackButton from '../../../../../../components/common/BackButton';
import PageHeader from '../../../../../../components/common/PageHeader';
import CaseChain from '../../../../../../components/reports/CaseChain';
import { getFileIssue } from '../../../../../../components/reports/AttachmentInput';
import { uploadDirect } from '../../../../../../lib/submit-report';
import { formatDateTime, parseJsonField } from '../../../../../../lib/utils';

const PdfAnnotator = dynamic(() => import('../../../../../../components/reports/PdfAnnotator'), { ssr: false });

const ROLE_LABELS = {
  MUNICIPAL_CHIEF_IIS: 'Municipal Chief IIS',
  MUNICIPAL_CHIEF_OPERATION: 'Municipal Chief Operation',
  MUNICIPAL_FIRE_MARSHAL: 'Municipal Fire Marshal',
  PROVINCIAL_CHIEF_IIS: 'Provincial Chief IIS',
};
const roleLabel = (role) => ROLE_LABELS[role] || role?.replace(/_/g, ' ') || 'the reviewer';
const humanize = (value) => String(value || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const isPdf = (file) => file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');
const ACCEPT = '.jpg,.jpeg,.png,.webp,.gif,.heic,.pdf,image/jpeg,image/png,image/webp,image/gif,image/heic,application/pdf';
const MAX_ATTACHMENTS = 10;
const authHeaders = () => ({ Authorization: `Bearer ${sessionStorage.getItem('token')}` });

// Revising a returned report: read the reviewer's remarks and the comments they left on each file,
// open the files, swap in corrected versions, and resubmit. The version that was returned (with
// its original files and the reviewer's comments) is kept in the Report Archive by the server.
export default function ReviseReturnedReportPage() {
  const router = useRouter();
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [corrections, setCorrections] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [viewing, setViewing] = useState(null);
  // One entry per file the report will have: { original, replacement: File|null, removed: bool }
  // for existing files, and { added: File, kind } for new ones.
  const [items, setItems] = useState([]);
  const replaceInputs = useRef({});
  const addInputRef = useRef(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await axios.get(`/api/reports/${id}`, { headers: authHeaders() });
        const loaded = res.data.report;
        setReport(loaded);
        setCorrections(parseJsonField(loaded?.content, {}).corrections || '');
        setItems(parseJsonField(loaded?.attachments, []).map((original) => ({ original, replacement: null, removed: false })));
        axios
          .get(`/api/reports/${id}/annotations`, { headers: authHeaders() })
          // Only comments on the files the report has now. Comments on files replaced in an
          // earlier revision belong to that archived version, not this one.
          .then((r) => {
            const currentUrls = new Set(parseJsonField(loaded?.attachments, []).map((a) => a.url));
            setAnnotations((r.data.annotations || []).filter((a) => currentUrls.has(a.attachmentUrl)));
          })
          .catch(() => setAnnotations([]));
      } catch (err) {
        setLoadError(err.response?.data?.error || 'Failed to load report');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const commentsByUrl = useMemo(() => {
    const map = new Map();
    annotations.forEach((a) => map.set(a.attachmentUrl, [...(map.get(a.attachmentUrl) || []), a]));
    return map;
  }, [annotations]);

  const newFiles = items.flatMap((item) => (item.added ? [item.added] : item.replacement && !item.removed ? [item.replacement] : []));
  const filesChanged = items.some((item) => item.added || item.replacement || item.removed);
  const keptCount = items.filter((item) => !item.removed).length;
  const hasMainFile = items.some((item) => !item.removed && (item.added ? item.kind !== 'EMS' : item.original.kind !== 'EMS'));
  const invalidFile = newFiles.find((file) => getFileIssue(file));
  const replacedCount = items.filter((item) => item.replacement && !item.removed).length;
  const removedCount = items.filter((item) => item.removed && !item.added).length;

  const updateItem = (index, patch) => setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const onReplacePicked = (index, event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) updateItem(index, { replacement: file, removed: false });
  };

  const onAddPicked = (event) => {
    const picked = Array.from(event.target.files || []);
    event.target.value = '';
    if (!picked.length) return;
    setItems((prev) => [...prev, ...picked.map((file) => ({ added: file, kind: 'MAIN' }))].slice(0, MAX_ATTACHMENTS));
  };

  const resubmit = async () => {
    setError('');
    if (invalidFile) {
      setError(`"${invalidFile.name}" ${getFileIssue(invalidFile)}.`);
      return;
    }
    if (!hasMainFile) {
      setError('Keep or upload at least one report file before resubmitting.');
      return;
    }
    setSubmitting(true);
    try {
      let attachments;
      if (filesChanged) {
        const uploaded = newFiles.length ? await uploadDirect(newFiles, authHeaders()) : [];
        let next = 0;
        attachments = items.flatMap((item) => {
          if (item.added) return [{ ...uploaded[next++], ...(item.kind === 'EMS' && { kind: 'EMS' }) }];
          if (item.removed) return [];
          if (item.replacement) return [{ ...uploaded[next++], ...(item.original.kind === 'EMS' && { kind: 'EMS' }) }];
          return [item.original];
        });
      }

      const content = { ...parseJsonField(report?.content, {}), corrections };
      await axios.patch(
        `/api/reports/${id}`,
        { content: JSON.stringify(content), status: 'SUBMITTED', ...(attachments && { attachments }) },
        { headers: authHeaders() }
      );
      router.push('/municipal/reports');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to resubmit report');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-8">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-gray-600" aria-label="Loading" />
      </div>
    );
  }
  if (!report) return <div className="p-4 sm:p-6 lg:p-8 text-red-600">{loadError || 'Report not found'}</div>;

  if (report.status !== 'RETURNED') {
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
        <BackButton fallbackHref="/municipal/reports" className="mb-4" />
        <div className="card text-sm text-gray-600">
          This report is <StatusBadge status={report.status} /> and isn&apos;t waiting for revision, so it can&apos;t be edited here.
        </div>
      </div>
    );
  }

  const returnedBy = report.reviewedBy;

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6 lg:p-8">
      <div>
        <BackButton fallbackHref="/municipal/reports" className="mb-3" />
        <PageHeader
          icon={FileEdit}
          eyebrow="Returned for revision"
          title={`Revise ${humanize(report.reportType)}`}
          description={`Report #${report.id}${report.incident?.referenceNumber ? ` · Ref. ${report.incident.referenceNumber}` : ''}`}
          border={false}
        />
      </div>

      {/* 1. What the reviewer said */}
      <section className="card space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
          <MessageSquare className="h-4 w-4 text-gray-400" /> 1. Reviewer&apos;s remarks
        </h2>
        <div className="rounded-md border-l-4 border-red-400 bg-red-50 p-3 text-sm text-red-800">
          <p className="text-xs font-medium text-red-700">
            Returned by {returnedBy?.name || 'the reviewer'} ({roleLabel(returnedBy?.role)})
            {report.reviewedAt && ` on ${formatDateTime(report.reviewedAt)}`}
          </p>
          <p className="mt-1 whitespace-pre-wrap">{report.remarks || 'No remarks were written.'}</p>
        </div>
        {annotations.length > 0 && (
          <p className="text-sm text-gray-600">
            The reviewer also left <strong>{annotations.length} comment{annotations.length === 1 ? '' : 's'}</strong> on your files.
            They&apos;re listed under each file below. Open a PDF to see them highlighted on the page.
          </p>
        )}
      </section>

      {/* 2. Files */}
      <section className="card space-y-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <Upload className="h-4 w-4 text-gray-400" /> 2. Open and replace files
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Open a file to see the reviewer&apos;s comments, then use <strong>Replace</strong> to upload your revised version.
            Files you replace or remove are kept in the <strong>Archive</strong> with this version of the report.
          </p>
        </div>

        <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
          {items.map((item, index) => {
            if (item.added) {
              const issue = getFileIssue(item.added);
              return (
                <li key={`added-${index}`} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium text-gray-900">
                      <Plus className="h-4 w-4 text-emerald-600" /> <span className="truncate">{item.added.name}</span>
                    </p>
                    <p className={`text-xs ${issue ? 'text-red-600' : 'text-emerald-700'}`}>{issue ? `Can't upload: ${issue}` : 'New file, will be added'}</p>
                  </div>
                  <button type="button" onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))} className="btn btn-ghost px-2.5 py-1.5 text-xs">
                    Remove
                  </button>
                </li>
              );
            }

            const { original, replacement, removed } = item;
            const comments = commentsByUrl.get(original.url) || [];
            const issue = replacement && getFileIssue(replacement);
            return (
              <li key={original.url} className="space-y-2 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className={`flex items-center gap-2 text-sm font-medium ${removed || replacement ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                      {isPdf(original) ? <FileText className="h-4 w-4 flex-shrink-0" /> : <FileIcon className="h-4 w-4 flex-shrink-0" />}
                      <span className="truncate">{original.name}</span>
                      {original.kind === 'EMS' && <span className="badge bg-red-50 text-red-700 no-underline">EMS</span>}
                    </p>
                    {replacement && !removed && (
                      <p className={`mt-1 flex items-center gap-1.5 text-xs ${issue ? 'text-red-600' : 'text-emerald-700'}`}>
                        {issue ? <AlertTriangle className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
                        {issue ? `${replacement.name}: ${issue}` : `Replaced with ${replacement.name}`}
                      </p>
                    )}
                    {removed && <p className="mt-1 text-xs text-gray-500">Will be removed (kept in the Archive)</p>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => (isPdf(original) ? setViewing(original) : window.open(original.url, '_blank', 'noopener'))}
                      className="btn btn-secondary px-2.5 py-1.5 text-xs"
                    >
                      Open{comments.length ? ` (${comments.length} comment${comments.length === 1 ? '' : 's'})` : ''}
                    </button>
                    {replacement || removed ? (
                      <button type="button" onClick={() => updateItem(index, { replacement: null, removed: false })} className="btn btn-ghost px-2.5 py-1.5 text-xs">
                        <RotateCcw className="h-3.5 w-3.5" /> Undo
                      </button>
                    ) : (
                      <>
                        <button type="button" onClick={() => replaceInputs.current[index]?.click()} className="btn btn-primary px-2.5 py-1.5 text-xs">
                          <Upload className="h-3.5 w-3.5" /> Replace
                        </button>
                        <button type="button" onClick={() => updateItem(index, { removed: true })} className="btn btn-ghost px-2.5 py-1.5 text-xs text-gray-500" aria-label={`Remove ${original.name}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                    <input
                      ref={(el) => { replaceInputs.current[index] = el; }}
                      type="file"
                      accept={ACCEPT}
                      className="hidden"
                      onChange={(e) => onReplacePicked(index, e)}
                    />
                  </div>
                </div>
                {comments.length > 0 && (
                  <ul className="space-y-1 border-l-2 border-amber-300 pl-3">
                    {comments.map((a) => (
                      <li key={a.id} className="text-xs text-gray-700">
                        <span className="font-medium">{a.author?.name || 'Reviewer'}:</span> {a.comment}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => addInputRef.current?.click()}
            disabled={keptCount >= MAX_ATTACHMENTS}
            className="btn btn-secondary px-3 py-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" /> Add another file
          </button>
          <input ref={addInputRef} type="file" multiple accept={ACCEPT} className="hidden" onChange={onAddPicked} />
          {(replacedCount > 0 || removedCount > 0) && (
            <p className="flex items-center gap-1.5 text-xs text-gray-500">
              <FolderArchive className="h-3.5 w-3.5" />
              {replacedCount + removedCount} old file{replacedCount + removedCount === 1 ? '' : 's'} will be kept in the Archive
            </p>
          )}
        </div>
      </section>

      {/* 3. Notes + resubmit */}
      <section className="card space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
          <Send className="h-4 w-4 text-gray-400" /> 3. Explain your changes and resubmit
        </h2>
        <textarea
          value={corrections}
          onChange={(e) => setCorrections(e.target.value)}
          rows={4}
          className="form-input"
          placeholder="What did you correct? This is shown to the reviewer."
          aria-label="Your corrections"
        />
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={resubmit} disabled={submitting} className="btn btn-primary">
            <Undo2 className="h-4 w-4" />
            {submitting ? 'Submitting…' : `Resubmit to ${roleLabel(returnedBy?.role)}`}
          </button>
          <button type="button" onClick={() => router.push('/municipal/reports')} disabled={submitting} className="btn btn-ghost">
            Cancel
          </button>
        </div>
      </section>

      <CaseChain reports={report.caseReports} currentId={report.id} referenceNumber={report.incident?.referenceNumber} />

      {viewing && (
        <PdfAnnotator
          attachmentUrl={viewing.url}
          attachmentName={viewing.name}
          reportId={report.id}
          canAnnotate={false}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
