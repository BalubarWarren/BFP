'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { formatDate, isAuthError } from '../../../lib/utils';
import SessionExpiredBanner from '../../../components/common/SessionExpiredBanner';
import StatusBadge from '../../../components/common/StatusBadge';
import {
  MoreVertical, Printer, Download, X, Home, Building2, TreePine, Truck,
  LayoutGrid, MapPin, Inbox, FileSearch,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CATEGORY_CHART_COLORS } from '../../../lib/constants';
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
              <Download className="w-4 h-4" /> Export PDF
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Benguet SVG Fire Rate Map ─────────────────────────────────────────────────
// Coordinates are scaled ~0.5x horizontally (vertical scale unchanged) from an earlier version so
// the province silhouette reads as tall/narrow — matching real Benguet's actual elongated shape —
// rather than the too-wide/short blob the unscaled hand-traced points produced.
const BENGUET_MUNICIPALITIES = [
  { code: 'BAKUN',    name: 'Bakun',        points: '77,86 128,76 144,117 136,173 108,183 81,158 71,117',           lx: 106, ly: 130 },
  { code: 'MANKAYAN', name: 'Mankayan',     points: '148,76 192,65 204,90 199,125 188,158 174,130 144,117',         lx: 178, ly: 109 },
  { code: 'KIBUNGAN', name: 'Kibungan',     points: '81,158 136,173 168,188 168,229 152,260 111,265 81,229 71,178', lx: 121, ly: 210 },
  { code: 'BUGUIAS',  name: 'Buguias',      points: '188,158 209,145 219,190 233,229 200,239 172,229 168,188',      lx: 198, ly: 197 },
  { code: 'KABAYAN',  name: 'Kabayan',      points: '172,229 200,239 233,229 241,270 237,331 204,341 167,337 172,290', lx: 203, ly: 283 },
  { code: 'KAPANGAN', name: 'Kapangan',     points: '71,219 87,249 120,265 120,321 91,331 63,300 59,249',           lx: 87,  ly: 276 },
  { code: 'ATOK',     name: 'Atok',         points: '120,265 152,260 172,229 172,290 167,337 131,341 120,321',      lx: 148, ly: 292 },
  { code: 'TUBLAY',   name: 'Tublay',       points: '120,321 131,341 144,331 144,372 128,382 116,362',              lx: 131, ly: 352 },
  { code: 'LT',       name: 'La Trinidad',  points: '128,382 144,372 152,392 148,423 132,423 124,402',              lx: 138, ly: 399 },
  { code: 'SABLAN',   name: 'Sablan',       points: '63,300 91,331 120,321 116,362 108,413 71,423 55,372',          lx: 89,  ly: 360 },
  { code: 'BOKOD',    name: 'Bokod',        points: '167,337 204,341 237,331 245,372 241,453 213,484 176,474 164,402', lx: 206, ly: 399 },
  { code: 'TUBA',     name: 'Tuba',         points: '71,423 108,413 128,453 142,464 148,484 132,515 99,525 63,505', lx: 111, ly: 473 },
  { code: 'ITOGON',   name: 'Itogon',       points: '142,464 152,443 176,474 213,484 221,494 217,525 152,525 148,484', lx: 178, ly: 487 },
];

// Baguio City — an independent city enclave surrounded by La Trinidad/Tuba/Itogon, not a Benguet
// municipality and not part of the fire incident data above; drawn only for geographic context.
const BAGUIO_SHAPE = { points: '132,423 148,423 152,443 142,464 128,453', markerX: 140, markerY: 435, labelX: 140, labelY: 462 };

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

  const labelFont = "'Georgia', 'Times New Roman', serif";

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
        <div className="relative flex-shrink-0" style={{ width: 230 }}>
          <svg viewBox="0 0 270 545" width="100%">
            <text x="135" y="20" textAnchor="middle" style={{ fontSize: 11, fontWeight: 700, fill: '#1a3c6e', letterSpacing: 1, fontFamily: labelFont }}>
              PROVINCE OF BENGUET
            </text>

            {/* Compass rose — tucked into the empty corner above/left of Bakun */}
            <g transform="translate(40, 32)" style={{ pointerEvents: 'none' }}>
              <polygon points="0,-12 4,0 0,12 -4,0" fill="#CC0000" />
              <polygon points="-12,0 0,-4 12,0 0,4" fill="#4b5563" />
              <text x="0" y="-15" textAnchor="middle" style={{ fontSize: 8, fontWeight: 800, fill: '#1a3c6e' }}>N</text>
              <text x="0" y="20" textAnchor="middle" style={{ fontSize: 8, fontWeight: 800, fill: '#1a3c6e' }}>S</text>
              <text x="-16" y="3" textAnchor="middle" style={{ fontSize: 8, fontWeight: 800, fill: '#1a3c6e' }}>W</text>
              <text x="16" y="3" textAnchor="middle" style={{ fontSize: 8, fontWeight: 800, fill: '#1a3c6e' }}>E</text>
            </g>

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
                    style={{ fontSize: small ? 5.5 : 7, fontWeight: 700, fontStyle: 'italic', fontFamily: labelFont, fill: val === 0 ? '#6b7280' : '#fff', pointerEvents: 'none', paintOrder: 'stroke', stroke: val === 0 ? 'none' : 'rgba(0,0,0,0.25)', strokeWidth: 3 }}>
                    {mun.code === 'LT' ? '★ La Trinidad' : mun.name}
                  </text>
                  {val > 0 && (
                    <text x={mun.lx} y={mun.ly + (small ? 7 : 9)} textAnchor="middle"
                      style={{ fontSize: small ? 6 : 8.5, fontWeight: 800, fill: '#fff', pointerEvents: 'none', paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.25)', strokeWidth: 3 }}>
                      {val}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Baguio City — independent city enclave, not a Benguet municipality and not part of the
                fire incident data above; shown only for geographic context, like the reference map. */}
            <g style={{ pointerEvents: 'none' }}>
              <polygon points={BAGUIO_SHAPE.points} fill="#fef3c7" stroke="white" strokeWidth={1.5} />
              <rect x={BAGUIO_SHAPE.markerX - 2.5} y={BAGUIO_SHAPE.markerY - 2.5} width="5" height="5" fill="#dc2626" stroke="#7f1d1d" strokeWidth={0.6} />
              <text x={BAGUIO_SHAPE.labelX} y={BAGUIO_SHAPE.labelY} textAnchor="middle" style={{ fontSize: 4.5, fontWeight: 700, fontStyle: 'italic', fontFamily: labelFont, fill: '#6b7280' }}>
                Baguio
              </text>
            </g>
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

          {/* Map markers legend */}
          <div>
            <p className="text-xs font-bold uppercase text-gray-500 mb-2">Map Markers</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-5 flex-shrink-0 text-center text-bfp-gold">&#9733;</span>
                <span className="text-xs text-gray-600">Provincial capital (La Trinidad)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                  <span className="w-2.5 h-2.5 bg-bfp-red border border-red-900" />
                </span>
                <span className="text-xs text-gray-600">Highly urbanized city (Baguio, independent — no data)</span>
              </div>
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

  // Clicking a category tile opens a drill-down modal: a per-municipality breakdown for just
  // that category, plus the individually filed Spot Investigation reports behind it (only reports
  // that have actually reached the provincial level — Provincial Chief IIS/Marshal/Chief
  // Investigator IIS — count here; ones still sitting with a municipal reviewer don't yet). The
  // daily tally counts that make up part of each total have no per-incident record — see the
  // reconciliation note rendered in the modal — so the report list will usually be shorter than
  // the tile's own number, and that's expected rather than a bug.
  const [reportsByCategory, setReportsByCategory] = useState({});
  const [histReportsByCategory, setHistReportsByCategory] = useState({});
  const [categoryModal, setCategoryModal] = useState(null); // { field, label } | null

  // Sub-category breakdown view: only sub-categories with an actual reported count are shown.
  const [showSubCategories, setShowSubCategories] = useState(false);
  const [subCategoryTotals, setSubCategoryTotals] = useState({});
  const [histSubCategoryTotals, setHistSubCategoryTotals] = useState({});

  const CATEGORY_TILE_META = {
    residential: { label: 'Residential', accent: 'text-blue-800', chip: 'bg-blue-50', solid: 'bg-blue-600', ring: 'ring-blue-100', bar: 'bg-blue-500', icon: Home },
    nonResidential: { label: 'Non-Residential', accent: 'text-red-800', chip: 'bg-red-50', solid: 'bg-red-600', ring: 'ring-red-100', bar: 'bg-red-500', icon: Building2 },
    nonStructural: { label: 'Non-Structural', accent: 'text-orange-800', chip: 'bg-orange-50', solid: 'bg-orange-600', ring: 'ring-orange-100', bar: 'bg-orange-500', icon: TreePine },
    transport: { label: 'Transport', accent: 'text-green-800', chip: 'bg-green-50', solid: 'bg-green-600', ring: 'ring-green-100', bar: 'bg-green-500', icon: Truck },
    total: { label: 'Total', accent: 'text-bfp-navy', chip: 'bg-bfp-navy/10', solid: 'bg-bfp-navy', ring: 'ring-bfp-navy/10', bar: 'bg-bfp-navy', icon: LayoutGrid },
  };

  const getCategoryDrilldown = (field) => {
    const rows = boardTab === 'current' ? monitoringBoard : (histData || []);
    const totalsSource = boardTab === 'current' ? totals : histTotals;
    const byCategory = boardTab === 'current' ? reportsByCategory : histReportsByCategory;

    const municipalityRows = rows
      .map((row) => ({ municipality: row.municipality, count: row[field] || 0 }))
      .filter((row) => row.count > 0)
      .sort((a, b) => b.count - a.count);

    const reports = field === 'total'
      ? ['residential', 'nonResidential', 'nonStructural', 'transport']
          .flatMap((f) => byCategory[f] || [])
          .sort((a, b) => new Date(b.reportDate) - new Date(a.reportDate))
      : (byCategory[field] || []);

    const total = totalsSource[field] || 0;
    const individualCount = reports.length;
    const tallyCount = Math.max(total - individualCount, 0);

    return { municipalityRows, reports, total, individualCount, tallyCount };
  };

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
      setReportsByCategory(boardResponse.data.reportsByCategory || {});
      setSubCategoryTotals(boardResponse.data.subCategoryTotals || {});
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
      setHistReportsByCategory(resp.data.reportsByCategory || {});
      setHistSubCategoryTotals(resp.data.subCategoryTotals || {});
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

  const downloadPdf = (filename, title, header, rows) => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text('BFP Benguet Fire Incident Report', 14, 16);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(title, 14, 23);
    autoTable(doc, {
      startY: 28,
      head: [header],
      body: rows,
      headStyles: { fillColor: [26, 60, 110] },
      styles: { fontSize: 9 },
    });
    doc.save(filename);
  };

  const exportBoardPdf = (rows, rowTotals, periodLabel) => {
    const header = ['Municipality', 'Residential', 'Non-Residential', 'Non-Structural', 'Transport', 'Total'];
    const body = [
      ...rows.map((row) => [row.municipality, row.residential, row.nonResidential, row.nonStructural, row.transport, row.total]),
      ['TOTAL', rowTotals.residential || 0, rowTotals.nonResidential || 0, rowTotals.nonStructural || 0, rowTotals.transport || 0, rowTotals.total || 0],
    ];
    downloadPdf(
      `bfp-benguet-monitoring-board-${periodLabel.replace(/\s+/g, '-').toLowerCase()}.pdf`,
      `Fire Incident Monitoring Board - ${periodLabel}`,
      header,
      body
    );
  };

  const handleExportMonitoringBoard = () => {
    const rows = boardTab === 'current' ? monitoringBoard : (histData || []);
    const rowTotals = boardTab === 'current' ? totals : histTotals;
    const periodLabel = boardTab === 'current'
      ? new Date().toLocaleString('default', { month: 'long', year: 'numeric' })
      : histLabel;
    exportBoardPdf(rows, rowTotals, periodLabel);
  };

  const handleExportFireMap = () => {
    const periodLabel = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    exportBoardPdf(monitoringBoard, totals, periodLabel);
  };

  const handleExportComparison = () => {
    const header = ['Period', 'Residential', 'Non-Residential', 'Non-Structural', 'Transport', 'Total'];
    const body = trendComparisonData.map((row) => [
      row.period,
      row.Residential || 0,
      row['Non-Residential'] || 0,
      row['Non-Structural'] || 0,
      row.Transport || 0,
      row.total || 0,
    ]);
    downloadPdf('bfp-benguet-fire-incident-comparison.pdf', 'Fire Incident Comparison', header, body);
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
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="text-lg font-bold text-bfp-navy">
                {boardTab === 'current'
                  ? `${currentMonthName} ${currentYear} — as of ${formatDate(asOf)}`
                  : `${histLabel} — Fire Incident Summary`}
              </h3>
              <button
                type="button"
                onClick={() => setShowSubCategories((v) => !v)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  showSubCategories
                    ? 'bg-bfp-navy text-white border-bfp-navy'
                    : 'bg-white text-bfp-navy border-bfp-navy hover:bg-gray-50'
                }`}
              >
                {showSubCategories ? 'Category View' : 'Category + Sub-Category View'}
              </button>
            </div>

            {showSubCategories ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                {['residential', 'nonResidential', 'nonStructural', 'transport'].map((field) => {
                  const meta = CATEGORY_TILE_META[field];
                  const activeTotals = boardTab === 'current' ? totals : histTotals;
                  const activeSubTotals = boardTab === 'current' ? subCategoryTotals : histSubCategoryTotals;
                  const subEntries = Object.entries(activeSubTotals[field] || {}).sort((a, b) => b[1] - a[1]);
                  return (
                    <div key={field} className={`rounded-lg p-3 ${meta.chip}`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold uppercase ${meta.accent}`}>{meta.label}</span>
                        <span className={`text-lg font-bold ${meta.accent}`}>{activeTotals[field] || 0}</span>
                      </div>
                      {subEntries.length === 0 ? (
                        <p className="text-xs text-gray-400 mt-2 italic">No sub-category data reported yet</p>
                      ) : (
                        <ul className="mt-2 space-y-1">
                          {subEntries.map(([sub, count]) => (
                            <li key={sub} className="flex items-center justify-between gap-2 text-xs text-gray-700">
                              <span className="truncate">{sub}</span>
                              <span className="font-semibold flex-shrink-0">{count}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Category totals */
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
                {[
                  { label: 'Residential',     field: 'residential',     value: (boardTab === 'current' ? totals.residential : histTotals.residential) || 0, color: 'bg-blue-100 text-blue-800' },
                  { label: 'Non-Residential', field: 'nonResidential',  value: (boardTab === 'current' ? totals.nonResidential : histTotals.nonResidential) || 0, color: 'bg-red-100 text-red-800' },
                  { label: 'Non-Structural',  field: 'nonStructural',   value: (boardTab === 'current' ? totals.nonStructural : histTotals.nonStructural) || 0, color: 'bg-orange-100 text-orange-800' },
                  { label: 'Transport',       field: 'transport',       value: (boardTab === 'current' ? totals.transport : histTotals.transport) || 0, color: 'bg-green-100 text-green-800' },
                  { label: 'TOTAL',           field: 'total',           value: (boardTab === 'current' ? totals.total : histTotals.total) || 0, color: 'bg-bfp-navy text-white' },
                ].map(({ label, field, value, color }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setCategoryModal({ field, label })}
                    title={`View ${label.toLowerCase()} breakdown`}
                    className={`rounded-lg p-3 text-center transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-bfp-navy ${color}`}
                  >
                    <div className="text-xs font-medium opacity-80">{label}</div>
                    <div className="text-2xl font-bold mt-0.5">{value}</div>
                  </button>
                ))}
              </div>
            )}

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

      {/* Category drill-down modal */}
      {categoryModal && (() => {
        const { field, label } = categoryModal;
        const { municipalityRows, reports, total, individualCount, tallyCount } = getCategoryDrilldown(field);
        const meta = CATEGORY_TILE_META[field];
        const Icon = meta.icon;
        const periodLabel = boardTab === 'current' ? `${currentMonthName} ${currentYear}` : histLabel;
        const maxMunicipalityCount = Math.max(1, ...municipalityRows.map((row) => row.count));

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
            onClick={() => setCategoryModal(null)}
          >
            <div
              className="modal-pop-in flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className={`flex items-start justify-between gap-4 border-b border-gray-100 p-6 ${meta.chip}`}>
                <div className="flex items-center gap-4">
                  <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${meta.solid}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{periodLabel}</p>
                    <h2 className={`text-2xl font-bold leading-tight ${meta.accent}`}>{label}</h2>
                  </div>
                </div>
                <button
                  onClick={() => setCategoryModal(null)}
                  aria-label="Close"
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/70 text-gray-500 shadow-sm transition hover:bg-white hover:text-gray-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-6 overflow-y-auto p-6">
                {/* Stat strip */}
                <div className="grid grid-cols-3 gap-3">
                  <div className={`rounded-xl p-3 text-center ${meta.chip}`}>
                    <p className={`text-2xl font-bold ${meta.accent}`}>{total}</p>
                    <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Total</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-3 text-center">
                    <p className="text-2xl font-bold text-gray-800">{individualCount}</p>
                    <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Filed Reports</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-3 text-center">
                    <p className="text-2xl font-bold text-gray-800">{tallyCount}</p>
                    <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Daily Tallies</p>
                  </div>
                </div>
                {tallyCount > 0 && (
                  <p className="-mt-4 text-xs text-gray-400">
                    Daily tallies are aggregate counts from municipalities&rsquo; Daily Reports and have no individual record to list below.
                  </p>
                )}

                {/* By Municipality */}
                <div>
                  <h3 className="mb-2 flex items-center gap-1.5 font-bold text-bfp-navy">
                    <MapPin className="h-4 w-4" /> By Municipality
                  </h3>
                  {municipalityRows.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-200 py-8 text-center">
                      <Inbox className="h-6 w-6 text-gray-300" />
                      <p className="text-sm text-gray-400">No incidents recorded in this category for this period.</p>
                    </div>
                  ) : (
                    <ul className="space-y-1.5">
                      {municipalityRows.map((row, idx) => (
                        <li key={row.municipality} className="relative overflow-hidden rounded-lg bg-gray-50">
                          <div
                            className={`absolute inset-y-0 left-0 opacity-15 ${meta.bar}`}
                            style={{ width: `${(row.count / maxMunicipalityCount) * 100}%` }}
                          />
                          <div className="relative flex items-center justify-between px-4 py-2.5 text-sm">
                            <span className="flex items-center gap-2.5 text-gray-700">
                              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold text-gray-400 shadow-sm">
                                {idx + 1}
                              </span>
                              {row.municipality}
                            </span>
                            <span className={`font-bold ${meta.accent}`}>{row.count}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Filed Spot Investigation Reports */}
                <div>
                  <h3 className="mb-2 flex items-center gap-1.5 font-bold text-bfp-navy">
                    <FileSearch className="h-4 w-4" /> Filed Spot Investigation Reports ({reports.length})
                  </h3>
                  {reports.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-200 py-8 text-center">
                      <Inbox className="h-6 w-6 text-gray-300" />
                      <p className="max-w-sm text-sm text-gray-400">
                        No individually filed reports in this category for this period — the count above comes
                        entirely from municipalities&rsquo; daily tallies.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Reference #</th>
                            <th>Municipality</th>
                            <th>Date</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reports.map((report) => (
                            <tr key={report.id}>
                              <td className="font-semibold">{report.referenceNumber || `#${report.id}`}</td>
                              <td>{report.municipality}</td>
                              <td>{new Date(report.reportDate).toLocaleDateString()}</td>
                              <td><StatusBadge status={report.status} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end border-t border-gray-100 bg-gray-50 px-6 py-4">
                <button onClick={() => setCategoryModal(null)} className="btn btn-secondary px-6">
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
                      ? 'bg-bfp-navy text-white border-bfp-navy'
                      : 'bg-white text-bfp-navy border-gray-300 hover:border-bfp-navy'
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
                          ? 'bg-bfp-navy text-white border-bfp-navy'
                          : 'bg-white text-bfp-navy border-gray-300 hover:border-bfp-navy'
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
          <strong>Note:</strong> The monitoring board displays aggregated incident counts from submitted daily reports,
          plus categorized Spot Investigation reports once they reach the provincial level. Data is populated when
          municipal officers submit their Daily Reports, or when an investigation report is passed up to the
          Provincial Chief IIS (or Marshal/Chief Investigator IIS).
        </p>
      </div>
    </div>
  );
}
