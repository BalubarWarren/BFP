import { ShieldCheck, FileText, Building2, User, CalendarCheck, XCircle, Clock, RotateCcw, Send, History } from 'lucide-react';
import prisma from '../../../lib/prisma';
import { isFinallyApprovedReport } from '../../../lib/report-access';
import { REPORT_STATUS } from '../../../lib/constants';
import { parseJsonField, formatDate, formatDateTime } from '../../../lib/utils';
import BFPCrest from '../../../components/common/BFPCrest';

// Public, unauthenticated landing page for a report's QR code (see lib/qr-token.js — issued when
// the investigator first passes the report and kept through every return and correction).
// Deliberately outside the (dashboard) route group — no login, no sidebar — since the whole point
// is that someone with no account can scan the code and land here directly. Always shows the
// report's *current* status and latest files, so a scanned printout of an older version is easy
// to tell apart from the finished record. Reachable only by guessing a 32-byte random token, and
// even then only ever shows the handful of fields below (never `content`, `remarks`, or anything
// else from the full report).
// Always read the database on each scan. Without this, Next caches the first render of each token,
// so a report an admin later deleted would keep showing as "Verified" to anyone scanning its QR code.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Verify Report — FireTrack',
  robots: { index: false, follow: false },
};

const REPORT_TYPE_LABELS = {
  MDFIR: 'MDFIR',
  SPOT_INVESTIGATION: 'Spot Investigation',
  PROGRESS_INVESTIGATION: 'Progress Investigation',
  FINAL_INVESTIGATION: 'Final Investigation',
  DAILY: 'Daily Report',
};

async function getVerifiedReport(token) {
  const report = await prisma.report.findUnique({
    where: { qrToken: token },
    include: {
      municipality: { select: { name: true } },
      submittedBy: { select: { name: true, rank: true } },
      reviewedBy: { select: { name: true } },
      // Only Spot/Progress/Final Investigation reports anchor a case (MDFIR/Daily reports don't),
      // so this is nullable — the reference number section below just doesn't render without it.
      incident: { select: { referenceNumber: true } },
    },
  });

  // A draft was never passed to anyone, so there's nothing to vouch for yet.
  if (!report || report.status === REPORT_STATUS.DRAFT) return null;

  const timesReturned = await prisma.auditLog.count({
    where: { reportId: report.id, action: 'RETURN_REPORT' },
  });
  return { report, timesReturned };
}

// "MUNICIPAL_FIRE_MARSHAL" -> "Municipal Fire Marshal", keeping "IIS" as an acronym.
const formatRole = (role) =>
  role
    .split('_')
    .map((word) => (word === 'IIS' ? word : word.charAt(0) + word.slice(1).toLowerCase()))
    .join(' ');

// The banner at the top of the card — the one thing someone scanning needs to read first.
function getStatusBanner(report) {
  if (isFinallyApprovedReport(report)) {
    return {
      icon: ShieldCheck,
      title: 'Verified Report',
      detail: 'Finally approved by the Provincial Chief IIS',
      className: 'bg-bfp-green/10 border-bfp-green/20 text-bfp-green',
    };
  }
  if (report.status === REPORT_STATUS.RETURNED) {
    return {
      icon: RotateCcw,
      title: 'Returned for Corrections',
      detail: 'Not yet an official record — the investigator is correcting this report',
      className: 'bg-orange-50 border-orange-200 text-orange-700',
    };
  }
  if (report.status === REPORT_STATUS.APPROVED) {
    return {
      icon: Send,
      title: 'Approved at Municipal Level',
      detail: 'Not yet an official record — awaiting final approval by the Provincial Chief IIS',
      className: 'bg-blue-50 border-blue-200 text-blue-700',
    };
  }
  return {
    icon: Clock,
    title: 'Under Review',
    detail: report.passedToRole
      ? `Not yet an official record — currently with the ${formatRole(report.passedToRole)}`
      : 'Not yet an official record — awaiting review',
    className: 'bg-amber-50 border-amber-200 text-amber-700',
  };
}

function InvalidState() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-bfp-navy via-bfp-navy to-black px-4">
      <div className="max-w-sm w-full rounded-lg bg-white shadow-2xl p-8 text-center">
        <XCircle className="mx-auto h-12 w-12 text-bfp-red" />
        <h1 className="mt-4 text-xl font-bold text-bfp-navy">Report Not Found</h1>
        <p className="mt-2 text-sm text-gray-500">
          This QR code doesn&rsquo;t match a verified report. It may have been mistyped, or the
          report it pointed to is no longer available.
        </p>
      </div>
    </div>
  );
}

export default async function VerifyReportPage({ params }) {
  const verified = await getVerifiedReport(params.token);

  if (!verified) return <InvalidState />;

  const { report, timesReturned } = verified;
  const isFinal = isFinallyApprovedReport(report);
  const banner = getStatusBanner(report);
  const BannerIcon = banner.icon;

  const attachments = parseJsonField(report.attachments, []);
  const reportTypeLabel = REPORT_TYPE_LABELS[report.reportType] || report.reportType.replace(/_/g, ' ');

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-lg">
        {/* Branding */}
        <div className="flex flex-col items-center text-center mb-6">
          <BFPCrest size={64} />
          <p className="mt-2 text-xs font-bold uppercase tracking-widest text-gray-600">FireTrack</p>
        </div>

        <div className="rounded-lg bg-white shadow-md overflow-hidden">
          {/* Status banner */}
          <div className={`border-b px-6 py-4 flex items-center gap-3 ${banner.className}`}>
            <BannerIcon className="h-6 w-6 flex-shrink-0" />
            <div>
              <p className="font-bold leading-tight">{banner.title}</p>
              <p className="text-xs opacity-80">{banner.detail}</p>
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-6">
            {report.incident?.referenceNumber && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Reference Number</p>
                <p className="text-2xl font-bold text-bfp-navy">{report.incident.referenceNumber}</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <Field icon={FileText} label="Report Type" value={reportTypeLabel} />
              <Field icon={Building2} label="Municipality" value={report.municipality?.name} />
              <Field icon={CalendarCheck} label="Report Date" value={formatDate(report.reportDate)} />
              <Field icon={User} label="Submitted By" value={report.submittedBy?.name} />
              {isFinal ? (
                <>
                  <Field icon={ShieldCheck} label="Approved By" value={report.reviewedBy?.name || 'Provincial Chief IIS'} />
                  <Field icon={CalendarCheck} label="Approved At" value={report.reviewedAt ? formatDateTime(report.reviewedAt) : '-'} />
                </>
              ) : (
                <Field icon={CalendarCheck} label="Last Updated" value={formatDateTime(report.updatedAt)} />
              )}
              <Field
                icon={History}
                label="Corrections"
                value={timesReturned === 0 ? 'None' : `Returned ${timesReturned} time${timesReturned === 1 ? '' : 's'} for corrections`}
              />
            </div>

            {/* Attachments — the actual "open the file" action the QR code exists for */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                {attachments.length > 1 ? 'Report Files' : 'Report File'}
              </p>
              {!isFinal && (
                <p className="text-xs text-gray-500 mb-2">
                  Latest submitted version — it may still change before final approval.
                </p>
              )}
              {attachments.length === 0 ? (
                <p className="text-sm text-gray-500">No files are attached to this report.</p>
              ) : (
                <div className="space-y-2">
                  {attachments.map((attachment) => (
                    <a
                      key={attachment.url}
                      href={attachment.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 hover:border-bfp-navy hover:bg-bfp-navy/5 transition-colors"
                    >
                      <FileText className="h-5 w-5 text-bfp-navy flex-shrink-0" />
                      <span className="flex-1 text-sm font-medium text-bfp-navy truncate">
                        {attachment.name || 'Open file'}
                      </span>
                      <span className="text-xs font-semibold text-gray-600">OPEN &rarr;</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          {isFinal
            ? 'This page confirms the report is an authentic, finally approved BFP Benguet record.'
            : 'This page shows the current status of a BFP Benguet report that is still being reviewed.'}{' '}
          For official use only.
        </p>
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 text-bfp-navy/50 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="font-semibold text-bfp-navy">{value || '-'}</p>
      </div>
    </div>
  );
}
