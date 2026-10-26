'use client';

import { useState } from 'react';
import axios from 'axios';
import { QrCode } from 'lucide-react';
import { useToast } from '../common/ToastProvider';
import ReportQrModal from './ReportQrModal';

// "QR Code" button for any report detail view. Every report gets its QR token when first passed
// (POST /api/reports), so this usually just opens the modal; a report passed before that has its
// token minted on first click by POST /api/reports/[id]/qr instead of needing a backfill step.
export default function ReportQrButton({ report, className = 'btn btn-secondary' }) {
  const toast = useToast();
  const [qrToken, setQrToken] = useState(report.qrToken || null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Demo reports (negative ids) only exist client-side, and a draft was never passed to anyone.
  if (Number(report.id) < 0 || report.status === 'DRAFT') return null;

  const handleClick = async () => {
    if (qrToken) {
      setOpen(true);
      return;
    }
    setLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      const res = await axios.post(
        `/api/reports/${report.id}/qr`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setQrToken(res.data.qrToken);
      setOpen(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate QR code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={`${className} inline-flex items-center justify-center gap-1.5 disabled:opacity-50`}
      >
        <QrCode className="w-4 h-4" /> {loading ? 'Generating…' : 'QR Code'}
      </button>
      {open && <ReportQrModal report={{ ...report, qrToken }} onClose={() => setOpen(false)} />}
    </>
  );
}
