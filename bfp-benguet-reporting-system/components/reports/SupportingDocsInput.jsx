'use client';

import { useRef } from 'react';
import { FilePlus2, Paperclip, Trash2 } from 'lucide-react';
import { SUPPORTING_DOC_TYPES } from '../../lib/constants';
import { getFileIssue } from './AttachmentInput';

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.heic,application/pdf,image/jpeg,image/png,image/webp,image/heic';

const formatSize = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

// Optional supporting documents for a Spot/Progress/Final report — Fire Incident Certificate,
// laboratory and analysis results, sketches, photos, an Explanation Report... Each file gets a
// document type. `docs` is [{ file, docType }].
export default function SupportingDocsInput({ docs, onChange, defaultDocType = SUPPORTING_DOC_TYPES[0] }) {
  const inputRef = useRef(null);

  const addFiles = (fileList) => {
    const picked = Array.from(fileList || []);
    if (!picked.length) return;
    onChange([...docs, ...picked.map((file) => ({ file, docType: defaultDocType }))]);
    if (inputRef.current) inputRef.current.value = '';
  };

  const update = (index, patch) => onChange(docs.map((doc, i) => (i === index ? { ...doc, ...patch } : doc)));
  const remove = (index) => onChange(docs.filter((_, i) => i !== index));

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-gray-900">
            <Paperclip className="w-5 h-5" /> Supporting Documents <span className="text-sm font-normal text-gray-500">(optional)</span>
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Fire Incident Certificate, laboratory / specimen results, chemical, electrical, fire debris, gas or fuel and explosive
            residue analyses, sketches and photos. PDF or image files.
          </p>
        </div>
        <button type="button" onClick={() => inputRef.current?.click()} className="btn btn-secondary inline-flex items-center gap-1.5 text-sm">
          <FilePlus2 className="h-4 w-4" /> Add documents
        </button>
        <input ref={inputRef} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => addFiles(e.target.files)} />
      </div>

      {docs.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full rounded-md border border-dashed border-gray-300 p-5 text-center text-sm text-gray-500 hover:border-bfp-navy hover:text-bfp-navy"
        >
          No supporting documents added
        </button>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
          {docs.map((doc, index) => {
            const problem = getFileIssue(doc.file);
            return (
              <li key={`${doc.file.name}-${index}`} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900" title={doc.file.name}>{doc.file.name}</p>
                  <p className={`text-xs ${problem ? 'text-bfp-red' : 'text-gray-500'}`}>{problem || formatSize(doc.file.size)}</p>
                </div>
                <select
                  className="form-input w-full py-1.5 text-sm sm:w-64"
                  value={doc.docType}
                  onChange={(e) => update(index, { docType: e.target.value })}
                  aria-label={`Document type for ${doc.file.name}`}
                >
                  {SUPPORTING_DOC_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <button type="button" onClick={() => remove(index)} className="text-gray-400 hover:text-bfp-red" aria-label={`Remove ${doc.file.name}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
