'use client';

import { AlertTriangle } from 'lucide-react';

export default function ConfirmDeleteModal({ title = 'Delete Report', message, loading, error, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div
        className="modal-pop-in w-full max-w-sm rounded-lg bg-white p-6 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <AlertTriangle className="mx-auto mb-4 w-12 h-12 text-bfp-red" />
        <h2 className="mb-2 text-lg font-bold text-bfp-navy">{title}</h2>
        <p className="mb-4 text-sm text-gray-600">{message}</p>

        {error && (
          <div className="mb-4 rounded border border-red-400 bg-red-100 px-4 py-2.5 text-left text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-center gap-3">
          <button type="button" onClick={onCancel} disabled={loading} className="btn btn-secondary px-6">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={loading} className="btn btn-danger px-6">
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
