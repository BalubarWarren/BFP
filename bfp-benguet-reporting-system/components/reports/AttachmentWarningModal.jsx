'use client';

import { AlertTriangle } from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import Portal from '../common/Portal';

export default function AttachmentWarningModal({
  onConfirm,
  title = 'No File Attached',
  message = 'Please attach at least one file (image or PDF) before submitting this report.',
}) {
  useEscapeKey(onConfirm);

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center modal-overlay px-4">
        <div className="modal-pop-in w-full max-w-sm rounded-lg bg-white p-6 shadow-xl text-center">
          <AlertTriangle className="w-12 h-12 text-bfp-red mx-auto mb-4" />
          <h2 className="text-lg font-semibold tracking-tight text-gray-900 mb-2">{title}</h2>
          <p className="text-sm text-gray-600 mb-6">{message}</p>
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
    </Portal>
  );
}
