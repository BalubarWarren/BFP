'use client';

import { useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, FileText, Send, User, HeartPulse } from 'lucide-react';
import AttachmentInput, { hasInvalidAttachments } from '../../../../../components/reports/AttachmentInput';
import RecipientSelect from '../../../../../components/reports/RecipientSelect';
import SubmitSuccessModal from '../../../../../components/reports/SubmitSuccessModal';
import AttachmentWarningModal from '../../../../../components/reports/AttachmentWarningModal';
import { useEffectiveUser } from '../../../../../hooks/useEffectiveUser';
import BackButton from '../../../../../components/common/BackButton';
import PageHeader from '../../../../../components/common/PageHeader';
import RankSelect from '../../../../../components/common/RankSelect';
import { submitReport } from '../../../../../lib/submit-report';
import CaseSelect from '../../../../../components/reports/CaseSelect';
import SupportingDocsInput from '../../../../../components/reports/SupportingDocsInput';
import LateExplanationField from '../../../../../components/reports/LateExplanationField';
import { getSubmissionDeadline } from '../../../../../lib/report-timeliness';
import { CAUSES_OF_FIRE } from '../../../../../lib/incident-details';

export default function FinalInvestigationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getEffectiveUser } = useEffectiveUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submittedReport, setSubmittedReport] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showAttachmentWarning, setShowAttachmentWarning] = useState(false);
  const [attachmentWarningKind, setAttachmentWarningKind] = useState('missing');
  const [attachmentHighlight, setAttachmentHighlight] = useState(false);
  const [attachments, setAttachments] = useState([]);
  // Optional EMS (Emergency Medical Services) report — left empty when there was no EMS response.
  const [emsFiles, setEmsFiles] = useState([]);
  const [emsHighlight, setEmsHighlight] = useState(false);
  const emsInputRef = useRef(null);
  const attachmentInputRef = useRef(null);
  const [recipientRole, setRecipientRole] = useState('MUNICIPAL_CHIEF_IIS');
  const [supportingDocs, setSupportingDocs] = useState([]);
  const [lateExplanation, setLateExplanation] = useState('');
  // The chosen case (its Spot/Progress reports), which sets this report's deadline.
  const [selectedCase, setSelectedCase] = useState(null);
  const deadline = selectedCase
    ? getSubmissionDeadline('FINAL_INVESTIGATION', { caseReports: [selectedCase.spot, ...(selectedCase.progressReports || [])] })
    : null;
  const isLate = !!(deadline && new Date() > deadline);

  const [formData, setFormData] = useState({
    reportDate: new Date().toISOString().split('T')[0],
    incidentId: searchParams.get('incidentId') || '',
    respondingUnits: '',
    respondingOfficer: '',
    reportingOfficerRank: '',
    stationCommanderName: '',
    casualtiesInjured: '',
    casualtiesFatalities: '',
    rescueOperations: '',
    causeOfFire: '',
    causeOfFireOther: '',
  });

  // Started from a Spot report's "Start ... Report" button: the case is fixed to that Spot report.
  const caseLocked = !!searchParams.get('incidentId');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAttachmentChange = (e) => {
    setAttachments(Array.from(e.target.files || []));
    setAttachmentHighlight(false);
  };

  const goToAttachments = () => {
    setShowAttachmentWarning(false);
    attachmentInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    attachmentInputRef.current?.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.incidentId) {
      setError('Select the Spot report this report continues.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!formData.respondingOfficer) { setError('Please enter the reporting officer name.'); return; }
    if (!formData.causeOfFire || (formData.causeOfFire === 'Other' && !formData.causeOfFireOther.trim())) {
      setError('Please state the cause of fire.');
      return;
    }
    if (!attachments.length) {
      setAttachmentWarningKind('missing');
      setShowAttachmentWarning(true);
      setAttachmentHighlight(true);
      return;
    }
    if (hasInvalidAttachments(attachments)) {
      setAttachmentWarningKind('invalid');
      setShowAttachmentWarning(true);
      setAttachmentHighlight(true);
      return;
    }

    if (hasInvalidAttachments(supportingDocs.map((doc) => doc.file))) {
      setError('One or more supporting documents are too large or an unsupported type. Remove or replace them before submitting.');
      return;
    }

    if (hasInvalidAttachments(emsFiles)) {
      setError('One or more EMS report files are too large or an unsupported type. Remove or replace them before submitting.');
      setEmsHighlight(true);
      emsInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setLoading(true);
    setError('');
    try {
      const effectiveUser = await getEffectiveUser();
      if (!effectiveUser) throw new Error('Not authenticated. Please sign in again.');
      const response = await submitReport({
        fields: {
          reportType: 'FINAL_INVESTIGATION',
          municipalityId: String(effectiveUser.municipalityId),
          incidentId: formData.incidentId || undefined,
          reportDate: formData.reportDate,
          respondingUnits: formData.respondingUnits,
          respondingOfficer: formData.respondingOfficer,
          reportingOfficerRank: formData.reportingOfficerRank,
          stationCommanderName: formData.stationCommanderName,
          // Blank = keep the casualty counts recorded on the Spot report.
          content: JSON.stringify({
            ...(formData.casualtiesInjured !== '' && { casualtiesInjured: Number(formData.casualtiesInjured) || 0 }),
            ...(formData.casualtiesFatalities !== '' && { casualtiesFatalities: Number(formData.casualtiesFatalities) || 0 }),
            ...(formData.rescueOperations !== '' && { rescueOperations: Number(formData.rescueOperations) || 0 }),
            causeOfFire: formData.causeOfFire === 'Other' ? formData.causeOfFireOther.trim() : formData.causeOfFire,
            ...(isLate && { lateExplanation: lateExplanation.trim() }),
          }),
          passedToRole: recipientRole,
        },
        files: attachments,
        emsFiles,
        supportingDocs,
      });
      setSubmittedReport(response.data.report);
      setSuccess('Final Investigation Report submitted successfully.');
      setShowSuccessModal(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit report.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <BackButton className="mb-3" />
        <PageHeader icon={CheckCircle2} eyebrow="Investigation Report" title="Final Investigation Report" description="Completed investigation report with cause of fire and final findings." border={false} />
      </div>

      {error && <div className="alert alert-error mb-4">{error}</div>}
      {success && <div className="alert alert-success mb-4">{success}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Report Info */}
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-gray-900 mb-4">
            <FileText className="w-5 h-5" /> Report Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Report Date <span className="text-bfp-red">*</span></label>
              <input type="date" name="reportDate" value={formData.reportDate} onChange={handleChange} className="form-input" required />
            </div>
            <div>
              <label className="form-label">Linked Spot report (case) <span className="text-bfp-red">*</span></label>
              <CaseSelect value={formData.incidentId} onChange={handleChange} reportType="FINAL_INVESTIGATION" locked={caseLocked} onCaseChange={setSelectedCase} />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Cause of Fire <span className="text-bfp-red">*</span></label>
              <select name="causeOfFire" value={formData.causeOfFire} onChange={handleChange} className="form-input" required>
                <option value="">— Select —</option>
                {CAUSES_OF_FIRE.map((cause) => (
                  <option key={cause} value={cause}>{cause}</option>
                ))}
                <option value="Other">Other (specify)</option>
              </select>
            </div>
            {formData.causeOfFire === 'Other' && (
              <div>
                <label className="form-label">Specify the cause <span className="text-bfp-red">*</span></label>
                <input type="text" name="causeOfFireOther" value={formData.causeOfFireOther} onChange={handleChange} className="form-input" maxLength={200} required />
              </div>
            )}
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="form-label">Final count: Injured</label>
              <input type="number" name="casualtiesInjured" value={formData.casualtiesInjured} onChange={handleChange} className="form-input" min="0" max="9999" step="1" inputMode="numeric" placeholder="Leave blank to keep the Spot report count" />
            </div>
            <div>
              <label className="form-label">Final count: Fatalities</label>
              <input type="number" name="casualtiesFatalities" value={formData.casualtiesFatalities} onChange={handleChange} className="form-input" min="0" max="9999" step="1" inputMode="numeric" placeholder="Leave blank to keep the Spot report count" />
            </div>
            <div>
              <label className="form-label">Final count: Rescue Operations</label>
              <input type="number" name="rescueOperations" value={formData.rescueOperations} onChange={handleChange} className="form-input" min="0" max="9999" step="1" inputMode="numeric" placeholder="Leave blank to keep" />
            </div>
          </div>
        </div>

          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-gray-900 mb-4">
              <Send className="w-5 h-5" /> Submit To
            </h2>
            <div>
              <label className="form-label">Recipient</label>
              <RecipientSelect value={recipientRole} onChange={setRecipientRole} />
            </div>
          </div>

          {/* Officer Details */}
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-gray-900 mb-4">
            <User className="w-5 h-5" /> Officer Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Responding Units</label>
              <input type="text" name="respondingUnits" value={formData.respondingUnits} onChange={handleChange} className="form-input" placeholder="Unit names / call signs" />
            </div>
            <div>
              <label className="form-label">Reporting Officer <span className="text-bfp-red">*</span></label>
              <input type="text" name="respondingOfficer" value={formData.respondingOfficer} onChange={handleChange} className="form-input" placeholder="Full name" required />
            </div>
            <div>
              <label className="form-label">Officer Rank</label>
              <RankSelect name="reportingOfficerRank" value={formData.reportingOfficerRank} onChange={handleChange} />
            </div>
            <div>
              <label className="form-label">Chief Incharge</label>
              <input type="text" name="stationCommanderName" value={formData.stationCommanderName} onChange={handleChange} className="form-input" placeholder="Full name" />
            </div>
          </div>
        </div>

        <AttachmentInput
          ref={attachmentInputRef}
          files={attachments}
          onChange={handleAttachmentChange}
          highlight={attachmentHighlight}
        />

        <AttachmentInput
          ref={emsInputRef}
          files={emsFiles}
          onChange={(e) => {
            setEmsFiles(Array.from(e.target.files || []));
            setEmsHighlight(false);
          }}
          highlight={emsHighlight}
          icon={HeartPulse}
          title="EMS Report (optional)"
          label="Attach EMS Report"
          description="Attach the Emergency Medical Services report if EMS responded to this incident. Leave this blank if it isn't needed."
        />

        <SupportingDocsInput docs={supportingDocs} onChange={setSupportingDocs} />

        {isLate && <LateExplanationField deadline={deadline} value={lateExplanation} onChange={setLateExplanation} />}

        <div className="flex gap-3 flex-wrap">
          <button type="submit" disabled={loading} className="btn btn-primary px-8">
            {loading ? 'Submitting…' : 'Submit Final Investigation Report'}
          </button>
          <button type="button" onClick={() => router.back()} className="btn btn-secondary px-6">
            Cancel
          </button>
        </div>
      </form>

      {showSuccessModal && (
        <SubmitSuccessModal
          message={success}
          onConfirm={() => router.push('/municipal')}
          report={submittedReport}
        />
      )}

      {showAttachmentWarning && (
        <AttachmentWarningModal
          onConfirm={goToAttachments}
          title={attachmentWarningKind === 'invalid' ? 'Invalid Attachment' : undefined}
          message={attachmentWarningKind === 'invalid' ? 'One or more attached files are too large or an unsupported type. Remove or replace them before submitting.' : undefined}
        />
      )}
    </div>
  );
}
