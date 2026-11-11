'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { useToast } from '../common/ToastProvider';
import { useEscapeKey } from '../../hooks/useEscapeKey';

const FORWARD_ROLE_LABELS = {
  MUNICIPAL_FIRE_MARSHAL: 'Municipal Fire Marshal',
  PROVINCIAL_CHIEF_IIS: 'Provincial Chief IIS',
};

// The next reviewer tier is fully determined by who last approved the report (the server enforces
// this regardless of what's sent), so this is a confirmation, not a choice.
export const getForwardRole = (report) => {
  const reviewerRole = report?.reviewedBy?.role;
  return reviewerRole === 'MUNICIPAL_CHIEF_IIS' || reviewerRole === 'MUNICIPAL_CHIEF_OPERATION'
    ? 'MUNICIPAL_FIRE_MARSHAL'
    : 'PROVINCIAL_CHIEF_IIS';
};

// "Submit to next level" confirmation for a report a reviewer approved and handed back to the
// investigator to forward. Portaled to <body> so it isn't trapped by an animated table row.
export default function ForwardReportModal({ report, onClose, onForwarded }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const forwardRole = getForwardRole(report);

  useEscapeKey(onClose, !loading);

  const confirm = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      await axios.patch(
        `/api/reports/${report.id}`,
        { status: 'SUBMITTED', passedToRole: forwardRole },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Report submitted to ${FORWARD_ROLE_LABELS[forwardRole]} for review.`);
      onForwarded?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to forward report');
      // 409: already forwarded (e.g. a double-click or another tab) — show the current state.
      if (err.response?.status === 409) onForwarded?.();
    } finally {
      setLoading(false);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
      <div className="modal-pop-in bg-white rounded-lg shadow-2xl w-full max-w-sm">
        <div className="p-6 border-b">
          <h3 className="text-lg font-bold text-bfp-navy">Submit Report</h3>
          <p className="text-sm text-gray-500 mt-1">
            This report will be sent to the <strong>{FORWARD_ROLE_LABELS[forwardRole]}</strong> for review.
          </p>
        </div>
        <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
          <button onClick={onClose} className="btn btn-secondary" disabled={loading}>Cancel</button>
          <button onClick={confirm} className="btn btn-primary" disabled={loading}>
            {loading ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
