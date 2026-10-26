'use client';

import { CheckCircle2, Download } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useEscapeKey } from '../../hooks/useEscapeKey';

// `report` is the newly created report from POST /api/reports — it already carries its QR token
// (issued the moment a report is passed), so the investigator gets the QR code right here.
export default function SubmitSuccessModal({ message, onConfirm, report }) {
  useEscapeKey(onConfirm);

  const verifyUrl = report?.qrToken ? `${window.location.origin}/verify/${report.qrToken}` : null;
  const canvasId = 'submitted-report-qr';
  const referenceLabel = report?.incident?.referenceNumber || (report ? `Report #${report.id}` : '');

  const handleDownload = () => {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${referenceLabel.replace(/[^a-zA-Z0-9-]/g, '_')}-QR.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
      <div className="modal-pop-in w-full max-w-sm rounded-lg bg-white p-6 shadow-xl text-center">
        <CheckCircle2 className="w-12 h-12 text-bfp-green mx-auto mb-4" />
        <h2 className="text-lg font-bold text-bfp-navy mb-2">Report Submitted</h2>
        <p className="text-sm text-gray-600 mb-6">{message}</p>

        {verifyUrl && (
          <div className="mb-6">
            <p className="text-sm font-semibold text-bfp-navy mb-2">{referenceLabel} — QR Code</p>
            <div className="flex justify-center p-3 border border-gray-200 rounded-lg mb-2">
              <QRCodeCanvas id={canvasId} value={verifyUrl} size={160} level="M" includeMargin />
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Scanning shows this report&rsquo;s current status. It stays the same even if the report
              is returned and corrected.
            </p>
            <button
              type="button"
              onClick={handleDownload}
              className="btn btn-secondary inline-flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" /> Download QR
            </button>
          </div>
        )}

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
