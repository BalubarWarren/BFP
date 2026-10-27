'use client';

import { useMemo, useState } from 'react';
import axios from 'axios';
import { CalendarDays, X } from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { DutyWeek } from './DutyBadge';
import {
  ROTATION_PRESETS,
  WEEKDAY_SHORT,
  dutyCalendar,
  manilaDate,
  parseWeekdays,
  parseDutySchedule,
} from '../../lib/duty';

// The Fire Marshal sets one investigator's duty schedule (PUT /api/team/[id]/schedule): fixed
// weekdays, a rotating shift, or none. The preview below uses the same lib/duty.js logic the
// server does, so what they see is exactly what "On duty today" will say.
export default function DutyScheduleModal({ investigator, onClose, onSaved }) {
  const current = investigator.dutySchedule;
  const currentPreset = current?.pattern === 'ROTATION'
    ? ROTATION_PRESETS.find((p) => p.cycle === current.rotationCycle && p.onDays === current.rotationOnDays)?.key || 'custom'
    : '24-48';

  const [pattern, setPattern] = useState(current?.pattern || 'WEEKLY');
  const [weekdays, setWeekdays] = useState(current?.pattern === 'WEEKLY' ? parseWeekdays(current.weekdays) : [1, 2, 3, 4, 5]);
  const [preset, setPreset] = useState(currentPreset);
  const [rotationStart, setRotationStart] = useState(current?.rotationStart || manilaDate());
  const [cycle, setCycle] = useState(current?.rotationCycle || 3);
  const [onDays, setOnDays] = useState(current?.rotationOnDays || 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEscapeKey(onClose, !saving);

  const body = useMemo(() => {
    if (pattern === 'NONE') return { pattern: 'NONE' };
    if (pattern === 'WEEKLY') return { pattern, weekdays };
    const chosen = ROTATION_PRESETS.find((p) => p.key === preset);
    return {
      pattern,
      rotationStart,
      rotationCycle: chosen ? chosen.cycle : Number(cycle),
      rotationOnDays: chosen ? chosen.onDays : Number(onDays),
    };
  }, [pattern, weekdays, preset, rotationStart, cycle, onDays]);

  const parsed = parseDutySchedule(body);
  // Preview the schedule alone (no leave/unavailable exceptions) for the next two weeks.
  const preview = parsed.data ? dutyCalendar({}, parsed.data, 14) : null;

  const toggleDay = (day) =>
    setWeekdays((days) => (days.includes(day) ? days.filter((d) => d !== day) : [...days, day]));

  const handleSave = async () => {
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await axios.put(`/api/team/${investigator.id}/schedule`, body, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
      });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save the schedule.');
    } finally {
      setSaving(false);
    }
  };

  const typeButton = (value, label) => (
    <button
      type="button"
      onClick={() => setPattern(value)}
      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
        pattern === value ? 'border-bfp-navy bg-bfp-navy text-white' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4" onClick={saving ? undefined : onClose}>
      <div className="modal-pop-in max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b p-4 sm:p-6">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-bfp-navy">
              <CalendarDays className="h-5 w-5" /> Duty Schedule
            </h2>
            <p className="text-sm text-gray-600">{investigator.rank ? `${investigator.rank} ` : ''}{investigator.name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-4 sm:p-6">
          <div className="flex flex-wrap gap-2">
            {typeButton('WEEKLY', 'Fixed days')}
            {typeButton('ROTATION', 'Rotating shift')}
            {typeButton('NONE', 'No schedule')}
          </div>

          {pattern === 'WEEKLY' && (
            <div>
              <p className="form-label">On duty every</p>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    aria-pressed={weekdays.includes(day)}
                    className={`h-10 w-12 rounded-lg border text-sm font-semibold transition-colors ${
                      weekdays.includes(day) ? 'border-green-700 bg-green-700 text-white' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {WEEKDAY_SHORT[day]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {pattern === 'ROTATION' && (
            <div className="space-y-4">
              <div>
                <label className="form-label" htmlFor="duty-preset">Shift pattern</label>
                <select id="duty-preset" className="form-select" value={preset} onChange={(e) => setPreset(e.target.value)}>
                  {ROTATION_PRESETS.map((p) => (
                    <option key={p.key} value={p.key}>{p.label}</option>
                  ))}
                  <option value="custom">Custom…</option>
                </select>
              </div>
              {preset === 'custom' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label" htmlFor="duty-on">Days on duty</label>
                    <input id="duty-on" type="number" min={1} max={13} className="form-input" value={onDays} onChange={(e) => setOnDays(e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label" htmlFor="duty-cycle">Repeats every (days)</label>
                    <input id="duty-cycle" type="number" min={2} max={14} className="form-input" value={cycle} onChange={(e) => setCycle(e.target.value)} />
                  </div>
                </div>
              )}
              <div>
                <label className="form-label" htmlFor="duty-start">A day they are (or were) on duty</label>
                <input id="duty-start" type="date" className="form-input" value={rotationStart} onChange={(e) => setRotationStart(e.target.value)} />
                <p className="mt-1 text-xs text-gray-500">The rotation is counted forward and back from this date.</p>
              </div>
            </div>
          )}

          {pattern === 'NONE' && (
            <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
              Without a schedule their duty status shows as &ldquo;No Schedule&rdquo;, and FireTrack won&rsquo;t warn before
              assigning them work. They can still mark themselves on leave or unavailable.
            </p>
          )}

          {preview && (
            <div>
              <p className="form-label">Next two weeks</p>
              <DutyWeek days={preview} />
            </div>
          )}

          {error && <div className="rounded-lg border border-red-400 bg-red-100 px-3 py-2 text-sm text-red-700">{error}</div>}
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t bg-gray-50 p-4 sm:p-6">
          <button type="button" onClick={onClose} className="btn btn-secondary" disabled={saving}>Cancel</button>
          <button type="button" onClick={handleSave} className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}
