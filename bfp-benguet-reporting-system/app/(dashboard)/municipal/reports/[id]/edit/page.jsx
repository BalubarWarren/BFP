'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import StatusBadge from '../../../../../../components/common/StatusBadge';

const RECIPIENT_OPTIONS = [
  { value: 'MUNICIPAL_CHIEF_IIS', label: 'Municipal Chief IIS' },
  { value: 'MUNICIPAL_CHIEF_OPERATION', label: 'Municipal Chief Operation' },
  { value: 'MUNICIPAL_FIRE_MARSHAL', label: 'Municipal Fire Marshal' },
  { value: 'PROVINCIAL_CHIEF_IIS', label: 'Provincial Chief IIS' },
];

export default function EditReturnedReportPage() {
  const router = useRouter();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [corrections, setCorrections] = useState('');
  const [recipientRole, setRecipientRole] = useState('MUNICIPAL_CHIEF_IIS');

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
        // Default the recipient picker to whoever returned it — the investigator can change it.
        if (res.data.report?.reviewedBy?.role) {
          setRecipientRole(res.data.report.reviewedBy.role);
        }
        setLoading(false);
      } catch (err) {
        setError('Failed to load report');
        setLoading(false);
      }
    };

    fetchReport();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
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
          passedToRole: recipientRole,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      router.push('/municipal/reports');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to resubmit report');
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">Original Remarks from Reviewer</label>
            <div className="p-3 bg-red-50 border-l-4 border-red-400 rounded text-sm text-red-700">{report.remarks || '—'}</div>
          </div>

          <div>
            <label className="form-label">Your Corrections / Notes</label>
            <textarea value={corrections} onChange={(e) => setCorrections(e.target.value)} rows={6} className="form-input" />
          </div>

          <div>
            <label className="form-label">Submit To</label>
            <select
              value={recipientRole}
              onChange={(e) => setRecipientRole(e.target.value)}
              className="form-select max-w-xs"
            >
              {RECIPIENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">Defaults to whoever returned this report — change it if it should go elsewhere instead.</p>
          </div>

          <div className="flex gap-3">
            <button type="submit" className="btn btn-primary">Resubmit Corrected Report</button>
            <button type="button" onClick={() => router.push('/municipal/reports')} className="btn btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
