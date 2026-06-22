'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';
import StatusBadge from '@/components/common/StatusBadge';
import { formatDateTime } from '@/lib/utils';

export default function MunicipalDashboard() {
  const [user, setUser] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/reports', {
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
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-bfp-navy mb-2">Welcome, {user?.name}</h1>
        <p className="text-gray-600">
          Municipality: <strong>{user?.municipality?.name}</strong>
        </p>
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Link
          href="/municipal/reports/daily"
          className="card hover:shadow-lg transition-shadow cursor-pointer"
        >
          <div className="text-4xl mb-2">📅</div>
          <h3 className="text-xl font-bold text-bfp-navy mb-2">Daily Report</h3>
          <p className="text-gray-600 mb-4">
            Submit daily incident statistics and counts
          </p>
          <button className="btn btn-primary">Submit Report →</button>
        </Link>

        <Link
          href="/municipal/reports/initial"
          className="card hover:shadow-lg transition-shadow cursor-pointer"
        >
          <div className="text-4xl mb-2">🚨</div>
          <h3 className="text-xl font-bold text-bfp-navy mb-2">Initial Report</h3>
          <p className="text-gray-600 mb-4">
            Report a new fire incident in progress
          </p>
          <button className="btn btn-primary">Submit Report →</button>
        </Link>
      </div>

      {/* My Reports Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-bfp-navy mb-4">My Submitted Reports</h2>

        {loading ? (
          <p className="text-gray-600">Loading reports...</p>
        ) : reports.length === 0 ? (
          <p className="text-gray-600">No reports submitted yet</p>
        ) : (
          <div className="overflow-x-auto">
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
                {reports.slice(0, 10).map((report) => (
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
                            <p className="text-sm text-gray-600">{report.remarks}</p>
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

        {reports.length > 10 && (
          <div className="mt-4">
            <Link
              href="/municipal/reports"
              className="text-bfp-red hover:underline font-semibold"
            >
              View All Reports ({reports.length})
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
