'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';
import StatusBadge from '@/components/common/StatusBadge';
import { formatDateTime } from '@/lib/utils';

export default function ProvincialReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');

  useEffect(() => {
    fetchReports();
  }, [filterStatus, filterType]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);
      if (filterType) params.append('reportType', filterType);

      const response = await axios.get(`/api/reports?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setReports(response.data.reports);
    } catch (err) {
      console.error('Error fetching reports:', err);
      setError('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (reportId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `/api/reports/${reportId}/approve`,
        { action: 'approve' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Report approved successfully');
      fetchReports();
    } catch (err) {
      alert('Failed to approve report');
    }
  };

  const handleReject = async (reportId) => {
    const remarks = prompt('Enter remarks for returning the report:');
    if (!remarks) return;

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `/api/reports/${reportId}/approve`,
        { action: 'reject', remarks },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Report returned for revision');
      fetchReports();
    } catch (err) {
      alert('Failed to return report');
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-bfp-navy mb-6">All Reports</h1>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="form-label">Filter by Status</label>
          <select
            className="form-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="APPROVED">Approved</option>
            <option value="RETURNED">Returned</option>
          </select>
        </div>
        <div>
          <label className="form-label">Filter by Type</label>
          <select
            className="form-select"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="DAILY">Daily Report</option>
            <option value="INITIAL">Initial Report</option>
            <option value="PROGRESS">Progress Report</option>
            <option value="FINAL">Final Report</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <p className="text-gray-600">Loading reports...</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-gray-100 rounded-lg p-8 text-center">
          <p className="text-gray-600">No reports found</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow-md">
          <table className="data-table">
            <thead>
              <tr>
                <th>Municipality</th>
                <th>Type</th>
                <th>Report Date</th>
                <th>Submitted By</th>
                <th>Status</th>
                <th>Submitted At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td>{report.municipality.name}</td>
                  <td className="font-semibold">{report.reportType}</td>
                  <td>{new Date(report.reportDate).toLocaleDateString()}</td>
                  <td>{report.submittedBy.name}</td>
                  <td>
                    <StatusBadge status={report.status} />
                  </td>
                  <td className="text-sm text-gray-600">
                    {formatDateTime(report.submittedAt)}
                  </td>
                  <td className="text-sm">
                    {report.status === 'SUBMITTED' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(report.id)}
                          className="btn btn-success"
                        >
                          ✓ Approve
                        </button>
                        <button
                          onClick={() => handleReject(report.id)}
                          className="btn btn-danger"
                        >
                          ✗ Return
                        </button>
                      </div>
                    )}
                    {report.status !== 'SUBMITTED' && (
                      <Link
                        href={`/provincial/reports/${report.id}`}
                        className="text-bfp-red hover:underline"
                      >
                        View
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
