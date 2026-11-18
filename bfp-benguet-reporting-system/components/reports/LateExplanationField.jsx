'use client';

import { AlertTriangle } from 'lucide-react';
import { LATE_EXPLANATION_MIN_LENGTH } from '../../lib/report-timeliness';

// Shown on the Spot/Progress/Final forms once the report is past its deadline: the Explanation
// Report for the late submission, required by POST /api/reports (code LATE_EXPLANATION_REQUIRED).
export default function LateExplanationField({ deadline, value, onChange }) {
  if (!deadline) return null;
  return (
    <div className="rounded-lg border border-red-300 bg-red-50 p-4 sm:p-5 dark:border-red-500/40 dark:bg-red-500/10">
      <p className="flex items-center gap-2 font-semibold text-red-800 dark:text-red-200">
        <AlertTriangle className="h-5 w-5" /> This report is past its deadline
      </p>
      <p className="mt-1 text-sm text-red-700 dark:text-red-300">
        It was due {new Date(deadline).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}. Write an
        explanation for the late submission (Explanation Report). Reviewers will see it with the report. You may also attach a
        signed explanation letter under Supporting documents.
      </p>
      <label className="form-label mt-3" htmlFor="late-explanation">
        Explanation for late submission <span className="text-bfp-red">*</span>
      </label>
      <textarea
        id="late-explanation"
        className="form-input"
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        minLength={LATE_EXPLANATION_MIN_LENGTH}
        maxLength={4000}
        required
        placeholder="e.g. The investigation team was deployed to another incident and the scene was only cleared on…"
      />
    </div>
  );
}
