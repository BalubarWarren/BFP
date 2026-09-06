'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import StatusBadge from '../../../../../../components/common/StatusBadge';

const ROLE_LABELS = {
  MUNICIPAL_CHIEF_IIS: 'Municipal Chief IIS',
  MUNICIPAL_CHIEF_OPERATION: 'Municipal Chief Operation',
  MUNICIPAL_FIRE_MARSHAL: 'Municipal Fire Marshal',
  PROVINCIAL_CHIEF_IIS: 'Provincial Chief IIS',
};

// Same escalation chain the "forward an approved report" flow uses — who comes after
// whoever returned this one, so the investigator can skip straight ahead instead of
// only ever bouncing back to the same reviewer.
const NEXT_ROLE_AFTER = {
  MUNICIPAL_CHIEF_IIS: 'MUNICIPAL_FIRE_MARSHAL',
  MUNICIPAL_CHIEF_OPERATION: 'MUNICIPAL_FIRE_MARSHAL',
  MUNICIPAL_FIRE_MARSHAL: 'PROVINCIAL_CHIEF_IIS',
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
  const nextRole = returnedByRole ? NEXT_ROLE_AFTER[returnedByRole] : null;

  const resubmit = async (passedToRole) => {
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
          // Omitting passedToRole tells the server to auto-route back to whoever returned it.
          ...(passedToRole && { passedToRole }),
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
      <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-bfp-navy mb-4">← Back</button>
      <h1 className="text-2xl font-bold text-bfp-navy mb-2">Edit Returned Report</h1>
      <p className="text-gray-600 mb-4">Status: <StatusBadge status={report.status} /></p>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-bold mb-4">Address Corrections</h2>
        <div className="space-y-4">
          <div>
            <label className="form-label">Original Remarks from Reviewer</label>
            <div className="p-3 bg-red-50 border-l-4 border-red-400 rounded text-sm text-red-700">{report.remarks || '—'}</div>
          </div>

          <div>
            <label className="form-label">Your Corrections / Notes</label>
            <textarea value={corrections} onChange={(e) => setCorrections(e.target.value)} rows={6} className="form-input" />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => resubmit(null)}
              disabled={submitting}
              className="btn btn-secondary"
            >
              ↩ Return to {roleLabel(returnedByRole)}
            </button>
            {nextRole && (
              <button
                type="button"
                onClick={() => resubmit(nextRole)}
                disabled={submitting}
                className="btn btn-primary"
              >
                → Submit to {roleLabel(nextRole)}
              </button>
            )}
            <button type="button" onClick={() => router.push('/municipal/reports')} className="btn btn-secondary">Cancel</button>
          </div>
          <p className="text-xs text-gray-500">
            <strong>Return</strong> sends your corrected report back to {roleLabel(returnedByRole)} for another look.
            {nextRole && <> <strong>Submit</strong> skips ahead to {roleLabel(nextRole)} instead, if the correction is already enough.</>}
          </p>
        </div>
      </div>
    </div>
  );
}
