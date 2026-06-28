'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import StatusBadge from '@/components/common/StatusBadge';

export default function EditReturnedReportPage() {
  const router = useRouter();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [corrections, setCorrections] = useState('');
  const [forwardTo, setForwardTo] = useState('MUNICIPAL_CHIEF_IIS');

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError('');
      const token = localStorage.getItem('token');
      const parts = window.location.pathname.split('/');
      const id = parts[parts.length - 2];

      const existingContent = report?.content ? JSON.parse(report.content) : {};
      const newContent = { ...existingContent, corrections };

      await axios.patch(
        `/api/reports/${id}`,
        {
          content: JSON.stringify(newContent),
          status: 'SUBMITTED',
          passedToRole: forwardTo,
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
        <h2 className="text-lg font-bold mb-4">Corrections / Response</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">Original Remarks</label>
            <div className="p-3 bg-gray-50 rounded text-sm text-gray-700">{report.remarks || '—'}</div>
          </div>

          <div>
            <label className="form-label">Your Corrections / Notes</label>
            <textarea value={corrections} onChange={(e) => setCorrections(e.target.value)} rows={6} className="form-input" />
          </div>

          <div>
            <label className="form-label">Forward corrected report to</label>
            <select value={forwardTo} onChange={(e) => setForwardTo(e.target.value)} className="form-select max-w-xs">
              <option value="MUNICIPAL_CHIEF_IIS">Municipal Chief IIS</option>
              <option value="MUNICIPAL_CHIEF_OPERATION">Municipal Chief Operation</option>
            </select>
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
