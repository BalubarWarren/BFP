import {
  ShieldCheck, FileText, Building2, CalendarCheck, XCircle, Clock, RotateCcw, Send, MapPin, UserCheck, Check, Lock,
} from 'lucide-react';
import prisma from '../../../lib/prisma';
import { isFinallyApprovedReport } from '../../../lib/report-access';
import { REPORT_STATUS } from '../../../lib/constants';
import { formatDate, formatDateTime } from '../../../lib/utils';
import BFPCrest from '../../../components/common/BFPCrest';

// Public, unauthenticated tracking page for a report's QR code (see lib/qr-token.js — issued when
// the investigator first passes the report and kept through every return and correction).
// Deliberately outside the (dashboard) route group — no login, no sidebar — so anyone can scan the
// code and see *where the report is*: its current stage, who is holding it, and the review trail.
// It never shows the report's files, contents, or reviewer remarks — the QR code is for tracking
// only. Reachable only by guessing a 32-byte random token.
// Always read the database on each scan. Without this, Next caches the first render of each token,
// so a report an admin later deleted would keep showing to anyone scanning its QR code.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Track Report — FireTrack',
  robots: { index: false, follow: false },
};

const REPORT_TYPE_LABELS = {
  MDFIR: 'MDFIR',
  SPOT_INVESTIGATION: 'Spot Investigation',
  PROGRESS_INVESTIGATION: 'Progress Investigation',
  FINAL_INVESTIGATION: 'Final Investigation',
  DAILY: 'Daily Report',
};

const STAGES = ['Investigator', 'Municipal Chief IIS', 'Municipal Fire Marshal', 'Provincial Chief IIS'];

// Same tiering as components/reports/ReportProgressBar.jsx — legacy roles map onto the tier they
// act as elsewhere in the app.
const stageIndexForRole = (role) => {
  if (role === 'MUNICIPAL_CHIEF_IIS' || role === 'MUNICIPAL_CHIEF_OPERATION') return 1;
  if (role === 'MUNICIPAL_FIRE_MARSHAL') return 2;
  if (role === 'PROVINCIAL_CHIEF_IIS' || role === 'MARSHAL' || role === 'CHIEF_INVESTIGATOR_IIS') return 3;
  return null;
};

const stageLabelForRole = (role) => {
  const index = stageIndexForRole(role);
  return index === null ? 'Reviewer' : STAGES[index];
};

const personLabel = (person) => (person ? [person.rank, person.name].filter(Boolean).join(' ') : null);

async function getTrackedReport(token) {
  const report = await prisma.report.findUnique({
    where: { qrToken: token },
    select: {
      id: true,
      reportType: true,
      status: true,
      reportDate: true,
      submittedAt: true,
      updatedAt: true,
      reviewedAt: true,
      passedToId: true,
      passedToRole: true,
      municipality: { select: { name: true } },
      submittedBy: { select: { name: true, rank: true } },
      passedTo: { select: { name: true, rank: true, role: true } },
      reviewedBy: { select: { name: true, rank: true, role: true } },
      incident: { select: { referenceNumber: true } },
    },
  });

  // A draft was never passed to anyone, so there's nothing to track yet.
  if (!report || report.status === REPORT_STATUS.DRAFT) return null;

  const reviewLogs = await prisma.auditLog.findMany({
    where: { reportId: report.id, action: { in: ['APPROVE_REPORT', 'RETURN_REPORT'] } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, action: true, userId: true, createdAt: true },
  });

  const reviewerIds = [...new Set(reviewLogs.map((log) => log.userId))];
  const reviewers = reviewerIds.length
    ? await prisma.user.findMany({ where: { id: { in: reviewerIds } }, select: { id: true, name: true, rank: true, role: true } })
    : [];
  const reviewerById = Object.fromEntries(reviewers.map((u) => [u.id, u]));

  // Oldest first: when it was first submitted, then every approval/return since.
  const timeline = [
    {
      key: 'submitted',
      kind: 'submitted',
      title: 'Submitted by investigator',
      who: personLabel(report.submittedBy),
      at: report.submittedAt,
    },
    ...reviewLogs.map((log) => {
      const reviewer = reviewerById[log.userId];
      const stage = stageLabelForRole(reviewer?.role);
      const approved = log.action === 'APPROVE_REPORT';
      return {
        key: log.id,
        kind: approved ? 'approved' : 'returned',
        title: approved ? `Approved by ${stage}` : `Returned by ${stage} for corrections`,
        who: personLabel(reviewer),
        at: log.createdAt,
      };
    }),
  ];

  return { report, timeline };
}

// Where the report is right now and who is holding it — the headline of the page.
function getCurrentLocation(report) {
  if (isFinallyApprovedReport(report)) {
    return {
      icon: ShieldCheck,
      title: 'Finalized',
      detail: 'Approved by the Provincial Chief IIS. This report is now an official BFP Benguet record.',
      holderLabel: 'Final approval by',
      holder: personLabel(report.reviewedBy) || 'Provincial Chief IIS',
      stageIndex: STAGES.length,
      tone: 'green',
    };
  }

  if (report.status === REPORT_STATUS.RETURNED) {
    const by = stageLabelForRole(report.reviewedBy?.role);
    return {
      icon: RotateCcw,
      title: 'Back with the investigator',
      detail: `Returned by the ${by} for corrections. It will move forward again once it is resubmitted.`,
      holderLabel: 'Being corrected by',
      holder: personLabel(report.submittedBy) || 'Investigator',
      stageIndex: 0,
      tone: 'orange',
    };
  }

  if (report.status === REPORT_STATUS.APPROVED) {
    const by = stageLabelForRole(report.reviewedBy?.role);
    const nextIndex = Math.min((stageIndexForRole(report.reviewedBy?.role) ?? 1) + 1, STAGES.length - 1);
    return {
      icon: Send,
      title: `Approved by ${by}`,
      detail: `Waiting for the investigator to forward it to the ${STAGES[nextIndex]}.`,
      holderLabel: 'Currently with',
      holder: personLabel(report.submittedBy) || 'Investigator',
      stageIndex: nextIndex,
      tone: 'blue',
    };
  }

  // SUBMITTED — sitting in a reviewer's queue.
  const stageIndex = stageIndexForRole(report.passedToRole) ?? 1;
  return {
    icon: Clock,
    title: `Under review — ${STAGES[stageIndex]}`,
    detail: `The ${STAGES[stageIndex]} is checking this report.`,
    holderLabel: 'Being checked by',
    holder: personLabel(report.passedTo) || STAGES[stageIndex],
    stageIndex,
    tone: 'amber',
  };
}

const TONES = {
  green: { banner: 'bg-bfp-green text-white', ring: 'ring-bfp-green', dot: 'bg-bfp-green' },
  orange: { banner: 'bg-orange-500 text-white', ring: 'ring-orange-500', dot: 'bg-orange-500' },
  blue: { banner: 'bg-blue-600 text-white', ring: 'ring-blue-600', dot: 'bg-blue-600' },
  amber: { banner: 'bg-bfp-amber text-bfp-navy', ring: 'ring-bfp-amber', dot: 'bg-bfp-amber' },
};

const TIMELINE_STYLES = {
  submitted: { icon: Send, className: 'bg-bfp-navy text-white' },
  approved: { icon: Check, className: 'bg-bfp-green text-white' },
  returned: { icon: RotateCcw, className: 'bg-orange-500 text-white' },
};

function InvalidState() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-bfp-navy via-bfp-navy to-black px-4">
      <div className="max-w-sm w-full rounded-lg bg-white shadow-2xl p-8 text-center">
        <XCircle className="mx-auto h-12 w-12 text-bfp-red" />
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-gray-900">Report Not Found</h1>
        <p className="mt-2 text-sm text-gray-500">
          This QR code doesn&rsquo;t match a report being tracked. It may have been mistyped, or the
          report it pointed to is no longer available.
        </p>
      </div>
    </div>
  );
}

export default async function TrackReportPage({ params }) {
  const tracked = await getTrackedReport(params.token);

  if (!tracked) return <InvalidState />;

  const { report, timeline } = tracked;
  const location = getCurrentLocation(report);
  const tone = TONES[location.tone];
  const LocationIcon = location.icon;
  const reportTypeLabel = REPORT_TYPE_LABELS[report.reportType] || report.reportType.replace(/_/g, ' ');
  const isFinal = location.tone === 'green';

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8 sm:py-10">
      <div className="mx-auto max-w-lg">
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <BFPCrest size={40} />
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-bfp-navy leading-tight">FireTrack</p>
            <p className="text-[11px] text-gray-500 leading-tight">Report Tracking &middot; BFP Benguet</p>
          </div>
        </div>

        <div className="rounded-xl bg-white shadow-md overflow-hidden">
          {/* Where is it now? */}
          <div className={`px-5 py-5 ${tone.banner}`}>
            <p className="text-[11px] font-bold uppercase tracking-widest opacity-80 flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> Where it is now
            </p>
            <div className="mt-2 flex items-start gap-3">
              <LocationIcon className="h-7 w-7 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xl font-bold leading-tight">{location.title}</p>
                <p className="mt-1 text-sm opacity-90">{location.detail}</p>
              </div>
            </div>
          </div>

          {/* Who has it */}
          <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-bfp-navy/10 text-bfp-navy">
              <UserCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">{location.holderLabel}</p>
              <p className="font-semibold text-bfp-navy truncate">{location.holder}</p>
            </div>
          </div>

          {/* Stage map */}
          <div className="px-5 py-5 border-b border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-4">Review route</p>
            <ol className="relative grid grid-cols-4 gap-1">
              {STAGES.map((stage, i) => {
                const done = i < location.stageIndex;
                const current = i === location.stageIndex;
                return (
                  <li key={stage} className="relative flex flex-col items-center text-center">
                    {i < STAGES.length - 1 && (
                      <span
                        className={`absolute top-4 left-1/2 h-1 w-full ${i < location.stageIndex ? 'bg-bfp-green' : 'bg-gray-200'}`}
                        aria-hidden="true"
                      />
                    )}
                    <span
                      className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                        done
                          ? 'bg-bfp-green text-white'
                          : current
                            ? `${tone.dot} text-white ring-4 ring-offset-2 ${tone.ring} ring-opacity-30`
                            : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {done ? <Check className="h-4 w-4" /> : i + 1}
                    </span>
                    <span className={`mt-2 text-[11px] leading-tight ${current ? 'font-bold text-bfp-navy' : 'text-gray-500'}`}>
                      {stage}
                    </span>
                    {current && <span className="mt-0.5 text-[10px] font-semibold uppercase text-bfp-red">Here</span>}
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Report identity */}
          <div className="px-5 py-5 border-b border-gray-100">
            {report.incident?.referenceNumber && (
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Reference Number</p>
                <p className="text-2xl font-semibold tracking-tight text-gray-900">{report.incident.referenceNumber}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Field icon={FileText} label="Report Type" value={reportTypeLabel} />
              <Field icon={Building2} label="Municipality" value={report.municipality?.name} />
              <Field icon={CalendarCheck} label="Report Date" value={formatDate(report.reportDate)} />
              <Field icon={Clock} label="Last Update" value={formatDateTime(report.updatedAt)} />
            </div>
          </div>

          {/* History */}
          <div className="px-5 py-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-4">History</p>
            <ol className="space-y-4">
              {[...timeline].reverse().map((event, i) => {
                const style = TIMELINE_STYLES[event.kind];
                const EventIcon = style.icon;
                return (
                  <li key={event.key} className="relative flex gap-3">
                    {i < timeline.length - 1 && (
                      <span className="absolute left-[13px] top-8 bottom-[-16px] w-0.5 bg-gray-200" aria-hidden="true" />
                    )}
                    <span className={`relative z-10 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${style.className}`}>
                      <EventIcon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 pb-1">
                      <p className="text-sm font-semibold text-bfp-navy">{event.title}</p>
                      {event.who && <p className="text-xs text-gray-600">{event.who}</p>}
                      <p className="text-xs text-gray-400">{formatDateTime(event.at)}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>

        <p className="mt-5 flex items-start justify-center gap-1.5 text-center text-xs text-gray-500">
          <Lock className="h-3.5 w-3.5 flex-shrink-0 mt-px" />
          <span>
            {isFinal
              ? 'This report is a finalized BFP Benguet record.'
              : 'This report is still moving through review — this page always shows its latest status.'}{' '}
            Report contents and files are only available to authorized personnel.
          </span>
        </p>
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      <Icon className="h-4 w-4 text-bfp-navy/50 mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="font-semibold text-bfp-navy break-words">{value || '-'}</p>
      </div>
    </div>
  );
}
