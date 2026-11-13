'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { QrCode, Copy, Download, Check } from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';

// window.location.origin, not NEXT_PUBLIC_API_URL — this component is only ever mounted client-
// side, after a user clicks "QR Code" (see the `{qrTarget && <ReportQrModal .../>}` guard in the
// Reports archive page), so it never appears in server-rendered HTML and `window` is always
// available here. That also makes it immune to NEXT_PUBLIC_API_URL being missing or stale at
// build time — which is exactly what broke every QR code in production: NEXT_PUBLIC_API_URL is
// baked into the client bundle at build time, not read at runtime, so a build where it wasn't
// set produced QR codes that encoded a bare "/verify/<token>" with no domain — meaningless to a
// phone camera with no "current page" to resolve a relative path against.
const buildVerifyUrl = (qrToken) => `${window.location.origin}/verify/${qrToken}`;

// Opened from the shared Reports archive (app/(dashboard)/reports/page.jsx) or any report's
// QR Code button (ReportQrButton.jsx) — scanning the code opens /verify/[qrToken], a public
// tracking page (no login) showing where the report is in the review chain and who has it now.
// It never exposes the report's files or contents.
//
// Rendered through a portal into <body>: the QR Code button usually sits inside a table row with
// the `row-fade-in` animation, and a transformed ancestor turns `position: fixed` into "fixed to
// that row" — which is what boxed the modal into the row and overlapped the table text.
export default function ReportQrModal({ report, onClose }) {
  const [copied, setCopied] = useState(false);
  const verifyUrl = buildVerifyUrl(report.qrToken);
  const referenceLabel = report.incident?.referenceNumber || `Report #${report.id}`;
  const canvasId = `report-qr-${report.qrToken}`;

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEscapeKey(onClose, true);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(verifyUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can fail (permissions, insecure context) — the link is still shown as
      // selectable text below, so it can be copied by hand.
    }
  };

  const handleDownload = () => {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${referenceLabel.replace(/[^a-zA-Z0-9-]/g, '_')}-QR.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 modal-overlay z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="modal-pop-in bg-white rounded-lg shadow-2xl w-full max-w-sm p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="flex items-center gap-2 font-bold text-bfp-navy">
            <QrCode className="w-5 h-5" /> Report Tracking QR
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none" aria-label="Close">
            &times;
          </button>
        </div>

        <p className="text-sm font-semibold text-bfp-navy mb-4">{referenceLabel}</p>

        <div className="flex justify-center p-4 bg-white border border-gray-200 rounded-lg mb-4">
          <QRCodeCanvas id={canvasId} value={verifyUrl} size={200} level="M" includeMargin />
        </div>

        <p className="text-xs text-gray-500 mb-4">
          Scan with a phone camera to track this report &mdash; where it is now and who is
          reviewing it. No login needed, and the report&rsquo;s files are never shown. The code
          stays the same even if the report is returned and corrected.
        </p>

        <div className="flex items-center gap-2 mb-4 rounded-lg bg-gray-50 px-3 py-2">
          <span className="flex-1 truncate text-xs text-gray-600 text-left">{verifyUrl}</span>
          <button onClick={handleCopy} className="flex-shrink-0 text-bfp-navy hover:text-bfp-navy-light" aria-label="Copy link">
            {copied ? <Check className="w-4 h-4 text-bfp-green" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex gap-3 flex-wrap">
          <button onClick={onClose} className="btn btn-secondary flex-1">Close</button>
          <button onClick={handleDownload} className="btn btn-primary flex-1 flex items-center justify-center gap-1.5">
            <Download className="w-4 h-4" /> Download
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
