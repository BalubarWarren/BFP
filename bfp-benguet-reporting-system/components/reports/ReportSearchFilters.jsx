'use client';

import { useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import {
  EMPTY_REPORT_FILTERS,
  CLASSIFICATION_OPTIONS,
  STATUS_OPTIONS,
  hasActiveFilters,
} from '../../lib/report-search';

// Search bar + expandable advanced filters used on every report list. Pair with
// matchesReportFilters (lib/report-search.js) to apply it.
export default function ReportSearchFilters({ filters, onChange, showStatus = true, className = '' }) {
  const advancedActive = !!(filters.incidentDate || filters.location || filters.classification || (showStatus && filters.status));
  const [showAdvanced, setShowAdvanced] = useState(advancedActive);

  const set = (key) => (e) => onChange({ ...filters, [key]: e.target.value });
  const clear = () => onChange({ ...EMPTY_REPORT_FILTERS, ...(showStatus ? {} : { status: filters.status }) });
  const active = showStatus ? hasActiveFilters(filters) : hasActiveFilters({ ...filters, status: '' });

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="form-label">Search</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              className="form-input pl-9"
              placeholder="Reference #, report ID, or QR code link"
              value={filters.query}
              onChange={set('query')}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            aria-expanded={showAdvanced}
            className={`btn flex flex-1 items-center justify-center gap-1.5 border px-3 sm:flex-none ${
              showAdvanced || advancedActive ? 'border-bfp-navy bg-bfp-navy/5 text-bfp-navy' : 'btn-secondary'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" /> More filters
          </button>
          {active && (
            <button type="button" onClick={clear} className="btn btn-secondary flex items-center gap-1 px-3">
              <X className="h-4 w-4" /> Clear
            </button>
          )}
        </div>
      </div>

      {showAdvanced && (
        <div className={`grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:grid-cols-2 ${showStatus ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
          <div>
            <label className="form-label text-xs">Incident Date</label>
            <input type="date" className="form-input" value={filters.incidentDate} onChange={set('incidentDate')} />
          </div>
          <div>
            <label className="form-label text-xs">Incident Location</label>
            <input
              type="text"
              className="form-input"
              placeholder="Municipality, barangay or address"
              value={filters.location}
              onChange={set('location')}
            />
          </div>
          <div>
            <label className="form-label text-xs">Classification</label>
            <select className="form-select" value={filters.classification} onChange={set('classification')}>
              <option value="">All classifications</option>
              {CLASSIFICATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          {showStatus && (
            <div>
              <label className="form-label text-xs">Report Status</label>
              <select className="form-select" value={filters.status} onChange={set('status')}>
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
