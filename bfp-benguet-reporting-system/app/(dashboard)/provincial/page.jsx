'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { formatDate } from '@/lib/utils';
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

export default function ProvincialDashboard() {
  const [monitoringBoard, setMonitoringBoard] = useState([]);
  const [totals, setTotals] = useState({});
  const [kpis, setKpis] = useState({});
  const [charts, setCharts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [asOf, setAsOf] = useState(new Date());
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [activeTab, setActiveTab] = useState('monthly');
  const [trendMode, setTrendMode] = useState('years');
  const [selectedTrendYears, setSelectedTrendYears] = useState([]);
  const [selectedTrendYear, setSelectedTrendYear] = useState(new Date().getFullYear());
  const [selectedTrendMonths, setSelectedTrendMonths] = useState([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

  // ── Historical view state ──
  const _now = new Date();
  const [histTab, setHistTab] = useState('monthly');
  const [histMonthNum, setHistMonthNum] = useState(_now.getMonth() === 0 ? 12 : _now.getMonth());
  const [histMonthYear, setHistMonthYear] = useState(_now.getMonth() === 0 ? _now.getFullYear() - 1 : _now.getFullYear());
  const [histYearNum, setHistYearNum] = useState(_now.getFullYear() - 1);
  const [histData, setHistData] = useState(null);
  const [histTotals, setHistTotals] = useState({});
  const [histLabel, setHistLabel] = useState('');
  const [histLoading, setHistLoading] = useState(false);

  useEffect(() => { fetchDashboardData(); }, [dateRange]);

  // Auto-fetch historical data whenever the selectors change
  useEffect(() => { fetchHistoricalData(); }, [histTab, histMonthNum, histMonthYear, histYearNum]);

  useEffect(() => {
    const availableYears = charts.comparison?.availableYears || [];
    if (!availableYears.length) return;

    setSelectedTrendYears((current) => {
      const validSelection = current.filter((year) => availableYears.includes(year));
      return validSelection.length ? validSelection : availableYears.slice(-3);
    });

    setSelectedTrendYear((current) =>
      availableYears.includes(current) ? current : availableYears[availableYears.length - 1]
    );
  }, [charts.comparison?.availableYears?.join(',')]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      const boardParams = new URLSearchParams();
      if (dateRange.startDate) boardParams.append('startDate', dateRange.startDate);
      if (dateRange.endDate) boardParams.append('endDate', dateRange.endDate);

      const [boardResponse, analyticsResponse] = await Promise.all([
        axios.get(`/api/dashboard/monitoring-board?${boardParams}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get('/api/dashboard/analytics', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      setMonitoringBoard(boardResponse.data.monitoringBoard);
      setTotals(boardResponse.data.totals);
      setAsOf(boardResponse.data.asOf);
      setKpis(analyticsResponse.data.kpis);
      setCharts(analyticsResponse.data.charts || {});
    } catch (err) {
      console.error('Error fetching dashboard:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistoricalData = async () => {
    try {
      setHistLoading(true);
      const token = localStorage.getItem('token');
      let startDate, endDate, label;

      if (histTab === 'monthly') {
        const yr = Number(histMonthYear);
        const mo = Number(histMonthNum);
        const lastDay = new Date(yr, mo, 0).getDate();
        startDate = `${yr}-${String(mo).padStart(2, '0')}-01`;
        endDate   = `${yr}-${String(mo).padStart(2, '0')}-${lastDay}`;
        label = new Date(yr, mo - 1, 1).toLocaleString('default', { month: 'long' }) + ' ' + yr;
      } else {
        const yr = Number(histYearNum);
        startDate = `${yr}-01-01`;
        endDate   = `${yr}-12-31`;
        label = `Year ${yr}`;
      }

      const params = new URLSearchParams({ startDate, endDate });
      const resp = await axios.get(`/api/dashboard/monitoring-board?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setHistData(resp.data.monitoringBoard);
      setHistTotals(resp.data.totals);
      setHistLabel(label);
    } catch (err) {
      console.error('Historical data error:', err);
    } finally {
      setHistLoading(false);
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

  const now = new Date();
  const currentMonthName = now.toLocaleString('default', { month: 'long' });
  const currentYear = now.getFullYear();
  const monthOptions = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ];
  const comparison = charts.comparison || {};
  const availableTrendYears = comparison.availableYears || [currentYear];
  const yearlyComparison = comparison.yearly || [];
  const monthlyComparisonRows = comparison.monthlyByYear?.[String(selectedTrendYear)] || [];
  const trendComparisonData = trendMode === 'years'
    ? yearlyComparison.filter((row) => selectedTrendYears.includes(row.year))
    : monthlyComparisonRows.filter((row) => selectedTrendMonths.includes(row.monthNumber));
  const highestTrendPeriod = trendComparisonData.reduce((highest, row) => {
    if (!highest || row.total > highest.total) return row;
    return highest;
  }, null);

  const toggleTrendYear = (year) => {
    setSelectedTrendYears((current) => {
      if (current.includes(year)) {
        return current.length === 1 ? current : current.filter((item) => item !== year);
      }
      return [...current, year].sort((a, b) => a - b);
    });
  };

  const toggleTrendMonth = (monthNumber) => {
    setSelectedTrendMonths((current) => {
      if (current.includes(monthNumber)) {
        return current.length === 1 ? current : current.filter((item) => item !== monthNumber);
      }
      return [...current, monthNumber].sort((a, b) => a - b);
    });
  };

  return (
    <div className="p-8">
      {/* Page Title */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-bfp-navy mb-1">Provincial Dashboard</h1>
        <p className="text-gray-600">Real-time fire incident monitoring for Benguet Province</p>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* ── 1. MONITORING BOARD — first thing visible ── */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-start mb-4 flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold text-bfp-navy">Fire Incident Monitoring Board</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {currentMonthName} {currentYear} &mdash; as of {formatDate(asOf)}
            </p>
          </div>
          {/* Date filter inline with the board header */}
          <div className="flex gap-3 items-end flex-wrap">
            <div>
              <label className="form-label text-xs">Start Date</label>
              <input
                type="date"
                className="form-input py-1.5 text-sm"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label text-xs">End Date</label>
              <input
                type="date"
                className="form-input py-1.5 text-sm"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              />
            </div>
            <button onClick={() => setDateRange({ startDate: '', endDate: '' })} className="btn btn-secondary text-sm py-1.5">
              Clear
            </button>
          </div>
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

      {/* ── 2. KPI Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
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

      {/* ── 3. Historical Fire Incidents ── */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold text-bfp-navy mb-1">Historical Fire Incidents</h2>
        <p className="text-sm text-gray-500 mb-4">View fire incident records for a specific past month or year.</p>

        {/* Sub-tabs */}
        <div className="flex gap-2 mb-4">
          {['monthly', 'yearly'].map((tab) => (
            <button
              key={tab}
              onClick={() => { setHistTab(tab); setHistData(null); }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                histTab === tab
                  ? 'bg-bfp-navy text-white border-bfp-navy'
                  : 'bg-white text-bfp-navy border-bfp-navy hover:bg-gray-50'
              }`}
            >
              {tab === 'monthly' ? 'By Month' : 'By Year'}
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="flex gap-3 items-end flex-wrap mb-5">
          {histTab === 'monthly' ? (
            <>
              <div>
                <label className="form-label text-xs">Month</label>
                <select
                  className="form-input py-1.5 text-sm"
                  value={histMonthNum}
                  onChange={(e) => setHistMonthNum(Number(e.target.value))}
                >
                  {['January','February','March','April','May','June','July','August','September','October','November','December'].map((name, i) => (
                    <option key={i + 1} value={i + 1}>{name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label text-xs">Year</label>
                <select
                  className="form-input py-1.5 text-sm"
                  value={histMonthYear}
                  onChange={(e) => setHistMonthYear(Number(e.target.value))}
                >
                  {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4].map((yr) => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <div>
              <label className="form-label text-xs">Year</label>
              <select
                className="form-input py-1.5 text-sm"
                value={histYearNum}
                onChange={(e) => setHistYearNum(Number(e.target.value))}
              >
                {[currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4].map((yr) => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
            </div>
          )}
          {histLoading && <span className="text-sm text-gray-500 italic self-end pb-2">Loading…</span>}
        </div>

        {/* Results */}
        {histData === null && (
          <p className="text-gray-400 text-sm text-center py-6">Loading data…</p>
        )}

        {histData !== null && (
          <>
            <h3 className="text-lg font-bold text-bfp-navy mb-3">{histLabel} — Fire Incident Summary</h3>

            {/* Category totals */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
              {[
                { label: 'Residential',     value: histTotals.residential    || 0, color: 'bg-blue-100 text-blue-800' },
                { label: 'Non-Residential', value: histTotals.nonResidential  || 0, color: 'bg-red-100 text-red-800' },
                { label: 'Non-Structural',  value: histTotals.nonStructural   || 0, color: 'bg-orange-100 text-orange-800' },
                { label: 'Transport',       value: histTotals.transport       || 0, color: 'bg-green-100 text-green-800' },
                { label: 'TOTAL',           value: histTotals.total           || 0, color: 'bg-bfp-navy text-white' },
              ].map(({ label, value, color }) => (
                <div key={label} className={`rounded-lg p-3 text-center ${color}`}>
                  <div className="text-xs font-medium opacity-80">{label}</div>
                  <div className="text-2xl font-bold mt-0.5">{value}</div>
                </div>
              ))}
            </div>

            {/* Per-municipality breakdown */}
            {histData.length === 0 ? (
              <p className="text-gray-400 text-center py-6">No incident data recorded for this period.</p>
            ) : (
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
                    {histData.map((row) => (
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
                      <td className="text-right">{histTotals.residential    || 0}</td>
                      <td className="text-right">{histTotals.nonResidential  || 0}</td>
                      <td className="text-right">{histTotals.nonStructural   || 0}</td>
                      <td className="text-right">{histTotals.transport       || 0}</td>
                      <td className="text-right text-bfp-red text-lg">{histTotals.total || 0}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── 4. Incident Trend Charts ── */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex justify-between items-start mb-5 flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-bold text-bfp-navy">Fire Incident Comparison</h2>
            <p className="text-sm text-gray-500 mt-1">Compare selected years or months to identify the highest fire incident period.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setTrendMode('years')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                trendMode === 'years'
                  ? 'bg-bfp-navy text-white border-bfp-navy'
                  : 'bg-white text-bfp-navy border-bfp-navy hover:bg-gray-50'
              }`}
            >
              Compare Years
            </button>
            <button
              onClick={() => setTrendMode('months')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                trendMode === 'months'
                  ? 'bg-bfp-navy text-white border-bfp-navy'
                  : 'bg-white text-bfp-navy border-bfp-navy hover:bg-gray-50'
              }`}
            >
              Compare Months
            </button>
          </div>
        </div>

        {trendMode === 'years' ? (
          <div className="mb-5">
            <label className="form-label text-xs">Years to compare</label>
            <div className="flex gap-2 flex-wrap">
              {availableTrendYears.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => toggleTrendYear(year)}
                  className={`px-3 py-1.5 rounded border text-sm font-medium transition-colors ${
                    selectedTrendYears.includes(year)
                      ? 'bg-bfp-red text-white border-bfp-red'
                      : 'bg-white text-bfp-navy border-gray-300 hover:border-bfp-red'
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-5 space-y-4">
            <div>
              <label className="form-label text-xs">Year</label>
              <select
                className="form-input py-1.5 text-sm max-w-xs"
                value={selectedTrendYear}
                onChange={(e) => setSelectedTrendYear(Number(e.target.value))}
              >
                {availableTrendYears.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label text-xs">Months to compare</label>
              <div className="flex gap-2 flex-wrap">
                {monthOptions.map((month, index) => {
                  const monthNumber = index + 1;
                  return (
                    <button
                      key={month}
                      type="button"
                      onClick={() => toggleTrendMonth(monthNumber)}
                      className={`px-3 py-1.5 rounded border text-sm font-medium transition-colors ${
                        selectedTrendMonths.includes(monthNumber)
                          ? 'bg-bfp-red text-white border-bfp-red'
                          : 'bg-white text-bfp-navy border-gray-300 hover:border-bfp-red'
                      }`}
                    >
                      {month.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {highestTrendPeriod && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-xs font-semibold uppercase text-red-700">Highest Fire Incidents</p>
              <p className="text-2xl font-bold text-bfp-red mt-1">{highestTrendPeriod.period}</p>
              <p className="text-sm text-gray-600 mt-1">{highestTrendPeriod.total} total incidents</p>
            </div>
            <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                ['Residential', highestTrendPeriod.Residential],
                ['Non-Residential', highestTrendPeriod['Non-Residential']],
                ['Non-Structural', highestTrendPeriod['Non-Structural']],
                ['Transport', highestTrendPeriod.Transport],
              ].map(([label, value]) => (
                <div key={label} className="bg-gray-50 border rounded-lg p-3">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-xl font-bold text-bfp-navy">{value || 0}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {trendComparisonData.length === 0 ? (
          <p className="text-gray-400 text-center py-12">No incident data available for the selected comparison.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={trendComparisonData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Residential" stackId="a" fill="#1a3c6e" />
                <Bar dataKey="Non-Residential" stackId="a" fill="#c0392b" />
                <Bar dataKey="Non-Structural" stackId="a" fill="#e67e22" />
                <Bar dataKey="Transport" stackId="a" fill="#27ae60" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-3 py-2 text-left border">Period</th>
                    <th className="px-3 py-2 text-right border">Residential</th>
                    <th className="px-3 py-2 text-right border">Non-Residential</th>
                    <th className="px-3 py-2 text-right border">Non-Structural</th>
                    <th className="px-3 py-2 text-right border">Transport</th>
                    <th className="px-3 py-2 text-right border font-bold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {trendComparisonData.map((row) => (
                    <tr
                      key={row.period}
                      className={`border-t ${
                        highestTrendPeriod?.period === row.period ? 'bg-red-50 font-semibold' : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-3 py-2 font-bold border text-bfp-navy">{row.period}</td>
                      <td className="px-3 py-2 text-right border">{row.Residential}</td>
                      <td className="px-3 py-2 text-right border">{row['Non-Residential']}</td>
                      <td className="px-3 py-2 text-right border">{row['Non-Structural']}</td>
                      <td className="px-3 py-2 text-right border">{row.Transport}</td>
                      <td className="px-3 py-2 text-right border font-bold text-bfp-red">{row.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="hidden">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
          <h2 className="text-xl font-bold text-bfp-navy">Fire Incident Trends</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('currentMonth')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                activeTab === 'currentMonth'
                  ? 'bg-bfp-navy text-white border-bfp-navy'
                  : 'bg-white text-bfp-navy border-bfp-navy hover:bg-gray-50'
              }`}
            >
              {currentMonthName} {currentYear}
            </button>
            <button
              onClick={() => setActiveTab('monthly')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                activeTab === 'monthly'
                  ? 'bg-bfp-navy text-white border-bfp-navy'
                  : 'bg-white text-bfp-navy border-bfp-navy hover:bg-gray-50'
              }`}
            >
              Monthly ({currentYear})
            </button>
            <button
              onClick={() => setActiveTab('yearly')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                activeTab === 'yearly'
                  ? 'bg-bfp-navy text-white border-bfp-navy'
                  : 'bg-white text-bfp-navy border-bfp-navy hover:bg-gray-50'
              }`}
            >
              Yearly (5 yrs)
            </button>
          </div>
        </div>

        {/* Current Month — by category */}
        {activeTab === 'currentMonth' && (
          <>
            <p className="text-sm text-gray-500 mb-4">
              Incidents by fire category for <strong>{currentMonthName} {currentYear}</strong>
            </p>
            {(charts.currentMonthByCategory || []).length === 0 ? (
              <p className="text-gray-400 text-center py-12">No incidents recorded this month.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={charts.currentMonthByCategory} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Incidents" fill="#c0392b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </>
        )}

        {/* Monthly trend for current year — stacked by category */}
        {activeTab === 'monthly' && (
          <>
            <p className="text-sm text-gray-500 mb-4">
              Monthly fire incidents by category for <strong>{currentYear}</strong>
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={charts.monthlyByCategory || []} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Residential" stackId="a" fill="#1a3c6e" />
                <Bar dataKey="Non-Residential" stackId="a" fill="#c0392b" />
                <Bar dataKey="Non-Structural" stackId="a" fill="#e67e22" />
                <Bar dataKey="Transport" stackId="a" fill="#27ae60" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-2 py-1 text-left border">Month</th>
                    <th className="px-2 py-1 text-right border">Residential</th>
                    <th className="px-2 py-1 text-right border">Non-Res.</th>
                    <th className="px-2 py-1 text-right border">Non-Struct.</th>
                    <th className="px-2 py-1 text-right border">Transport</th>
                    <th className="px-2 py-1 text-right border font-bold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(charts.monthlyByCategory || []).map((m) => (
                    <tr key={m.month} className="border-t hover:bg-gray-50">
                      <td className="px-2 py-1 font-medium border">{m.month}</td>
                      <td className="px-2 py-1 text-right border">{m.Residential}</td>
                      <td className="px-2 py-1 text-right border">{m['Non-Residential']}</td>
                      <td className="px-2 py-1 text-right border">{m['Non-Structural']}</td>
                      <td className="px-2 py-1 text-right border">{m.Transport}</td>
                      <td className="px-2 py-1 text-right border font-bold text-bfp-red">{m.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Yearly comparison — stacked by category */}
        {activeTab === 'yearly' && (
          <>
            <p className="text-sm text-gray-500 mb-4">
              Fire incidents by category — <strong>last 5 years</strong>
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={charts.yearlyByCategory || []} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Residential" stackId="a" fill="#1a3c6e" />
                <Bar dataKey="Non-Residential" stackId="a" fill="#c0392b" />
                <Bar dataKey="Non-Structural" stackId="a" fill="#e67e22" />
                <Bar dataKey="Transport" stackId="a" fill="#27ae60" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-3 py-2 text-left border">Year</th>
                    <th className="px-3 py-2 text-right border">Residential</th>
                    <th className="px-3 py-2 text-right border">Non-Residential</th>
                    <th className="px-3 py-2 text-right border">Non-Structural</th>
                    <th className="px-3 py-2 text-right border">Transport</th>
                    <th className="px-3 py-2 text-right border font-bold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(charts.yearlyByCategory || []).map((y) => (
                    <tr key={y.year} className={`border-t ${y.year === String(currentYear) ? 'bg-red-50 font-semibold' : 'hover:bg-gray-50'}`}>
                      <td className="px-3 py-2 font-bold border text-bfp-navy">{y.year}</td>
                      <td className="px-3 py-2 text-right border">{y.Residential}</td>
                      <td className="px-3 py-2 text-right border">{y['Non-Residential']}</td>
                      <td className="px-3 py-2 text-right border">{y['Non-Structural']}</td>
                      <td className="px-3 py-2 text-right border">{y.Transport}</td>
                      <td className="px-3 py-2 text-right border font-bold text-bfp-red">{y.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
        <p className="text-sm text-gray-700">
          <strong>Note:</strong> The monitoring board displays aggregated incident counts from submitted daily reports.
          Data is populated when municipal officers submit their Daily Reports through the system.
        </p>
      </div>
    </div>
  );
}
