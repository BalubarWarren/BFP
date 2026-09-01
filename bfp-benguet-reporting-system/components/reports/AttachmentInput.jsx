'use client';

import { Paperclip, X, AlertTriangle } from 'lucide-react';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic',
  'application/pdf',
];
const ACCEPT_ATTR = '.jpg,.jpeg,.png,.webp,.gif,.heic,.pdf,image/jpeg,image/png,image/webp,image/gif,image/heic,application/pdf';

const formatSize = (bytes) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

const getFileIssue = (file) => {
  if (file.size > MAX_FILE_SIZE) return `exceeds the 10MB limit (${formatSize(file.size)})`;
  if (!ALLOWED_MIME_TYPES.includes(file.type)) return 'unsupported file type — only images and PDFs are allowed';
  return null;
};

export default function AttachmentInput({ files, onChange }) {
  const invalidCount = files.filter((file) => getFileIssue(file)).length;

  const removeFile = (index) => {
    onChange({ target: { files: files.filter((_, i) => i !== index) } });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold text-bfp-navy mb-4">
        <Paperclip className="w-5 h-5" /> Attachments
      </h2>
      <label className="form-label">Attach Files</label>
      <input
        type="file"
        multiple
        accept={ACCEPT_ATTR}
        onChange={onChange}
        className="form-input"
      />
      <p className="mt-1 text-xs text-gray-500">Images and PDFs only, up to 10MB each.</p>

      {files.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-sm">
          {files.map((file, index) => {
            const issue = getFileIssue(file);
            return (
              <li
                key={`${file.name}-${file.size}-${index}`}
                className={`flex items-center justify-between gap-2 rounded px-2 py-1 ${issue ? 'bg-red-50' : ''}`}
              >
                <span className={`flex items-center gap-1.5 min-w-0 ${issue ? 'text-red-700' : 'text-gray-600'}`}>
                  {issue && <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                  <span className="truncate">
                    {file.name}
                    {issue && <span className="font-medium"> — {issue}</span>}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  aria-label={`Remove ${file.name}`}
                  className="shrink-0 text-gray-400 hover:text-red-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {invalidCount > 0 && (
        <p className="mt-2 text-xs font-medium text-red-600">
          Remove or replace the {invalidCount === 1 ? 'file above' : `${invalidCount} files above`} marked in red before submitting — they'll be rejected on upload.
        </p>
      )}
    </div>
  );
}
