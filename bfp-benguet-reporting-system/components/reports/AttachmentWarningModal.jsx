'use client';

import { AlertTriangle } from 'lucide-react';

export default function AttachmentWarningModal({ onConfirm }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
      <div className="modal-pop-in w-full max-w-sm rounded-lg bg-white p-6 shadow-xl text-center">
        <AlertTriangle className="w-12 h-12 text-bfp-red mx-auto mb-4" />
        <h2 className="text-lg font-bold text-bfp-navy mb-2">No File Attached</h2>
        <p className="text-sm text-gray-600 mb-6">
          Please attach at least one file (image or PDF) before submitting this report.
        </p>
        <button
          type="button"
          onClick={onConfirm}
          autoFocus
          className="btn btn-primary px-8"
        >
          OK
        </button>
      </div>
    </div>
  );
}
