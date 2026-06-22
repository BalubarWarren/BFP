'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import StatusBadge from '@/components/common/StatusBadge';
import { formatDate, formatDateTime } from '@/lib/utils';

export default function ProvincialDashboard() {
  const [monitoringBoard, setMonitoringBoard] = useState([]);
  const [totals, setTotals] = useState({});
  const [kpis, setKpis] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [asOf, setAsOf] = useState(new Date());
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    fetchDashboardData();
  }, [dateRange]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      // Fetch monitoring board
      const boardParams = new URLSearchParams();
      if (dateRange.startDate) boardParams.append('startDate', dateRange.startDate);
      if (dateRange.endDate) boardParams.append('endDate', dateRange.endDate);

      const boardResponse = await axios.get(`/api/dashboard/monitoring-board?${boardParams}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setMonitoringBoard(boardResponse.data.monitoringBoard);
      setTotals(boardResponse.data.totals);
      setAsOf(boardResponse.data.asOf);

      // Fetch analytics/KPIs
      const analyticsResponse = await axios.get('/api/dashboard/analytics', {
        headers: { Authorization: `Bearer ${token}` },
      });

      setKpis(analyticsResponse.data.kpis);
    } catch (err) {
      console.error('Error fetching dashboard:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-bfp-red"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Page Title */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-bfp-navy mb-2">Provincial Dashboard</h1>
        <p className="text-gray-600">Real-time fire incident monitoring for Benguet Province</p>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Date Range Filter */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6 flex gap-4 items-end">
        <div>
          <label className="form-label">Start Date</label>
          <input
            type="date"
            className="form-input"
            value={dateRange.startDate}
            onChange={(e) =>
              setDateRange({ ...dateRange, startDate: e.target.value })
            }
          />
        </div>
        <div>
          <label className="form-label">End Date</label>
          <input
            type="date"
            className="form-input"
            value={dateRange.endDate}
            onChange={(e) =>
              setDateRange({ ...dateRange, endDate: e.target.value })
            }
          />
        </div>
        <button
          onClick={() => setDateRange({ startDate: '', endDate: '' })}
          className="btn btn-secondary"
        >
          Clear Filter
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="kpi-card primary">
          <div className="kpi-label">This Month</div>
          <div className="kpi-value">{kpis?.thisMonth || 0}</div>
        </div>
        <div className="kpi-card success">
          <div className="kpi-label">This Year</div>
          <div className="kpi-value">{kpis?.thisYear || 0}</div>
        </div>
        <div className="kpi-card warning">
          <div className="kpi-label">Most Active Municipality</div>
          <div className="kpi-value text-lg">{kpis?.mostActiveMunicipality || 'N/A'}</div>
        </div>
        <div className="kpi-card primary">
          <div className="kpi-label">Most Common Category</div>
          <div className="kpi-value text-lg">{kpis?.mostCommonCategory || 'N/A'}</div>
        </div>
        <div className="kpi-card success">
          <div className="kpi-label">With Casualties</div>
          <div className="kpi-value">{kpis?.incidentsWithCasualties || 0}</div>
        </div>
      </div>

      {/* Monitoring Board */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-bfp-navy">Fire Incident Monitoring Board</h2>
          <p className="text-sm text-gray-600">As of {formatDate(asOf)}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Municipality</th>
                <th className="text-right">Residential</th>
                <th className="text-right">Non-Residential</th>
                <th className="text-right">Non-Structural</th>
                <th className="text-right">Transport</th>
                <th className="text-right font-bold">Total</th>
              </tr>
            </thead>
            <tbody>
              {monitoringBoard.map((row) => (
                <tr key={row.code}>
                  <td className="font-semibold">{row.municipality}</td>
                  <td className="text-right">{row.residential}</td>
                  <td className="text-right">{row.nonResidential}</td>
                  <td className="text-right">{row.nonStructural}</td>
                  <td className="text-right">{row.transport}</td>
                  <td className="text-right font-bold text-bfp-red">{row.total}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 font-bold">
                <td>TOTAL</td>
                <td className="text-right">{totals.residential || 0}</td>
                <td className="text-right">{totals.nonResidential || 0}</td>
                <td className="text-right">{totals.nonStructural || 0}</td>
                <td className="text-right">{totals.transport || 0}</td>
                <td className="text-right text-bfp-red text-lg">{totals.total || 0}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Info message */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
        <p className="text-sm text-gray-700">
          <strong>Note:</strong> The monitoring board displays aggregated incident counts from submitted daily reports. 
          Data is populated when municipal officers submit their Daily Reports through the system.
        </p>
      </div>
    </div>
  );
}
