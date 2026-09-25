import { ShieldCheck, FileText, Building2, User, CalendarCheck, XCircle } from 'lucide-react';
import prisma from '../../../lib/prisma';
import { isFinallyApprovedReport } from '../../../lib/report-access';
import { parseJsonField, formatDate, formatDateTime } from '../../../lib/utils';
import BFPCrest from '../../../components/common/BFPCrest';

// Public, unauthenticated landing page for the QR code printed/shown on a finally-approved
// report (see qrToken in prisma/schema.prisma and its generation in POST
// /api/reports/[id]/approve). Deliberately outside the (dashboard) route group — no login, no
// sidebar — since the whole point is that someone with no account can scan the code and land
// here directly. Reachable only by guessing a 32-byte random token, and even then only ever
// shows the handful of fields below (never `content`, `remarks`, or anything else from the full
// report) — the same minimal footprint as the printed report itself.
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
  // qrToken is only ever written by the final-approval branch of POST /api/reports/[id]/approve,
  // and PATCH /api/reports/[id] refuses to edit a finally-approved report afterward — so finding
  // a report by qrToken should always mean isFinallyApprovedReport is already true. The check is
  // kept anyway as the actual security boundary this page relies on, not the lookup itself.
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

  if (!report || !isFinallyApprovedReport(report)) return null;
  return report;
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
  const report = await getVerifiedReport(params.token);

  if (!report) return <InvalidState />;

  const attachments = parseJsonField(report.attachments, []);
  const reportTypeLabel = REPORT_TYPE_LABELS[report.reportType] || report.reportType.replace(/_/g, ' ');

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-lg">
        {/* Branding */}
        <div className="flex flex-col items-center text-center mb-6">
          <BFPCrest size={64} />
          <p className="mt-2 text-xs font-bold uppercase tracking-widest text-bfp-navy/60">FireTrack</p>
        </div>

        <div className="rounded-lg bg-white shadow-md overflow-hidden">
          {/* Verified banner */}
          <div className="bg-bfp-green/10 border-b border-bfp-green/20 px-6 py-4 flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-bfp-green flex-shrink-0" />
            <div>
              <p className="font-bold text-bfp-green leading-tight">Verified Report</p>
              <p className="text-xs text-bfp-green/80">
                Finally approved by the Provincial Chief IIS
              </p>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {report.incident?.referenceNumber && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Reference Number</p>
                <p className="text-2xl font-bold text-bfp-navy">{report.incident.referenceNumber}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <Field icon={FileText} label="Report Type" value={reportTypeLabel} />
              <Field icon={Building2} label="Municipality" value={report.municipality?.name} />
              <Field icon={CalendarCheck} label="Report Date" value={formatDate(report.reportDate)} />
              <Field icon={User} label="Submitted By" value={report.submittedBy?.name} />
              <Field icon={ShieldCheck} label="Approved By" value={report.reviewedBy?.name || 'Provincial Chief IIS'} />
              <Field icon={CalendarCheck} label="Approved At" value={report.reviewedAt ? formatDateTime(report.reviewedAt) : '-'} />
            </div>

            {/* Attachments — the actual "open the file" action the QR code exists for */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                {attachments.length > 1 ? 'Report Files' : 'Report File'}
              </p>
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
                      <span className="text-xs font-semibold text-bfp-navy/60">OPEN &rarr;</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          This page confirms the report is an authentic, finally approved BFP Benguet record.
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
