'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { formatDate, isAuthError } from '../../../lib/utils';
import SessionExpiredBanner from '../../../components/common/SessionExpiredBanner';
import StatusBadge from '../../../components/common/StatusBadge';
import {
  MoreVertical, Printer, Download, X, Home, Building2, TreePine, Truck,
  LayoutGrid, MapPin, Inbox, FileSearch, CalendarDays, CalendarRange, Flame, HeartPulse,
} from 'lucide-react';
import PageHeader from '../../../components/common/PageHeader';
import StatCard from '../../../components/common/StatCard';
import MunicipalityDetailModal from '../../../components/dashboard/MunicipalityDetailModal';
import AttachmentList from '../../../components/reports/AttachmentList';
import ReportQrButton from '../../../components/reports/ReportQrButton';
import ReportDetailsModal from '../../../components/reports/ReportDetailsModal';
import { useEscapeKey } from '../../../hooks/useEscapeKey';
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
// Outlines are the official NAMRIA / PSA municipal boundaries (geoBoundaries PHL ADM3, CC BY 3.0
// IGO), projected into this SVG once — neighbouring municipalities share exact border points, so
// there are no gaps or overlaps. lx/ly is the label spot (the point farthest from the edges).
const BENGUET_MUNICIPALITIES = [
  { code: 'ATOK',     name: 'Atok',        lx: 140, ly: 236, points: '187.6,182.2 183,181.6 176.3,182.2 173.2,183.3 160.2,182.5 159.6,183.3 158.7,183 158,185.8 159.3,186.3 158.7,187.8 160,188.4 160.9,190.5 158.8,192.9 157.2,193.4 156.7,196.3 157.2,198.3 154.8,199.8 154.3,201.4 152.8,201.8 151.3,200.5 149.1,202.6 149.4,201.4 143.5,200.6 136.2,200.9 132,208.4 128.7,211.3 127.1,211.7 126.7,212.9 124.1,213.8 113.7,223.3 113.2,244.3 114.5,251.3 116.7,262.9 118.7,266.2 120.5,267.2 121.9,269.2 121.9,270.4 123.5,270.4 126.1,273.4 127,273.4 131.4,280.3 140.6,276 143.5,271.6 147.2,268.2 157.4,261.2 161,252.8 166.1,245.7 168.1,244.8 171.1,241.4 177.2,223.2 179,221.3 181.5,216 182.7,209.9 186.4,208.4 184.8,201.7 187.4,195.1 186.4,189.1 187.7,184.5' },
  { code: 'BAKUN',    name: 'Bakun',       lx: 132, ly: 92, points: '83.5,96.7 83,105.7 84.5,129.5 84.5,131.3 83.6,132.4 84.7,134.3 85.4,145.2 90.3,150.1 100.1,152.3 104.9,152.1 111.9,150.1 117.4,147.4 125.5,141.5 128.3,138 132,125.5 133.7,124.2 138.2,126.5 157.4,155.9 160.4,157.5 166.3,163.2 177.1,164.1 177.3,162.2 179.4,161.2 179.7,160.1 180.6,160.3 181.2,159.2 184.7,158.8 185.7,157.5 187.6,156.9 188.1,155 189.9,155.6 192.6,155.1 193,153.8 194.9,153.1 195.2,149.9 194.2,149.3 193.9,147.1 195.2,145.1 195,142.4 195.7,140.9 195.2,140.2 197.1,140.7 197.7,139.9 197.2,139.1 197.9,138.7 197.4,137.9 197.9,137.6 197,137.1 198.3,135.4 197.7,134.7 196.5,135.4 196.8,134.5 186.6,129.3 177.8,115.9 178.4,114.7 177.8,110.5 176.1,108.4 174.2,107.5 172.8,108.2 172.5,107 171.3,107.8 170.6,106.3 168.7,106.5 167.4,105.5 166.5,102.4 167.3,101.5 166.7,100.7 167.7,100.3 166.5,99.7 165.4,100.8 162.2,76.1 161.1,77 159.7,74.2 160.9,73.2 159.3,71.3 160.6,70.5 160.6,69.5 158,69.7 158.4,66 160.1,65.2 159.2,64.7 159.5,63.2 161.3,63.4 162.7,62.2 162.2,60.9 160.2,61 157.8,59.9 159.3,59.3 158.7,58.3 159.7,55.7 161.3,55.7 160.4,54.4 151.9,54.3 126.9,55.9 122,57.5 120.5,61.6 113.8,63.8 103.5,74.4 97.5,85.7 96,94.9' },
  { code: 'BOKOD',    name: 'Bokod',       lx: 195, ly: 288, points: '131.4,280.3 133.1,282.5 139.7,283.7 143,286.7 142.4,287.7 140.6,287.6 138.8,289.2 141,294.7 146.7,291.9 149.4,292.7 150,292.2 149.9,293.3 151.6,292.8 150.7,294 151.7,294.1 153.8,298 152.1,312.4 145.7,320.8 161.3,321.9 172.2,323.7 188.3,353.1 192.7,370.3 194.7,385.1 201.5,385.8 203,380.6 206.7,377.6 209.4,377 218.4,377.1 226.1,358.7 227.9,347.1 231.7,342 235.3,321.8 241.2,313.9 237.9,276.3 242.6,247.6 222.2,249 197.6,245 192.8,242.2 171.1,241.4 168.1,244.8 166.1,245.7 161,252.8 157.4,261.2 147.2,268.2 143.5,271.6 140.6,276' },
  { code: 'BUGUIAS',  name: 'Buguias',     lx: 219, ly: 157, points: '187.6,182.2 193.8,183.4 215.7,182.8 228.4,180.1 243.7,174.7 243.4,147.2 245.9,129.4 242.7,108.5 243,105.2 239.5,101.7 233.5,101.8 231.1,100.6 224.2,93.9 220.1,94.9 219.1,95.8 219.7,97 218.2,97.4 214.4,102.5 213.2,102 211.9,103.3 210.1,108.7 204,116.4 203.2,119.6 201.8,120.6 200.3,124.8 200.7,125.2 199.9,125.7 200.5,125.9 199.9,128.3 199,127.4 197.3,132.9 196.4,133.2 196.8,134.5 196.5,135.4 197.7,134.7 198.3,135.4 197,137.1 197.9,137.6 197.4,137.9 197.9,138.7 197.2,139.1 197.7,139.9 197.1,140.7 195.2,140.2 195.7,140.9 195,142.4 195.2,145.1 193.9,147.1 194.2,149.3 195.2,149.9 194.9,153.1 193,153.8 192.6,155.1 189.9,155.6 188.1,155 187.6,156.9 185.7,157.5 184.7,158.8 181.2,159.2 180.6,160.3 179.7,160.1 179.4,161.2 177.3,162.2 177.1,164.1 166.3,163.2 170.5,174.5 170.1,175.1 172,177 172,180.2 173.4,181.3 173.2,183.3 176.3,182.2 183,181.6' },
  { code: 'ITOGON',   name: 'Itogon',      lx: 155, ly: 383, points: '105.6,353.5 108.2,356.3 107.1,358.7 107.3,363.3 111.5,370 115.1,372.2 116.3,381.7 115,384.8 111.4,387.8 112,394.2 114.5,397.3 115.1,399.9 113.2,408.4 110.5,409.4 110,410.6 109.4,413.6 110.4,416.7 109.3,419.3 109.3,429.2 104,443 106.4,444 106,445.8 107.7,447.4 106.7,449.6 107.6,450.6 133.4,450.6 141.6,446.8 151.6,445.8 178.6,443 187.6,411.6 194.7,385.1 192.7,370.3 188.3,353.1 172.2,323.7 161.3,321.9 145.7,320.8 152.1,312.4 153.8,298 151.7,294.1 150.7,294 151.6,292.8 149.9,293.3 150,292.2 149.4,292.7 146.7,291.9 141,294.7 122.4,303.7 121.2,303.3 121.5,302 113.4,310.4 113.8,313 114.4,313.1 112.6,317.8 106.1,318 108,335.2 109.5,341 108.5,353.7' },
  { code: 'KABAYAN',  name: 'Kabayan',     lx: 219, ly: 215, points: '171.1,241.4 192.8,242.2 197.6,245 222.2,249 242.6,247.6 249,227.6 262,225 254.5,208.8 243.7,174.7 228.4,180.1 215.7,182.8 193.8,183.4 187.6,182.2 187.7,184.5 186.4,189.1 187.4,195.1 184.8,201.7 186.4,208.4 182.7,209.9 181.5,216 179,221.3 177.2,223.2' },
  { code: 'KAPANGAN', name: 'Kapangan',    lx: 84, ly: 225, points: '132,208.4 127.8,204.9 125.6,201.4 107.9,191.5 81.5,174.9 77.5,186.4 75.9,185.7 72.6,187.2 60.2,204.4 48.1,227.9 45,240.4 47.1,240.7 47.7,242.1 45.7,245.5 47.3,247.8 45.3,252 74.6,253.6 84.4,255.7 100.1,255.2 114.5,251.3 113.2,244.3 113.7,223.3 124.1,213.8 126.7,212.9 127.1,211.7 128.7,211.3' },
  { code: 'KIBUNGAN', name: 'Kibungan',    lx: 132, ly: 172, points: '173.2,183.3 173.4,181.3 172,180.2 172,177 170.1,175.1 170.5,174.5 166.3,163.2 160.4,157.5 157.4,155.9 138.2,126.5 133.7,124.2 132,125.5 128.3,138 125.5,141.5 117.4,147.4 111.9,150.1 104.9,152.1 100.1,152.3 90.3,150.1 81.5,174.9 107.9,191.5 125.6,201.4 127.8,204.9 132,208.4 136.2,200.9 143.5,200.6 149.4,201.4 149.1,202.6 151.3,200.5 152.8,201.8 154.3,201.4 154.8,199.8 157.2,198.3 156.7,196.3 157.2,193.4 158.8,192.9 160.9,190.5 160,188.4 158.7,187.8 159.3,186.3 158,185.8 158.7,183 159.6,183.3 160.2,182.5' },
  { code: 'LT',       name: 'La Trinidad', lx: 84, ly: 298, points: '106.1,318 112.6,317.8 114.4,313.1 113.8,313 113.4,310.4 121.5,302 118.4,301 118,298.9 117,299 116.5,297.8 106.4,295.3 101.2,284.8 92,280.7 90.1,281 89,280.1 84.7,278.9 81.9,276.8 79.1,271.9 78,272.3 77,274.1 75.1,274.9 70.2,273.7 66.2,298.4 64.2,302.6 62.7,308.8 61.4,313.6 62.3,314.8 78.9,315.1 82.2,316 88.2,315.8 89.9,316.6 92.1,316.4 92.1,317.3 94.9,316.3 98.3,318' },
  { code: 'MANKAYAN', name: 'Mankayan',    lx: 191, ly: 88, points: '196.8,134.5 196.4,133.2 197.3,132.9 199,127.4 199.9,128.3 200.5,125.9 199.9,125.7 200.7,125.2 200.3,124.8 201.8,120.6 203.2,119.6 204,116.4 210.1,108.7 211.9,103.3 213.2,102 214.4,102.5 218.2,97.4 219.7,97 219.1,95.8 220.1,94.9 224.2,93.9 224,87.3 221.7,85.3 222.9,83.6 221.9,81.9 221.2,76.3 220.7,65.6 221.2,63.5 220.1,61.9 216.2,58.8 205.8,61.5 200.8,64.4 195.3,63.1 192.7,62.2 187,50.8 179.4,50.9 173.3,48 167.4,48 167,49.6 163.9,52.8 162.8,53.7 161.6,53.1 160.4,54.4 161.3,55.7 159.7,55.7 158.7,58.3 159.3,59.3 157.8,59.9 160.2,61 162.2,60.9 162.7,62.2 161.3,63.4 159.5,63.2 159.2,64.7 160.1,65.2 158.4,66 158,69.7 160.6,69.5 160.6,70.5 159.3,71.3 160.9,73.2 159.7,74.2 161.1,77 162.2,76.1 165.4,100.8 166.5,99.7 167.7,100.3 166.7,100.7 167.3,101.5 166.5,102.4 167.4,105.5 168.7,106.5 170.6,106.3 171.3,107.8 172.5,107 172.8,108.2 174.2,107.5 176.1,108.4 177.8,110.5 178.4,114.7 177.8,115.9 186.6,129.3' },
  { code: 'SABLAN',   name: 'Sablan',      lx: 46, ly: 280, points: '24.4,305.6 39.4,306.9 44.8,308.2 59,309.2 59.4,308.6 62.7,308.8 64.2,302.6 66.2,298.4 70.2,273.7 75.1,274.9 77,274.1 78,272.3 78,270.5 73.4,259.8 74.6,253.6 45.3,252 32.6,257.1 27.5,263 27.9,266.9 22.7,274.7 21.8,277.8 23.8,286 24.1,290.3 24.8,294.1' },
  { code: 'TUBA',     name: 'Tuba',        lx: 77, ly: 386, points: '10,341 22.7,344.5 30.7,355.8 29.6,358.2 27.9,357.7 29.2,360.3 28.3,361.3 28.8,361.9 36,361.8 36.9,363.1 35.3,364.9 37.1,365.9 36.8,368.4 35,368.3 34.8,369.8 33.9,370.1 38.3,375.2 37.4,380.7 39.2,391.3 40.2,391.5 42.2,394.6 44.3,400.8 45.3,409.5 47.5,415.1 44.9,424.5 49.3,423.8 61,429.9 68.9,431.9 105.5,452.4 106.5,452.5 106.4,451.4 107.6,450.6 106.7,449.6 107.7,447.4 106,445.8 106.4,444 104,443 109.3,429.2 109.3,419.3 110.4,416.7 109.4,413.6 110,410.6 110.5,409.4 113.2,408.4 115.1,399.9 114.5,397.3 112,394.2 111.4,387.8 115,384.8 116.3,381.7 115.1,372.2 111.5,370 107.3,363.3 107.1,358.7 108.2,356.3 105.6,353.5 101.3,356.5 97,355.6 93.4,352.9 93.6,351.7 91.4,352.2 74.9,349.6 74.1,348.7 74.2,346.8 72,344.3 72.1,338.5 74,337.9 76.7,338.8 75.6,337.7 75.8,336.4 74.7,333.6 69.1,331.8 67.1,330.3 68.4,329.1 61.8,318.1 62.3,314.8 61.4,313.6 62.7,308.8 59.4,308.6 59,309.2 44.8,308.2 39.4,306.9 24.4,305.6 22.6,315.8 23.2,320 21.5,320.6 21.9,323.3 17.5,324.4 14.5,329.4 12.9,328.8 12.9,330.1 15.5,330.8 14.8,335.1 11.7,337.6 12.3,339.6 10.1,340.2' },
  { code: 'TUBLAY',   name: 'Tublay',      lx: 103, ly: 270, points: '114.5,251.3 100.1,255.2 84.4,255.7 74.6,253.6 73.4,259.8 78,270.5 78,272.3 79.1,271.9 81.9,276.8 84.7,278.9 89,280.1 90.1,281 92,280.7 101.2,284.8 106.4,295.3 116.5,297.8 117,299 118,298.9 118.4,301 121.5,302 121.2,303.3 122.4,303.7 141,294.7 138.8,289.2 140.6,287.6 142.4,287.7 143,286.7 139.7,283.7 133.1,282.5 131.4,280.3 127,273.4 126.1,273.4 123.5,270.4 121.9,270.4 121.9,269.2 120.5,267.2 118.7,266.2 116.7,262.9' },
];

// Baguio City — an independent city enclave surrounded by La Trinidad/Tuba/Itogon, not a Benguet
// municipality and not part of the fire incident data above; drawn only for geographic context.
const BAGUIO_SHAPE = { markerX: 92, markerY: 331, labelX: 92, labelY: 340, points: '62.3,314.8 61.8,318.1 68.4,329.1 67.1,330.3 69.1,331.8 74.7,333.6 75.8,336.4 75.6,337.7 76.7,338.8 74,337.9 72.1,338.5 72,344.3 74.2,346.8 74.1,348.7 74.9,349.6 91.4,352.2 93.6,351.7 93.4,352.9 97,355.6 101.3,356.5 105.6,353.5 108.5,353.7 109.5,341 108,335.2 106.1,318 98.3,318 94.9,316.3 92.1,317.3 92.1,316.4 89.9,316.6 88.2,315.8 82.2,316 78.9,315.1' };

// A municipality's rank by total incidents, where ties share a rank: totals 33, 15, 15, 14 rank
// #1, #2, #2, #4. (Rank by sorted position would rank tied municipalities by alphabetical order.)
function rankByTotal(rows, row) {
  return rows.filter((other) => (other.total || 0) > (row.total || 0)).length + 1;
}

function BenguetFireMap({ monitoringBoard, periodLabel, onPrint, onExport, onSelect }) {
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

  const rankMap = {};
  monitoringBoard.forEach((m) => { rankMap[m.code] = rankByTotal(monitoringBoard, m); });

  const labelFont = "'Georgia', 'Times New Roman', serif";

  return (
    <div id="section-fire-map" className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-6">
      <div className="flex justify-between items-start gap-3 mb-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-gray-900">Municipality Fire Incident Rate Map</h2>
          <p className="text-sm text-gray-500">
            {periodLabel && <span className="font-semibold text-bfp-navy">{periodLabel} · </span>}
            Color shows relative fire incident rate — green (lowest) to red (highest). Click a municipality for details.
          </p>
        </div>
        {onPrint && <SectionMenu onPrint={onPrint} onExport={onExport} />}
      </div>
      <div className="flex flex-wrap gap-6">
        {/* SVG Map */}
        <div className="relative mx-auto flex-shrink-0 sm:mx-0" style={{ width: 230 }}>
          <svg viewBox="0 0 270 462" width="100%">
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
                  role="button"
                  tabIndex={0}
                  aria-label={`View ${mun.name} incident information`}
                  onClick={() => onSelect?.(mun.code)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(mun.code); } }}
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

const ANALYTICS_REFRESH_MS = 5 * 60 * 1000;

// Category labels as the analytics endpoint keys them (also the chart's bar dataKeys).
const COMPARISON_CATEGORIES = ['Residential', 'Non-Residential', 'Non-Structural', 'Transport'];

// A category's sub-category counts (e.g. Forest 11, Grass 3 under Non-Structural), largest first.
// Only sub-categories that actually have incidents are listed; a category with no sub-category
// data shows nothing extra. When the listed ones don't account for the whole category total
// (some incidents were recorded without a sub-category) the rest shows as "Unspecified".
function SubCategoryBreakdown({ total, subs, className = '' }) {
  const entries = Object.entries(subs || {}).filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  const unspecified = total - entries.reduce((sum, [, count]) => sum + count, 0);
  if (unspecified > 0) entries.push(['Unspecified', unspecified]);
  return (
    <ul className={`space-y-0.5 text-xs text-gray-600 ${className}`}>
      {entries.map(([sub, count]) => (
        <li key={sub} className="flex items-center justify-between gap-2">
          <span className="truncate text-left">{sub}</span>
          <span className="flex-shrink-0 font-semibold">{count}</span>
        </li>
      ))}
    </ul>
  );
}

// One automatic retry for failures that are likely transient (network error, timeout, 5xx) —
// never for 4xx, which won't change on a retry.
const getWithRetry = async (url, headers) => {
  try {
    return await axios.get(url, { headers });
  } catch (err) {
    const status = err.response?.status;
    if (status && status < 500) throw err;
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return axios.get(url, { headers });
  }
};

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
  // A filed report from the classification popup, opened in full on top of it.
  const [categoryViewReport, setCategoryViewReport] = useState(null);
  useEscapeKey(() => setCategoryModal(null), !!categoryModal);

  // Clicking a municipality (Monitoring Board row or map) opens its detail modal. The map always
  // shows the current month; the board shows whichever tab is active.
  const [municipalityModal, setMunicipalityModal] = useState(null); // { code, source: 'board' | 'map' } | null

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

    // Skip the tick while this tab isn't visible — the `focus` listener below already
    // re-fetches once the user comes back, so a background tab doesn't keep hitting the DB.
    pollRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') fetchDashboardData({ silent: true });
    }, 15000);
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

  // The monitoring board is the live part (polled every 15s); the analytics charts are heavy
  // (a dozen queries) and change slowly, so they're only re-fetched every few minutes.
  const lastAnalyticsAtRef = useRef(0);

  const fetchDashboardData = async ({ silent } = {}) => {
    if (!silent) setLoading(true);
    const token = sessionStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    const needsAnalytics = !silent || Date.now() - lastAnalyticsAtRef.current > ANALYTICS_REFRESH_MS;

    // Each part loads (and fails) on its own — one slow or failed request no longer blanks the
    // whole dashboard — and a failure is retried once, since the usual cause is a transient cold
    // start or a momentarily busy database rather than a real error.
    const [boardResult, analyticsResult] = await Promise.allSettled([
      getWithRetry('/api/dashboard/monitoring-board', headers),
      needsAnalytics ? getWithRetry('/api/dashboard/analytics', headers) : Promise.resolve(null),
    ]);

    const failures = [boardResult, analyticsResult].filter((result) => result.status === 'rejected');
    if (failures.some((result) => isAuthError(result.reason))) {
      clearInterval(pollRef.current);
      setSessionExpired(true);
      if (!silent) setLoading(false);
      return;
    }

    if (boardResult.status === 'fulfilled') {
      const { data } = boardResult.value;
      setMonitoringBoard(data.monitoringBoard);
      setTotals(data.totals);
      setReportsByCategory(data.reportsByCategory || {});
      setSubCategoryTotals(data.subCategoryTotals || {});
      setAsOf(data.asOf);
    }
    if (analyticsResult.status === 'fulfilled' && analyticsResult.value) {
      const { data } = analyticsResult.value;
      setKpis(data.kpis);
      setCharts(data.charts || {});
      lastAnalyticsAtRef.current = Date.now();
    }

    if (failures.length) {
      failures.forEach((result) => console.error('Error fetching dashboard:', result.reason));
      // A background refresh that fails keeps showing the last good data without an alarm; only
      // a load the user is waiting on reports the failure.
      if (!silent) {
        setError(
          boardResult.status === 'rejected' && analyticsResult.status === 'rejected'
            ? 'Could not load the dashboard. It will keep retrying automatically.'
            : boardResult.status === 'rejected'
              ? 'Could not load the monitoring board. It will keep retrying automatically.'
              : 'Could not load the charts. They will keep retrying automatically.'
        );
      }
    } else {
      // Clear a previous failure message once a later refresh succeeds.
      setError('');
    }

    if (!silent) setLoading(false);
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
      const resp = await getWithRetry(`/api/dashboard/monitoring-board?${params}`, {
        Authorization: `Bearer ${token}`,
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
    printWin.document.write(`<!DOCTYPE html><html><head><title>FireTrack — Benguet Dashboard</title>${stylesheets}<style>body{padding:32px;font-family:sans-serif}button{display:none!important}</style></head><body>${el.outerHTML}</body></html>`);
    printWin.document.close();
    printWin.onload = () => { printWin.focus(); printWin.print(); };
  };

  // jsPDF + autotable are only ever needed here, on an explicit "Export PDF" click — loading them
  // dynamically instead of at module top-level keeps them out of every provincial-dashboard
  // visitor's initial JS payload, most of whom never export anything.
  const downloadPdf = async (filename, title, header, rows) => {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text('FireTrack — BFP Benguet Fire Incident Report', 14, 16);
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
    exportBoardPdf(boardRows, boardShowsCurrent ? totals : histTotals, boardPeriodLabel);
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
  // The period the monitoring board is showing (This Month, or the month/year picked under By
  // Month / By Year, once loaded). The fire map and the municipality popup follow it, so the map
  // always matches the table.
  const boardShowsCurrent = boardTab === 'current' || histData === null;
  const boardRows = boardShowsCurrent ? monitoringBoard : histData;
  const currentYear = now.getFullYear();
  const boardPeriodLabel = boardShowsCurrent ? `${currentMonthName} ${currentYear}` : histLabel;
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
    <div className="p-4 sm:p-6 lg:p-8" id="provincial-dashboard-content">
      {/* Page Title */}
      <div className="mb-6">
        <PageHeader
          icon={Home}
          eyebrow="Provincial Office"
          title="Provincial Dashboard"
          description="Real-time fire incident monitoring for Benguet Province"
        />
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
      <div id="section-monitoring-board" className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-6">
        <div className="flex justify-between items-start gap-3 mb-1">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-gray-900">Fire Incident Monitoring Board</h2>
            <p className="text-sm text-gray-500 mb-4">Live totals for the current month, or browse a past month or year. Click a municipality to see its incidents and statistics.</p>
          </div>
          <SectionMenu onPrint={() => handlePrint('section-monitoring-board')} onExport={handleExportMonitoringBoard} />
        </div>

        {/* Sub-tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
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
              <h3 className="text-lg font-semibold tracking-tight text-gray-900">
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
            ) : (() => {
              const rows = boardTab === 'current' ? monitoringBoard : histData;
              const rowTotals = boardTab === 'current' ? totals : histTotals;
              const activeSubTotals = boardTab === 'current' ? subCategoryTotals : histSubCategoryTotals;
              const FIELD_LABELS = { residential: 'Residential', nonResidential: 'Non-Residential', nonStructural: 'Non-Structural', transport: 'Transport' };
              const fieldOrder = ['residential', 'nonResidential', 'nonStructural', 'transport'];

              // Only sub-categories with a nonzero count anywhere this period get their own column —
              // matches the tiles above. A field with none of its own stays a single plain column.
              const subKeysByField = {};
              fieldOrder.forEach((field) => {
                subKeysByField[field] = showSubCategories
                  ? Object.entries(activeSubTotals[field] || {}).sort((a, b) => b[1] - a[1]).map(([sub]) => sub)
                  : [];
              });

              // A heavier line marks the start of a new category; a lighter one separates
              // sibling sub-categories within the same category, so the eye can tell the two
              // kinds of division apart at a glance.
              const groupBorderHeader = 'border-l-2 border-l-white/25';
              const subBorderHeader = 'border-l border-l-white/10';
              const groupBorderBody = 'border-l-2 border-l-gray-300';
              const subBorderBody = 'border-l border-l-gray-200';

              return (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th rowSpan={2}>Municipality</th>
                        {fieldOrder.map((field) =>
                          subKeysByField[field].length > 0 ? (
                            <th key={field} colSpan={subKeysByField[field].length} className={`text-center ${groupBorderHeader}`}>
                              {FIELD_LABELS[field]}
                            </th>
                          ) : (
                            <th key={field} rowSpan={2} className={`text-right ${groupBorderHeader}`}>{FIELD_LABELS[field]}</th>
                          )
                        )}
                        <th rowSpan={2} className={`text-right font-bold ${groupBorderHeader}`}>Total</th>
                      </tr>
                      <tr>
                        {fieldOrder.flatMap((field) =>
                          subKeysByField[field].map((sub, idx) => (
                            <th
                              key={`${field}-${sub}`}
                              className={`text-right text-xs font-normal text-white/70 ${idx === 0 ? groupBorderHeader : subBorderHeader}`}
                            >
                              {sub}
                            </th>
                          ))
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr
                          key={row.code}
                          onClick={() => setMunicipalityModal({ code: row.code, source: 'board' })}
                          className="cursor-pointer hover:bg-bfp-navy/5"
                          title={`View ${row.municipality} incident information`}
                        >
                          <td className="font-semibold">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setMunicipalityModal({ code: row.code, source: 'board' }); }}
                              className="text-left text-bfp-navy underline decoration-dotted underline-offset-4 hover:text-bfp-red"
                            >
                              {row.municipality}
                            </button>
                          </td>
                          {fieldOrder.flatMap((field) => {
                            const subKeys = subKeysByField[field];
                            if (subKeys.length > 0) {
                              return subKeys.map((sub, idx) => (
                                <td
                                  key={`${row.code}-${field}-${sub}`}
                                  className={`text-right ${idx === 0 ? groupBorderBody : subBorderBody}`}
                                >
                                  {row.subCategories?.[field]?.[sub] || 0}
                                </td>
                              ));
                            }
                            return [
                              <td key={`${row.code}-${field}`} className={`text-right ${groupBorderBody}`}>
                                {row[field]}
                              </td>,
                            ];
                          })}
                          <td className={`text-right font-bold text-bfp-red ${groupBorderBody}`}>{row.total}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-100 font-bold">
                        <td>TOTAL</td>
                        {fieldOrder.flatMap((field) => {
                          const subKeys = subKeysByField[field];
                          if (subKeys.length > 0) {
                            return subKeys.map((sub, idx) => (
                              <td
                                key={`total-${field}-${sub}`}
                                className={`text-right ${idx === 0 ? groupBorderBody : subBorderBody}`}
                              >
                                {activeSubTotals[field]?.[sub] || 0}
                              </td>
                            ));
                          }
                          return [
                            <td key={`total-${field}`} className={`text-right ${groupBorderBody}`}>
                              {rowTotals[field] || 0}
                            </td>,
                          ];
                        })}
                        <td className={`text-right text-bfp-red text-lg ${groupBorderBody}`}>{rowTotals.total || 0}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              );
            })()}
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
            className="fixed inset-0 z-50 flex items-center justify-center modal-overlay p-4"
            onClick={() => setCategoryModal(null)}
          >
            <div
              className="modal-pop-in flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className={`flex items-start justify-between gap-4 border-b border-gray-100 p-6 ${meta.chip}`}>
                <div className="flex items-center gap-4">
                  <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${meta.solid}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-600">{periodLabel}</p>
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
                    <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-600">Total</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-3 text-center">
                    <p className="text-2xl font-bold text-gray-800">{individualCount}</p>
                    <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-600">Filed Reports</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-3 text-center">
                    <p className="text-2xl font-bold text-gray-800">{tallyCount}</p>
                    <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-600">Daily Tallies</p>
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
                            <th>Files</th>
                            <th>QR</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {reports.map((report) => (
                            <tr key={report.id}>
                              <td className="font-semibold">{report.referenceNumber || `#${report.id}`}</td>
                              <td>{report.municipality}</td>
                              <td>{new Date(report.reportDate).toLocaleDateString()}</td>
                              <td><StatusBadge status={report.status} /></td>
                              <td>
                                <AttachmentList attachments={report.attachments} reportId={report.id} />
                                {!report.attachments && <span className="text-xs text-gray-400">None</span>}
                              </td>
                              <td><ReportQrButton report={report} className="btn btn-secondary px-2.5 py-1.5 text-xs" /></td>
                              <td>
                                <button
                                  type="button"
                                  onClick={() => setCategoryViewReport(report)}
                                  className="btn btn-primary whitespace-nowrap px-2.5 py-1.5 text-xs"
                                >
                                  View Report
                                </button>
                              </td>
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

            {categoryViewReport && (
              // Its own clicks must not reach this popup's backdrop, which would close both.
              <div onClick={(e) => e.stopPropagation()}>
                <ReportDetailsModal
                  report={{ ...categoryViewReport, municipality: { name: categoryViewReport.municipality } }}
                  onClose={() => setCategoryViewReport(null)}
                />
              </div>
            )}
          </div>
        );
      })()}

      {/* ── 2. KPI Cards ── */}
      <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={CalendarDays} accent="red" label="Incidents this month" value={kpis?.thisMonth || 0} />
        <StatCard icon={CalendarRange} accent="navy" label="Incidents this year" value={kpis?.thisYear || 0} />
        <StatCard
          icon={Flame}
          accent="amber"
          label="Most active municipality"
          value={kpis?.mostActiveMunicipality || 'N/A'}
          valueClassName="text-xl mt-3"
        />
        <StatCard icon={HeartPulse} accent="green" label="With casualties" value={kpis?.incidentsWithCasualties || 0} />
      </div>

      {/* ── 2b. Municipality Fire Rate SVG Map ── */}
      <BenguetFireMap
        monitoringBoard={boardRows}
        periodLabel={boardPeriodLabel}
        onPrint={() => handlePrint('section-fire-map')}
        onExport={handleExportFireMap}
        onSelect={(code) => setMunicipalityModal({ code, source: 'map' })}
      />

      {municipalityModal && (() => {
        // Map and board both show the board's selected period, so the popup does too.
        const useCurrent = boardShowsCurrent;
        const rows = boardRows;
        const row = rows.find((r) => r.code === municipalityModal.code);
        if (!row) return null;
        const byCategory = useCurrent ? reportsByCategory : histReportsByCategory;
        const filedReports = ['residential', 'nonResidential', 'nonStructural', 'transport']
          .flatMap((f) => byCategory[f] || [])
          .filter((report) => report.municipality === row.municipality)
          .sort((a, b) => new Date(b.reportDate) - new Date(a.reportDate));
        const rank = rankByTotal(rows, row);

        let periodStart;
        let periodEnd;
        if (useCurrent) {
          periodStart = new Date(currentYear, now.getMonth(), 1);
          periodEnd = new Date(currentYear, now.getMonth() + 1, 0, 23, 59, 59, 999);
        } else if (boardTab === 'monthly') {
          periodStart = new Date(histMonthYear, histMonthNum - 1, 1);
          periodEnd = new Date(histMonthYear, histMonthNum, 0, 23, 59, 59, 999);
        } else {
          periodStart = new Date(histYearNum, 0, 1);
          periodEnd = new Date(histYearNum, 11, 31, 23, 59, 59, 999);
        }

        return (
          <MunicipalityDetailModal
            row={row}
            rank={rank}
            municipalityCount={rows.length}
            periodLabel={useCurrent ? `${currentMonthName} ${currentYear}` : histLabel}
            periodStart={periodStart}
            periodEnd={periodEnd}
            filedReports={filedReports}
            onClose={() => setMunicipalityModal(null)}
          />
        );
      })()}

      {/* ── 4. Incident Trend Charts ── */}
      <div id="section-comparison" className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-8">
        <div className="flex justify-between items-start mb-5 flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-gray-900">Fire Incident Comparison</h2>
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
              {COMPARISON_CATEGORIES.map((label) => (
                <div key={label} className="bg-gray-50 border rounded-lg p-3">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-xl font-semibold tracking-tight text-gray-900">{highestTrendPeriod[label] || 0}</p>
                  <SubCategoryBreakdown
                    total={highestTrendPeriod[label] || 0}
                    subs={highestTrendPeriod.subCategories?.[label]}
                    className="mt-2 border-t pt-2"
                  />
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
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} />
                <Tooltip cursor={{ radius: 4 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
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
                      <td className="px-3 py-2 font-bold border text-bfp-navy align-top">{row.period}</td>
                      {COMPARISON_CATEGORIES.map((label) => (
                        <td key={label} className="px-3 py-2 text-right border align-top">
                          {row[label]}
                          <SubCategoryBreakdown
                            total={row[label] || 0}
                            subs={row.subCategories?.[label]}
                            className="mt-1 font-normal"
                          />
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right border font-bold text-bfp-red align-top">{row.total}</td>
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
