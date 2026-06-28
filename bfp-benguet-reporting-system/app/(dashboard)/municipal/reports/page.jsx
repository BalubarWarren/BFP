'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';
import StatusBadge from '@/components/common/StatusBadge';
import { formatDateTime } from '@/lib/utils';

export default function MunicipalReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    fetchReports();
  }, [filterStatus]);

  const fetchReports = async () => {
    try {
      const token = localStorage.getItem('token');

      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);

      const response = await axios.get(`/api/reports?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setReports(response.data.reports);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-bfp-navy mb-6">My Submitted Reports</h1>

      {/* Filter */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <label className="form-label">Filter by Status</label>
        <select
          className="form-select max-w-xs"
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

      {loading ? (
        <p className="text-gray-600">Loading reports...</p>
      ) : reports.length === 0 ? (
        <div className="bg-gray-100 rounded-lg p-8 text-center">
          <p className="text-gray-600 mb-4">No reports found</p>
          <div className="flex gap-4 justify-center">
            <Link href="/municipal/reports/mdfir" className="btn btn-primary">
              Submit MDFIR
            </Link>
            <Link href="/municipal/reports/daily" className="btn btn-primary">
              Submit Daily Report
            </Link>
            <Link href="/municipal/reports/initial" className="btn btn-primary">
              Submit Initial Report
            </Link>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow-md">
          <table className="data-table">
            <thead>
              <tr>
                <th>Report Type</th>
                <th>Report Date</th>
                <th>Status</th>
                <th>Submitted At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td className="font-semibold">{report.reportType}</td>
                  <td>{new Date(report.reportDate).toLocaleDateString()}</td>
                  <td>
                    <StatusBadge status={report.status} />
                  </td>
                  <td className="text-sm">
                    {formatDateTime(report.submittedAt)}
                  </td>
                  <td className="text-sm">
                    {report.status === 'DRAFT' && (
                      <Link
                        href={`/municipal/reports/${report.id}/edit`}
                        className="text-bfp-red hover:underline"
                      >
                        Edit
                      </Link>
                    )}
                    {report.status === 'RETURNED' && (
                      <div>
                        <p className="text-red-600 font-semibold">Needs Revision</p>
                        {report.remarks && (
                          <p className="text-xs text-gray-600 mt-1">{report.remarks}</p>
                        )}
                      </div>
                    )}
                    {report.status !== 'DRAFT' && (
                      <span className="text-gray-500">View Only</span>
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
