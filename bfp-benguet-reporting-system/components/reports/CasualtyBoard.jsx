'use client';

import { Fragment, useEffect, useState } from 'react';
import axios from 'axios';
import { HeartPulse, ChevronDown, ChevronRight } from 'lucide-react';
import { getIncidentPlace } from '../../lib/report-title';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad = (n) => String(n).padStart(2, '0');

function getPeriod(tab, month, monthYear, year) {
  const now = new Date();
  if (tab === 'monthly') {
    const lastDay = new Date(monthYear, month, 0).getDate();
    return {
      startDate: `${monthYear}-${pad(month)}-01`,
      endDate: `${monthYear}-${pad(month)}-${lastDay}`,
      label: `${MONTHS[month - 1]} ${monthYear}`,
    };
  }
  if (tab === 'yearly') {
    return { startDate: `${year}-01-01`, endDate: `${year}-12-31`, label: `Year ${year}` };
  }
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  return {
    startDate: `${y}-${pad(m)}-01`,
    endDate: `${y}-${pad(m)}-${new Date(y, m, 0).getDate()}`,
    label: `${MONTHS[m - 1]} ${y} — as of ${now.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}`,
  };
}

// Casualty Monitoring Board (Reports page): injured and fatalities per municipality for this
// month, a chosen month, or a chosen year. Data: GET /api/dashboard/casualty-board.
export default function CasualtyBoard() {
  const currentYear = new Date().getFullYear();
  const [tab, setTab] = useState('current');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [monthYear, setMonthYear] = useState(currentYear);
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(null);

  const period = getPeriod(tab, month, monthYear, year);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ startDate: period.startDate, endDate: period.endDate });
        const res = await axios.get(`/api/dashboard/casualty-board?${params}`, {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
        });
        if (!cancelled) setData(res.data);
      } catch {
        if (!cancelled) setError('Could not load the casualty board. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // period is derived from these.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, month, monthYear, year]);

  const rows = data?.rows || [];
  // A municipal account sees only its own municipality: show its barangays as the table itself.
  const singleMunicipality = rows.length === 1;
  const totals = data?.totals || { incidents: 0, injured: 0, fatalities: 0, total: 0 };
  const cards = [
    { label: 'Injured', value: totals.injured, className: 'bg-amber-100 text-amber-800' },
    { label: 'Fatalities', value: totals.fatalities, className: 'bg-red-100 text-red-800' },
    { label: 'Total Casualties', value: totals.total, className: 'bg-bfp-navy text-white' },
  ];

  return (
    <section className="rounded-lg bg-white p-4 shadow-md sm:p-6">
      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-gray-900">
          <HeartPulse className="h-5 w-5 text-bfp-red" /> Casualty Monitoring Board
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Injured and fatalities per municipality from approved fire cases. Click a municipality to see each of its barangays.
        </p>
      </div>

      <div className="segmented mb-4" role="group" aria-label="Board period">
        {[
          { key: 'current', label: 'This Month' },
          { key: 'monthly', label: 'By Month' },
          { key: 'yearly', label: 'By Year' },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            className="segmented-item"
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab !== 'current' && (
        <div className="mb-5 flex flex-wrap items-end gap-3">
          {tab === 'monthly' && (
            <div>
              <label className="form-label text-xs">Month</label>
              <select className="form-input py-1.5 text-sm" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {MONTHS.map((name, i) => (
                  <option key={name} value={i + 1}>{name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="form-label text-xs">Year</label>
            <select
              className="form-input py-1.5 text-sm"
              value={tab === 'monthly' ? monthYear : year}
              onChange={(e) => (tab === 'monthly' ? setMonthYear : setYear)(Number(e.target.value))}
            >
              {[0, 1, 2, 3, 4].map((back) => (
                <option key={back} value={currentYear - back}>{currentYear - back}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <h3 className="mb-3 text-lg font-semibold tracking-tight text-gray-900">
        {period.label}
        {loading && <span className="ml-2 text-sm font-normal italic text-gray-500">Loading…</span>}
      </h3>

      {error ? (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {cards.map((card) => (
              <div key={card.label} className={`rounded-lg p-4 text-center ${card.className}`}>
                <p className="text-sm font-medium opacity-90">{card.label}</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">{data ? card.value : '—'}</p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-100">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500">
                <tr>
                  <th className="px-4 py-3">{singleMunicipality ? `Barangay (${rows[0].municipality})` : 'Municipality / Barangay'}</th>
                  <th className="px-4 py-3 text-right">Fire Cases</th>
                  <th className="px-4 py-3 text-right">Injured</th>
                  <th className="px-4 py-3 text-right">Fatalities</th>
                  <th className="px-4 py-3 text-right">Total Casualties</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {singleMunicipality
                  ? <BarangayRows row={rows[0]} />
                  : rows.map((row) => {
                      const isOpen = expanded === row.municipalityId;
                      return (
                        <Fragment key={row.municipalityId}>
                          <tr
                            className="cursor-pointer hover:bg-gray-50"
                            onClick={() => setExpanded(isOpen ? null : row.municipalityId)}
                            aria-expanded={isOpen}
                          >
                            <td className="px-4 py-3 font-medium text-gray-900">
                              <span className="inline-flex items-center gap-1">
                                {isOpen ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                                {row.municipality}
                              </span>
                            </td>
                            <CountCells item={row} />
                          </tr>
                          {isOpen && <BarangayRows row={row} indent />}
                        </Fragment>
                      );
                    })}
                {rows.length > 1 && (
                  <tr className="bg-gray-50 font-semibold text-gray-900">
                    <td className="px-4 py-3">Total</td>
                    <td className="px-4 py-3 text-right tabular-nums">{totals.incidents}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{totals.injured}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{totals.fatalities}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-bfp-red">{totals.total}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {singleMunicipality && rows[0].cases.length > 0 && <CaseList cases={rows[0].cases} className="mt-4" />}
        </>
      )}
    </section>
  );
}

function CountCells({ item, muted = false }) {
  const base = `px-4 py-3 text-right tabular-nums ${muted ? 'text-gray-600' : 'text-gray-700'}`;
  return (
    <>
      <td className={base}>{item.incidents}</td>
      <td className={base}>{item.injured}</td>
      <td className={base}>{item.fatalities}</td>
      <td className={`px-4 py-3 text-right font-semibold tabular-nums ${item.total ? 'text-bfp-red' : 'text-gray-400'}`}>{item.total}</td>
    </>
  );
}

// One row per barangay of a municipality (all of them, zeros included), then the cases with
// casualties when shown under an expanded municipality.
function BarangayRows({ row, indent = false }) {
  return (
    <>
      {row.barangays.map((b) => (
        <tr key={b.name} className={indent ? 'bg-gray-50/60' : ''}>
          <td className={`py-2.5 pr-4 text-gray-700 ${indent ? 'pl-11' : 'pl-4'} ${b.name === 'Not specified' ? 'italic text-gray-500' : ''}`}>
            {b.name}
          </td>
          <CountCells item={b} muted />
        </tr>
      ))}
      {indent && row.cases.length > 0 && (
        <tr className="bg-gray-50/60">
          <td colSpan={5} className="px-4 pb-3 pl-11">
            <CaseList cases={row.cases} />
          </td>
        </tr>
      )}
    </>
  );
}

function CaseList({ cases, className = '' }) {
  return (
    <div className={className}>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Cases with casualties</p>
      <ul className="space-y-1.5 text-xs text-gray-600">
        {cases.map((c) => (
          <li key={c.id} className="flex flex-wrap justify-between gap-2">
            <span>
              <span className="font-semibold text-gray-800">{getIncidentPlace(c) || c.referenceNumber}</span>
              {' · '}{c.referenceNumber}{' · '}{new Date(c.dateOfIncident).toLocaleDateString()}
            </span>
            <span className="tabular-nums">
              {c.injured} injured · {c.fatalities} {c.fatalities === 1 ? 'fatality' : 'fatalities'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
