'use client';

import { Undo2, Check, CheckCircle2 } from 'lucide-react';

export const ROLE_LABELS = {
  INVESTIGATOR: 'Investigator',
  MUNICIPAL_CHIEF_IIS: 'Municipal Chief IIS',
  MUNICIPAL_CHIEF_OPERATION: 'Municipal Chief Operation',
  MUNICIPAL_FIRE_MARSHAL: 'Municipal Fire Marshal',
  PROVINCIAL_CHIEF_IIS: 'Provincial Chief IIS',
  MARSHAL: 'Marshal',
  CHIEF_INVESTIGATOR_IIS: 'Chief Investigator IIS',
  SUPER_ADMIN: 'Admin',
  ADMIN: 'Admin',
};

// All four investigation report types (MDFIR, Spot, Progress, Final) let the investigator pick
// the same four recipients — Municipal Chief IIS and Municipal Chief Operation are parallel
// alternatives at the same tier, not separate sequential steps, so they share one tier here.
const WORKFLOW_TIERS = [
  { roles: ['INVESTIGATOR'], label: 'Investigator' },
  { roles: ['MUNICIPAL_CHIEF_IIS', 'MUNICIPAL_CHIEF_OPERATION'], label: 'Municipal Chief IIS/Operation' },
  { roles: ['MUNICIPAL_FIRE_MARSHAL'], label: 'Municipal Fire Marshal' },
  // MARSHAL and CHIEF_INVESTIGATOR_IIS are legacy roles kept for compatibility that act as the
  // same final/provincial-level approver as PROVINCIAL_CHIEF_IIS (see approve/route.js's
  // allowedReviewers and ReportProgressBar.jsx's roleTierIndex, which treats them the same way).
  { roles: ['PROVINCIAL_CHIEF_IIS', 'MARSHAL', 'CHIEF_INVESTIGATOR_IIS'], label: 'Provincial Chief IIS' },
];

export default function WorkflowTracker({ report }) {
  const steps = WORKFLOW_TIERS;

  const getCurrentStep = () => {
    if (report.status === 'APPROVED') return steps.length;
    if (report.status === 'RETURNED') return 0;
    const passedToRole = report.passedToRole;
    if (!passedToRole) return steps.length;
    const idx = steps.findIndex((tier) => tier.roles.includes(passedToRole));
    return idx >= 0 ? idx : 1;
  };

  const currentStep = getCurrentStep();

  return (
    <div className="mt-3">
      <div className="flex items-center gap-0">
        {steps.map((step, idx) => {
          const isDone = idx < currentStep || report.status === 'APPROVED';
          const isCurrent = idx === currentStep && report.status !== 'APPROVED' && report.status !== 'RETURNED';
          const isReturned = report.status === 'RETURNED' && idx === 0;
          // For the current step, prefer the report's actual recipient role label over the
          // tier's generic one (e.g. "Municipal Chief Operation" instead of ".../Operation").
          const stepLabel = isCurrent && ROLE_LABELS[report.passedToRole]
            ? ROLE_LABELS[report.passedToRole]
            : step.label;
          return (
            <div key={step.label} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                    ${isReturned ? 'bg-red-500 text-white' :
                      isDone ? 'bg-green-500 text-white' :
                      isCurrent ? 'bg-bfp-navy text-white ring-2 ring-bfp-gold' :
                      'bg-gray-200 text-gray-500'}`}
                >
                  {isReturned ? <Undo2 className="w-3.5 h-3.5" /> : isDone ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                </div>
                <p className="text-[10px] text-center text-gray-500 mt-1 w-16 leading-tight truncate" title={stepLabel}>
                  {stepLabel}
                </p>
              </div>
              {idx < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 ${idx < currentStep || report.status === 'APPROVED' ? 'bg-green-400' : 'bg-gray-200'}`} />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-xs text-gray-500">Currently with:</span>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-bfp-navy">
          {report.status === 'APPROVED' ? (
            <><CheckCircle2 className="w-3.5 h-3.5" /> Approved — Filed</>
          ) : report.status === 'RETURNED' ? (
            <><Undo2 className="w-3.5 h-3.5" /> Returned to {ROLE_LABELS[report.submittedBy?.role] || 'Investigator'}</>
          ) : (
            report.passedTo?.name || ROLE_LABELS[report.passedToRole] || 'In Review'
          )}
        </span>
      </div>
    </div>
  );
}
