'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Undo2 } from 'lucide-react';
import StatusBadge from '../../../../../../components/common/StatusBadge';

const ROLE_LABELS = {
  MUNICIPAL_CHIEF_IIS: 'Municipal Chief IIS',
  MUNICIPAL_CHIEF_OPERATION: 'Municipal Chief Operation',
  MUNICIPAL_FIRE_MARSHAL: 'Municipal Fire Marshal',
  PROVINCIAL_CHIEF_IIS: 'Provincial Chief IIS',
};

const roleLabel = (role) => ROLE_LABELS[role] || role?.replace(/_/g, ' ') || 'the reviewer';

export default function EditReturnedReportPage() {
  const router = useRouter();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [corrections, setCorrections] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true);
        const token = sessionStorage.getItem('token');
        const parts = window.location.pathname.split('/');
        const id = parts[parts.length - 2];
        const res = await axios.get(`/api/reports/${id}`, { headers: { Authorization: `Bearer ${token}` } });
        setReport(res.data.report);
        const content = res.data.report?.content ? JSON.parse(res.data.report.content) : {};
        setCorrections(content.corrections || '');
        setLoading(false);
      } catch (err) {
        setError('Failed to load report');
        setLoading(false);
      }
    };

    fetchReport();
  }, []);

  const returnedByRole = report?.reviewedBy?.role;

  // A corrected report only ever goes back to the same reviewer tier that returned it — the
  // server enforces this (see the RETURNED-resubmit block in PATCH /api/reports/[id]), so
  // there's no "submit ahead" option here; letting the investigator pick Fire Marshal or
  // Provincial Chief IIS directly from this screen was what let a returned report skip the
  // reviewer who flagged the correction in the first place.
  const resubmit = async () => {
    setSubmitting(true);
    try {
      setError('');
      const token = sessionStorage.getItem('token');
      const parts = window.location.pathname.split('/');
      const id = parts[parts.length - 2];

      const existingContent = report?.content ? JSON.parse(report.content) : {};
      const newContent = { ...existingContent, corrections };

      await axios.patch(
        `/api/reports/${id}`,
        {
          content: JSON.stringify(newContent),
          status: 'SUBMITTED',
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      router.push('/municipal/reports');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to resubmit report');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  if (!report) return <div className="p-8 text-red-600">Report not found</div>;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-bfp-navy mb-4 transition-colors">← Back</button>
      <h1 className="text-2xl font-bold text-bfp-navy mb-2">Edit Returned Report</h1>
      <p className="text-gray-600 mb-4">Status: <StatusBadge status={report.status} /></p>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-lg font-bold text-bfp-navy mb-4">Address Corrections</h2>
        <div className="space-y-5">
          <div>
            <label className="form-label">Original Remarks from Reviewer</label>
            <div className="p-3 bg-red-50 border-l-4 border-red-400 rounded text-sm text-red-700">{report.remarks || '—'}</div>
          </div>

          <div>
            <label className="form-label">Your Corrections / Notes</label>
            <textarea value={corrections} onChange={(e) => setCorrections(e.target.value)} rows={6} className="form-input" />
          </div>

          <div className="border-t border-gray-100 pt-5">
            <p className="text-sm font-semibold text-gray-700 mb-3">What would you like to do?</p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => resubmit()}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-bfp-navy px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-bfp-navy/90 disabled:opacity-50"
              >
                <Undo2 className="h-4 w-4" />
                {submitting ? 'Submitting…' : `Return to ${roleLabel(returnedByRole)}`}
              </button>
              <button
                type="button"
                onClick={() => router.push('/municipal/reports')}
                className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-gray-500 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
