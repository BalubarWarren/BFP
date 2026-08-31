'use client';

import { Check } from 'lucide-react';

const PROGRESS_STEP_LABELS = ['Submitted', 'Municipal Chief IIS', 'Municipal Fire Marshal', 'Provincial Chief IIS'];
const REVIEW_TIER_LABELS = ['Municipal Chief IIS', 'Municipal Fire Marshal', 'Provincial Chief IIS'];

const roleTierIndex = (role) => {
  if (role === 'MUNICIPAL_CHIEF_IIS' || role === 'MUNICIPAL_CHIEF_OPERATION') return 0;
  if (role === 'MUNICIPAL_FIRE_MARSHAL') return 1;
  if (role === 'PROVINCIAL_CHIEF_IIS') return 2;
  return null;
};

// Figures out which step of the review chain a report is currently at, for
// display in ReportProgressBar. Returns null for reports that aren't submitted yet.
export const getReportProgress = (report) => {
  if (!report || report.status === 'DRAFT') return null;

  if (report.status === 'SUBMITTED') {
    const tier = roleTierIndex(report.passedToRole) ?? 0;
    return {
      activeIndex: tier + 1,
      variant: 'pending',
      description: `Awaiting review by ${REVIEW_TIER_LABELS[tier]}.`,
    };
  }

  if (report.status === 'RETURNED') {
    const tier = roleTierIndex(report.reviewedBy?.role) ?? 0;
    return {
      activeIndex: tier + 1,
      variant: 'returned',
      description: `Returned by ${REVIEW_TIER_LABELS[tier]} — needs revision.`,
    };
  }

  if (report.status === 'APPROVED') {
    const tier = roleTierIndex(report.reviewedBy?.role) ?? 0;
    if (!report.passedToId) {
      return {
        activeIndex: PROGRESS_STEP_LABELS.length,
        variant: 'done',
        description: `Approved by ${REVIEW_TIER_LABELS[tier]} — finalized.`,
      };
    }
    const nextTier = Math.min(tier + 1, REVIEW_TIER_LABELS.length - 1);
    return {
      activeIndex: nextTier + 1,
      variant: 'awaiting-forward',
      description: `Approved by ${REVIEW_TIER_LABELS[tier]} — proceed to next step: submit to ${REVIEW_TIER_LABELS[nextTier]}.`,
    };
  }

  return null;
};

export default function ReportProgressBar({ progress, compact }) {
  if (!progress) return null;
  const { activeIndex, variant, description } = progress;

  const activeColor = {
    pending: 'bg-blue-500',
    returned: 'bg-red-500',
    'awaiting-forward': 'bg-bfp-amber',
    done: 'bg-bfp-green',
  }[variant] || 'bg-blue-500';

  const descriptionColor = {
    pending: 'text-blue-700',
    returned: 'text-red-600',
    'awaiting-forward': 'text-bfp-navy',
    done: 'text-bfp-green',
  }[variant] || 'text-gray-600';

  return (
    <div className={compact ? 'mt-2 max-w-xs' : 'mt-1'}>
      <div className="flex items-center">
        {PROGRESS_STEP_LABELS.map((label, i) => {
          const isDone = i < activeIndex;
          const isActive = i === activeIndex;
          return (
            <div key={label} className={`flex items-center ${i < PROGRESS_STEP_LABELS.length - 1 ? 'flex-1' : ''}`}>
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className={`flex items-center justify-center rounded-full font-bold text-white ${compact ? 'w-5 h-5 text-[9px]' : 'w-7 h-7 text-xs'} ${
                    isDone ? 'bg-bfp-green' : isActive ? activeColor : 'bg-gray-300'
                  }`}
                >
                  {isDone ? <Check className={compact ? 'w-3 h-3' : 'w-4 h-4'} /> : i + 1}
                </div>
                {!compact && (
                  <span className={`mt-1 text-[10px] text-center leading-tight w-16 ${isActive ? 'font-bold text-gray-800' : 'text-gray-500'}`}>
                    {label}
                  </span>
                )}
              </div>
              {i < PROGRESS_STEP_LABELS.length - 1 && (
                <div className={`flex-1 h-1 mx-1 rounded ${i < activeIndex ? 'bg-bfp-green' : 'bg-gray-300'}`} />
              )}
            </div>
          );
        })}
      </div>
      {description && <p className={`text-xs mt-2 ${descriptionColor}`}>{description}</p>}
    </div>
  );
}
