'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { formatDate, isAuthError } from '@/lib/utils';
import SessionExpiredBanner from '@/components/common/SessionExpiredBanner';
import { MoreVertical, Printer, Download } from 'lucide-react';
import { CATEGORY_CHART_COLORS } from '@/lib/constants';
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

// ── Reusable "⋮" section actions menu (Print / Export) ────────────────────────
function SectionMenu({ onPrint, onExport }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-300 text-gray-600 hover:border-bfp-navy hover:text-bfp-navy transition-colors"
        aria-label="Section actions"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
          <button
            type="button"
            onClick={() => { setOpen(false); onPrint(); }}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
          {onExport && (
            <button
              type="button"
              onClick={() => { setOpen(false); onExport(); }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 border-t border-gray-100"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Benguet SVG Fire Rate Map ─────────────────────────────────────────────────
const BENGUET_MUNICIPALITIES = [
  { code: 'BAKUN',    name: 'Bakun',        points: '30,95 88,48 188,48 200,98 188,148 148,170 92,162 50,142',                                                                           lx: 108, ly: 112 },
  { code: 'MANKAYAN', name: 'Mankayan',     points: '188,48 302,46 348,82 366,132 332,156 285,168 248,154 222,126 200,98',                                                               lx: 272, ly: 96  },
  { code: 'KIBUNGAN', name: 'Kibungan',     points: '30,95 50,142 92,162 148,170 188,148 208,188 210,228 175,252 124,262 70,252 40,224 30,180',                                          lx: 112, ly: 200 },
  { code: 'BUGUIAS',  name: 'Buguias',      points: '248,154 285,168 332,156 366,132 372,212 345,228 298,238 265,215 252,182',                                                           lx: 310, ly: 186 },
  { code: 'KABAYAN',  name: 'Kabayan',      points: '265,215 298,238 345,228 372,212 372,318 348,336 300,328 270,298 264,265',                                                           lx: 322, ly: 268 },
  { code: 'KAPANGAN', name: 'Kapangan',     points: '30,180 40,224 70,252 124,262 136,312 92,332 48,322 30,296',                                                                         lx: 66,  ly: 256 },
  { code: 'ATOK',     name: 'Atok',         points: '175,252 210,228 208,188 252,182 265,215 264,265 270,298 246,312 204,318 176,308 156,282',                                           lx: 218, ly: 256 },
  { code: 'TUBLAY',   name: 'Tublay',       points: '136,312 156,282 176,308 204,318 204,352 172,360 146,350',                                                                           lx: 172, ly: 326 },
  { code: 'LT',       name: 'La Trinidad',  points: '146,350 172,360 204,352 204,386 190,394 158,386 148,368',                                                                           lx: 170, ly: 366 },
  { code: 'SABLAN',   name: 'Sablan',       points: '30,296 48,322 92,332 136,312 146,350 148,368 130,390 98,400 58,390 30,366',                                                         lx: 72,  ly: 342 },
  { code: 'BOKOD',    name: 'Bokod',        points: '264,265 270,298 300,328 348,336 372,318 372,415 342,425 298,415 264,378 258,338',                                                   lx: 320, ly: 362 },
  { code: 'TUBA',     name: 'Tuba',         points: '30,366 58,390 98,400 130,390 148,368 158,386 190,394 190,498 125,498 60,478 30,446',                                                lx: 100, ly: 438 },
  { code: 'ITOGON',   name: 'Itogon',       points: '190,394 204,386 258,338 264,378 298,415 342,425 322,468 265,498 190,498',                                                           lx: 258, ly: 448 },
];

function BenguetFireMap({ monitoringBoard, onPrint, onExport }) {
  const [hovered, setHovered] = useState(null);

  const dataMap = {};
  monitoringBoard.forEach((m) => { dataMap[m.code] = m.total || 0; });

  const values = Object.values(dataMap).filter((v) => v > 0);
  const maxVal = values.length ? Math.max(...values) : 0;

  const getColor = (code) => {
    const val = dataMap[code] || 0;
    if (maxVal === 0 || val === 0) return '#e5e7eb';
    const ratio = val / maxVal;
    // green (#16a34a) → yellow (#eab308) → red (#dc2626)
    let r, g, b;
    if (ratio <= 0.5) {
      const t = ratio * 2;
      r = Math.round(22  + (234 - 22)  * t);
      g = Math.round(163 + (179 - 163) * t);
      b = Math.round(74  + (8   - 74)  * t);
    } else {
      const t = (ratio - 0.5) * 2;
      r = Math.round(234 + (220 - 234) * t);
      g = Math.round(179 + (38  - 179) * t);
      b = Math.round(8   + (38  - 8)   * t);
    }
    return `rgb(${r},${g},${b})`;
  };

  const sorted = [...monitoringBoard].sort((a, b) => (b.total || 0) - (a.total || 0));
  const rankMap = {};
  sorted.forEach((m, i) => { rankMap[m.code] = i + 1; });

  return (
    <div id="section-fire-map" className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-xl font-bold text-bfp-navy">Municipality Fire Incident Rate Map</h2>
          <p className="text-sm text-gray-500">Color shows relative fire incident rate — green (lowest) to red (highest)</p>
        </div>
        {onPrint && <SectionMenu onPrint={onPrint} onExport={onExport} />}
      </div>
      <div className="flex flex-wrap gap-6">
        {/* SVG Map */}
        <div className="relative flex-shrink-0" style={{ width: 320 }}>
          <svg viewBox="0 0 402 510" width="320">
            <text x="201" y="24" textAnchor="middle" style={{ fontSize: 12, fontWeight: 700, fill: '#1a3c6e', letterSpacing: 1 }}>
              PROVINCE OF BENGUET
            </text>
            {BENGUET_MUNICIPALITIES.map((mun) => {
              const val = dataMap[mun.code] || 0;
              const fill = getColor(mun.code);
              const isHov = hovered?.code === mun.code;
              const small = mun.code === 'LT' || mun.code === 'TUBLAY';
              return (
                <g key={mun.code} style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHovered(mun)}
                  onMouseLeave={() => setHovered(null)}>
                  <polygon points={mun.points} fill={fill}
                    stroke="white" strokeWidth={isHov ? 3 : 1.5}
                    style={{ filter: isHov ? 'brightness(1.12)' : 'none', transition: 'filter 0.15s' }} />
                  <text x={mun.lx} y={mun.ly} textAnchor="middle"
                    style={{ fontSize: small ? 6.5 : 8.5, fontWeight: 700, fill: val === 0 ? '#9ca3af' : '#fff', pointerEvents: 'none', paintOrder: 'stroke', stroke: val === 0 ? 'none' : 'rgba(0,0,0,0.25)', strokeWidth: 3 }}>
                    {mun.name}
                  </text>
                  {val > 0 && (
                    <text x={mun.lx} y={mun.ly + (small ? 9 : 11)} textAnchor="middle"
                      style={{ fontSize: small ? 7 : 10, fontWeight: 800, fill: '#fff', pointerEvents: 'none', paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.25)', strokeWidth: 3 }}>
                      {val}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          {/* Hover tooltip */}
          {hovered && (
            <div className="absolute top-6 left-2 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm pointer-events-none" style={{ minWidth: 130 }}>
              <p className="font-bold text-bfp-navy">{hovered.name}</p>
              <p className="text-gray-600 mt-0.5">Incidents: <span className="font-bold text-bfp-red">{dataMap[hovered.code] || 0}</span></p>
              {maxVal > 0 && (dataMap[hovered.code] || 0) > 0 && (
                <p className="text-gray-600">Rank: <span className="font-bold">#{rankMap[hovered.code]}</span> of 13</p>
              )}
            </div>
          )}
        </div>

        {/* Legend + Rankings */}
        <div className="flex flex-col gap-5 flex-1 min-w-[160px]">
          {/* Color legend */}
          <div>
            <p className="text-xs font-bold uppercase text-gray-500 mb-2">Color Scale</p>
            <div className="space-y-1.5">
              {[
                { color: '#e5e7eb', label: 'No incidents' },
                { color: '#16a34a', label: 'Lowest' },
                { color: '#86efac', label: 'Low' },
                { color: '#eab308', label: 'Medium' },
                { color: '#f97316', label: 'High' },
                { color: '#dc2626', label: 'Highest' },
              ].map((t) => (
                <div key={t.label} className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded flex-shrink-0 border border-gray-200" style={{ background: t.color }} />
                  <span className="text-xs text-gray-600">{t.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export default function ProvincialDashboard() {
  const [monitoringBoard, setMonitoringBoard] = useState([]);
  const [totals, setTotals] = useState({});
  const [kpis, setKpis] = useState({});
  const [charts, setCharts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sessionExpired, setSessionExpired] = useState(false);
  const pollRef = useRef(null);
  const [asOf, setAsOf] = useState(new Date());
  const [trendMode, setTrendMode] = useState('years');
  const [selectedTrendYears, setSelectedTrendYears] = useState([]);
  const [selectedTrendYear, setSelectedTrendYear] = useState(new Date().getFullYear());
  const [selectedTrendMonths, setSelectedTrendMonths] = useState([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

  // ── Merged Fire Incident Monitoring Board state (This Month / By Month / By Year) ──
  const _now = new Date();
  const [boardTab, setBoardTab] = useState('current');
  const [histMonthNum, setHistMonthNum] = useState(_now.getMonth() === 0 ? 12 : _now.getMonth());
  const [histMonthYear, setHistMonthYear] = useState(_now.getMonth() === 0 ? _now.getFullYear() - 1 : _now.getFullYear());
  const [histYearNum, setHistYearNum] = useState(_now.getFullYear() - 1);
  const [histData, setHistData] = useState(null);
  const [histTotals, setHistTotals] = useState({});
  const [histLabel, setHistLabel] = useState('');
  const [histLoading, setHistLoading] = useState(false);

  useEffect(() => {
    fetchDashboardData();

    pollRef.current = setInterval(() => fetchDashboardData({ silent: true }), 15000);
    const onFocus = () => fetchDashboardData({ silent: true });
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(pollRef.current);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  // Auto-fetch By Month / By Year data whenever that tab or its selectors change
  useEffect(() => {
    if (boardTab === 'current') return;
    fetchHistoricalData();
  }, [boardTab, histMonthNum, histMonthYear, histYearNum]);

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

  const fetchDashboardData = async ({ silent } = {}) => {
    try {
      if (!silent) setLoading(true);
      const token = sessionStorage.getItem('token');

      const [boardResponse, analyticsResponse] = await Promise.all([
        axios.get('/api/dashboard/monitoring-board', {
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
      if (isAuthError(err)) {
        clearInterval(pollRef.current);
        setSessionExpired(true);
        return;
      }
      console.error('Error fetching dashboard:', err);
      if (!silent) setError('Failed to load dashboard data');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchHistoricalData = async () => {
    try {
      setHistLoading(true);
      const token = sessionStorage.getItem('token');
      let startDate, endDate, label;

      if (boardTab === 'monthly') {
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

  const handlePrint = (sectionId) => {
    const el = document.getElementById(sectionId);
    if (!el) return;
    const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map((link) => `<link rel="stylesheet" href="${link.href}">`)
      .join('');
    const printWin = window.open('', '_blank');
    printWin.document.write(`<!DOCTYPE html><html><head><title>BFP Benguet Dashboard</title>${stylesheets}<style>body{padding:32px;font-family:sans-serif}button{display:none!important}</style></head><body>${el.outerHTML}</body></html>`);
    printWin.document.close();
    printWin.onload = () => { printWin.focus(); printWin.print(); };
  };

  const downloadCsv = (filename, lines) => {
    const csv = lines.map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportBoardCsv = (rows, rowTotals, periodLabel) => {
    const header = ['Municipality', 'Residential', 'Non-Residential', 'Non-Structural', 'Transport', 'Total'];
    const lines = [
      [`Fire Incident Monitoring Board - ${periodLabel}`],
      header,
      ...rows.map((row) => [row.municipality, row.residential, row.nonResidential, row.nonStructural, row.transport, row.total]),
      ['TOTAL', rowTotals.residential || 0, rowTotals.nonResidential || 0, rowTotals.nonStructural || 0, rowTotals.transport || 0, rowTotals.total || 0],
    ];
    downloadCsv(`bfp-benguet-monitoring-board-${periodLabel.replace(/\s+/g, '-').toLowerCase()}.csv`, lines);
  };

  const handleExportMonitoringBoard = () => {
    const rows = boardTab === 'current' ? monitoringBoard : (histData || []);
    const rowTotals = boardTab === 'current' ? totals : histTotals;
    const periodLabel = boardTab === 'current'
      ? new Date().toLocaleString('default', { month: 'long', year: 'numeric' })
      : histLabel;
    exportBoardCsv(rows, rowTotals, periodLabel);
  };

  const handleExportFireMap = () => {
    const periodLabel = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    exportBoardCsv(monitoringBoard, totals, periodLabel);
  };

  const handleExportComparison = () => {
    const header = ['Period', 'Residential', 'Non-Residential', 'Non-Structural', 'Transport', 'Total'];
    const lines = [
      ['Fire Incident Comparison'],
      header,
      ...trendComparisonData.map((row) => [
        row.period,
        row.Residential || 0,
        row['Non-Residential'] || 0,
        row['Non-Structural'] || 0,
        row.Transport || 0,
        row.total || 0,
      ]),
    ];
    downloadCsv('bfp-benguet-fire-incident-comparison.csv', lines);
  };

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
    <div className="p-8" id="provincial-dashboard-content">
      {/* Page Title */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-bfp-navy mb-1">Provincial Dashboard</h1>
        <p className="text-gray-600">Real-time fire incident monitoring for Benguet Province</p>
      </div>

      {sessionExpired && (
        <div className="mb-4">
          <SessionExpiredBanner />
        </div>
      )}

      {!sessionExpired && error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* ── 1. Fire Incident Monitoring Board — main dashboard, first thing visible ── */}
      <div id="section-monitoring-board" className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-start mb-1">
          <div>
            <h2 className="text-xl font-bold text-bfp-navy">Fire Incident Monitoring Board</h2>
            <p className="text-sm text-gray-500 mb-4">Live totals for the current month, or browse a past month or year.</p>
          </div>
          <SectionMenu onPrint={() => handlePrint('section-monitoring-board')} onExport={handleExportMonitoringBoard} />
        </div>

        {/* Sub-tabs */}
        <div className="flex gap-2 mb-4">
          {[
            { key: 'current', label: 'This Month' },
            { key: 'monthly', label: 'By Month' },
            { key: 'yearly', label: 'By Year' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setBoardTab(tab.key); if (tab.key !== 'current') setHistData(null); }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                boardTab === tab.key
                  ? 'bg-bfp-navy text-white border-bfp-navy'
                  : 'bg-white text-bfp-navy border-bfp-navy hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Controls */}
        {boardTab !== 'current' && (
          <div className="flex gap-3 items-end flex-wrap mb-5">
            {boardTab === 'monthly' ? (
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
        )}

        {/* Results */}
        {boardTab !== 'current' && histData === null && (
          <p className="text-gray-400 text-sm text-center py-6">Loading data…</p>
        )}

        {(boardTab === 'current' || histData !== null) && (
          <>
            <h3 className="text-lg font-bold text-bfp-navy mb-3">
              {boardTab === 'current'
                ? `${currentMonthName} ${currentYear} — as of ${formatDate(asOf)}`
                : `${histLabel} — Fire Incident Summary`}
            </h3>

            {/* Category totals */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
              {[
                { label: 'Residential',     value: (boardTab === 'current' ? totals.residential : histTotals.residential) || 0, color: 'bg-blue-100 text-blue-800' },
                { label: 'Non-Residential', value: (boardTab === 'current' ? totals.nonResidential : histTotals.nonResidential) || 0, color: 'bg-red-100 text-red-800' },
                { label: 'Non-Structural',  value: (boardTab === 'current' ? totals.nonStructural : histTotals.nonStructural) || 0, color: 'bg-orange-100 text-orange-800' },
                { label: 'Transport',       value: (boardTab === 'current' ? totals.transport : histTotals.transport) || 0, color: 'bg-green-100 text-green-800' },
                { label: 'TOTAL',           value: (boardTab === 'current' ? totals.total : histTotals.total) || 0, color: 'bg-bfp-navy text-white' },
              ].map(({ label, value, color }) => (
                <div key={label} className={`rounded-lg p-3 text-center ${color}`}>
                  <div className="text-xs font-medium opacity-80">{label}</div>
                  <div className="text-2xl font-bold mt-0.5">{value}</div>
                </div>
              ))}
            </div>

            {/* Per-municipality breakdown */}
            {(boardTab === 'current' ? monitoringBoard : histData).length === 0 ? (
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
                    {(boardTab === 'current' ? monitoringBoard : histData).map((row) => (
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
                      <td className="text-right">{(boardTab === 'current' ? totals.residential : histTotals.residential) || 0}</td>
                      <td className="text-right">{(boardTab === 'current' ? totals.nonResidential : histTotals.nonResidential) || 0}</td>
                      <td className="text-right">{(boardTab === 'current' ? totals.nonStructural : histTotals.nonStructural) || 0}</td>
                      <td className="text-right">{(boardTab === 'current' ? totals.transport : histTotals.transport) || 0}</td>
                      <td className="text-right text-bfp-red text-lg">{(boardTab === 'current' ? totals.total : histTotals.total) || 0}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── 2. KPI Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
        <div className="kpi-card success">
          <div className="kpi-label">With Casualties</div>
          <div className="kpi-value">{kpis?.incidentsWithCasualties || 0}</div>
        </div>
      </div>

      {/* ── 2b. Municipality Fire Rate SVG Map ── */}
      <BenguetFireMap monitoringBoard={monitoringBoard} onPrint={() => handlePrint('section-fire-map')} onExport={handleExportFireMap} />

      {/* ── 4. Incident Trend Charts ── */}
      <div id="section-comparison" className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex justify-between items-start mb-5 flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-bold text-bfp-navy">Fire Incident Comparison</h2>
            <p className="text-sm text-gray-500 mt-1">Compare selected years or months to identify the highest fire incident period.</p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
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
            <SectionMenu onPrint={() => handlePrint('section-comparison')} onExport={handleExportComparison} />
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
                <Bar dataKey="Residential" stackId="a" fill={CATEGORY_CHART_COLORS.Residential} />
                <Bar dataKey="Non-Residential" stackId="a" fill={CATEGORY_CHART_COLORS['Non-Residential']} />
                <Bar dataKey="Non-Structural" stackId="a" fill={CATEGORY_CHART_COLORS['Non-Structural']} />
                <Bar dataKey="Transport" stackId="a" fill={CATEGORY_CHART_COLORS.Transport} radius={[4, 4, 0, 0]} />
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

      <div className="bg-bfp-navy/5 border-l-4 border-bfp-navy p-4 rounded">
        <p className="text-sm text-gray-700">
          <strong>Note:</strong> The monitoring board displays aggregated incident counts from submitted daily reports.
          Data is populated when municipal officers submit their Daily Reports through the system.
        </p>
      </div>
    </div>
  );
}
