'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ClipboardList, Send, HeartPulse } from 'lucide-react';
import { GENERAL_CATEGORIES, SUB_CATEGORIES } from '../../../../../lib/constants';
import AttachmentInput, { hasInvalidAttachments } from '../../../../../components/reports/AttachmentInput';
import RecipientSelect from '../../../../../components/reports/RecipientSelect';
import FieldIcon from '../../../../../components/reports/FieldIcon';
import SubmitSuccessModal from '../../../../../components/reports/SubmitSuccessModal';
import AttachmentWarningModal from '../../../../../components/reports/AttachmentWarningModal';
import { useEffectiveUser } from '../../../../../hooks/useEffectiveUser';
import BackButton from '../../../../../components/common/BackButton';
import PageHeader from '../../../../../components/common/PageHeader';
import { submitReport } from '../../../../../lib/submit-report';

export default function SpotInvestigationForm() {
  const router = useRouter();
  const { getEffectiveUser } = useEffectiveUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
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

  const [formData, setFormData] = useState({
    reportDate: new Date().toISOString().split('T')[0],
    dateOfIncident: new Date().toISOString().split('T')[0],
    timeOfIncident: '00:00',
    category: '',
    subCategory: '',
    description: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'category') {
      setFormData((prev) => ({ ...prev, category: value, subCategory: '' }));
      return;
    }
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
    if (!formData.category) { setError('Please select a fire category.'); return; }
    if (!formData.subCategory) { setError('Please select a sub-category.'); return; }
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
      await submitReport({
        fields: {
          reportType: 'SPOT_INVESTIGATION',
          municipalityId: String(effectiveUser.municipalityId),
          reportDate: formData.reportDate,
          category: formData.category,
          subCategory: formData.subCategory,
          content: JSON.stringify({
            dateOfIncident: formData.dateOfIncident,
            timeOfIncident: formData.timeOfIncident,
            description: formData.description,
          }),
          passedToRole: recipientRole,
        },
        files: attachments,
        emsFiles,
      });
      setSuccess('Spot Investigation Report submitted successfully.');
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
        <PageHeader icon={Search} eyebrow="Investigation Report" title="Spot Investigation Report" description="On-site preliminary investigation of a fire incident." border={false} />
      </div>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}
      {success && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">{success}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Incident Details */}
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-bfp-navy mb-4">
            <ClipboardList className="w-5 h-5" /> Incident Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Report Date</label>
              <div className="form-field-icon-wrap">
                <FieldIcon src="/icons/calendar.svg" />
                <input type="date" name="reportDate" value={formData.reportDate} onChange={handleChange} className="form-input-icon" required />
              </div>
            </div>
            <div>
              <label className="form-label">Category</label>
              <div className="form-field-icon-wrap">
                <FieldIcon src="/icons/category.svg" />
                <select name="category" value={formData.category} onChange={handleChange} className="form-select-icon" required>
                  <option value="" className="text-gray-400">— Select —</option>
                  {Object.keys(GENERAL_CATEGORIES).map((k) => (
                    <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
            </div>
            {formData.category && (
              <div>
                <label className="form-label">Sub-Category</label>
                <div className="form-field-icon-wrap">
                  <FieldIcon src="/icons/subcategory.svg" />
                  <select name="subCategory" value={formData.subCategory} onChange={handleChange} className="form-select-icon" required>
                    <option value="" className="text-gray-400">— Select —</option>
                    {(SUB_CATEGORIES[formData.category] || []).map((sub) => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
          <div className="mt-4">
            <label className="form-label">Description of Incident</label>
            <div className="form-field-icon-wrap">
              <FieldIcon src="/icons/description.svg" />
              <textarea name="description" value={formData.description} onChange={handleChange} rows={3} className="form-textarea-icon" placeholder="Brief description of what happened..." />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-bfp-navy mb-4">
            <Send className="w-5 h-5" /> Submit To
          </h2>
          <div>
            <label className="form-label">Recipient</label>
            <div className="form-field-icon-wrap max-w-xs">
              <FieldIcon src="/icons/recipient.svg" />
              <RecipientSelect value={recipientRole} onChange={setRecipientRole} className="form-select-icon" />
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

        <div className="flex gap-3 flex-wrap">
          <button type="submit" disabled={loading} className="btn btn-primary px-8">
            {loading ? 'Submitting…' : 'Submit Spot Investigation Report'}
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
