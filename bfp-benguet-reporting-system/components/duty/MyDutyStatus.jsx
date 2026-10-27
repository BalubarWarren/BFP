'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { CalendarDays, Plane, Ban, Siren, RotateCcw } from 'lucide-react';
import { useToast } from '../common/ToastProvider';
import DutyBadge, { DutyWeek } from './DutyBadge';
import { DUTY, DUTY_LABELS, addDays, formatDutyDate, manilaDate } from '../../lib/duty';

const ACTIONS = [
  { status: DUTY.ON_LEAVE, label: 'On Leave', icon: Plane, hint: 'Vacation, sick or other approved leave', defaultDays: 2 },
  { status: DUTY.UNAVAILABLE, label: 'Unavailable', icon: Ban, hint: 'Training, official travel, or otherwise not reachable', defaultDays: 0 },
  { status: DUTY.ON_DUTY, label: 'Called In', icon: Siren, hint: 'On duty on a scheduled day off', defaultDays: 0 },
];

const headers = () => ({ Authorization: `Bearer ${sessionStorage.getItem('token')}` });

// The investigator's duty status for today (GET /api/me/duty): from their Fire Marshal's schedule,
// unless they've marked an exception. Setting one (PUT /api/me/duty) notifies their Fire Marshal,
// and it ends on its own after the chosen date. Being on FireTrack doesn't make them "on duty".
export default function MyDutyStatus() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null); // { status, until, note } while choosing an exception
  const [saving, setSaving] = useState(false);

  const load = () =>
    axios.get('/api/me/duty', { headers: headers() })
      .then((res) => setData(res.data))
      .catch(() => setData({ error: true }));

  useEffect(() => {
    load();
  }, []);

  const save = async (body) => {
    setSaving(true);
    try {
      const res = await axios.put('/api/me/duty', body, { headers: headers() });
      setData(res.data);
      setForm(null);
      toast.success(body.status ? `Marked ${DUTY_LABELS[body.status]} — your Fire Marshal has been notified.` : 'Back to your duty schedule.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not update your duty status.');
    } finally {
      setSaving(false);
    }
  };

  if (!data || data.error) return null;

  const { duty, week, schedule, nextDuty } = data;
  const today = manilaDate();

  return (
    <section className="mb-6 rounded-lg border-l-4 border-bfp-navy bg-white p-4 shadow-md sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-bfp-navy">
            <CalendarDays className="h-5 w-5" /> My Duty Status
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <DutyBadge status={duty.status} />
            <span className="text-sm text-gray-600">
              {duty.source === 'self'
                ? `Set by you until ${formatDutyDate(duty.until)}${duty.note ? ` — "${duty.note}"` : ''}`
                : schedule
                  ? `From your schedule: ${schedule.description}${duty.status === DUTY.OFF_DUTY && nextDuty ? ` · next duty ${formatDutyDate(nextDuty)}` : ''}`
                  : 'Your Fire Marshal hasn’t set your duty schedule yet.'}
            </span>
          </div>
        </div>
        <DutyWeek days={week} />
      </div>

      {!form && (
        <div className="mt-4 flex flex-wrap gap-2">
          {duty.source === 'self' ? (
            <button type="button" onClick={() => save({ status: null })} disabled={saving} className="btn btn-secondary inline-flex items-center gap-1.5 text-sm">
              <RotateCcw className="h-4 w-4" /> Back to my schedule
            </button>
          ) : (
            ACTIONS.map(({ status, label, icon: Icon, defaultDays }) => (
              <button
                key={status}
                type="button"
                onClick={() => setForm({ status, until: addDays(today, defaultDays), note: '' })}
                className="btn btn-secondary inline-flex items-center gap-1.5 text-sm"
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))
          )}
        </div>
      )}

      {form && (
        <div className="mt-4 rounded-lg border border-gray-200 p-4">
          <p className="font-semibold text-gray-900">Mark yourself {DUTY_LABELS[form.status]}</p>
          <p className="mb-3 text-xs text-gray-500">{ACTIONS.find((a) => a.status === form.status)?.hint}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="form-label" htmlFor="duty-until">Until (inclusive)</label>
              <input
                id="duty-until"
                type="date"
                className="form-input"
                min={today}
                max={addDays(today, 90)}
                value={form.until}
                onChange={(e) => setForm({ ...form, until: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="duty-note">Reason <span className="font-normal text-gray-400">(optional)</span></label>
              <input
                id="duty-note"
                className="form-input"
                maxLength={200}
                placeholder="e.g. Fire investigation training"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">Your Fire Marshal is notified. It ends automatically after this date.</p>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setForm(null)} disabled={saving} className="btn btn-secondary text-sm">Cancel</button>
            <button type="button" onClick={() => save(form)} disabled={saving} className="btn btn-primary text-sm">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
