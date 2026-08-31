'use client';

import { Paperclip } from 'lucide-react';

export default function AttachmentInput({ files, onChange }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold text-bfp-navy mb-4">
        <Paperclip className="w-5 h-5" /> Attachments
      </h2>
      <label className="form-label">Attach Files</label>
      <input
        type="file"
        multiple
        onChange={onChange}
        className="form-input"
      />
      {files.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-gray-600">
          {files.map((file) => (
            <li key={`${file.name}-${file.size}`}>{file.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
