'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { Clock, FileText, Send } from 'lucide-react';
import AttachmentInput from '../../../../../components/reports/AttachmentInput';
import RecipientSelect from '../../../../../components/reports/RecipientSelect';
import SubmitSuccessModal from '../../../../../components/reports/SubmitSuccessModal';
import AttachmentWarningModal from '../../../../../components/reports/AttachmentWarningModal';
import { useEffectiveUser } from '../../../../../hooks/useEffectiveUser';

export default function ProgressInvestigationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getEffectiveUser } = useEffectiveUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showAttachmentWarning, setShowAttachmentWarning] = useState(false);
  const [attachmentHighlight, setAttachmentHighlight] = useState(false);
  const [incidents, setIncidents] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const attachmentInputRef = useRef(null);
  const [recipientRole, setRecipientRole] = useState('MUNICIPAL_CHIEF_IIS');

  const [formData, setFormData] = useState({
    reportDate: new Date().toISOString().split('T')[0],
    incidentId: searchParams.get('incidentId') || '',
  });

  useEffect(() => {
    fetchIncidents();
  }, []);

  const fetchIncidents = async () => {
    try {
      const token = sessionStorage.getItem('token');
      const res = await axios.get('/api/incidents', { headers: { Authorization: `Bearer ${token}` } });
      setIncidents(res.data.incidents || []);
    } catch {
      // incidents list is optional
    }
  };

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
    if (!attachments.length) {
      setShowAttachmentWarning(true);
      setAttachmentHighlight(true);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const token = sessionStorage.getItem('token');
      const effectiveUser = await getEffectiveUser();
      if (!effectiveUser) throw new Error('Not authenticated. Please sign in again.');
      const payload = new FormData();
      payload.append('reportType', 'PROGRESS_INVESTIGATION');
      payload.append('municipalityId', String(effectiveUser.municipalityId));
      if (formData.incidentId) payload.append('incidentId', formData.incidentId);
      payload.append('reportDate', formData.reportDate);
      payload.append('content', JSON.stringify({}));
      attachments.forEach((file) => payload.append('attachments', file));
      payload.append('passedToRole', recipientRole);

      await axios.post(
        '/api/reports',
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess('Progress Investigation Report submitted successfully.');
      setShowSuccessModal(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit report.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-bfp-navy mb-2 flex items-center gap-1">
          ← Back
        </button>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-bfp-navy"><Clock className="w-6 h-6" /> Progress Investigation Report</h1>
        <p className="text-gray-500 text-sm mt-1">Follow-up report on an ongoing fire investigation.</p>
      </div>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}
      {success && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">{success}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Report Info */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-bfp-navy mb-4">
            <FileText className="w-5 h-5" /> Report Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Report Date <span className="text-bfp-red">*</span></label>
              <input type="date" name="reportDate" value={formData.reportDate} onChange={handleChange} className="form-input" required />
            </div>
            <div>
              <label className="form-label">Linked Incident (optional)</label>
              <select name="incidentId" value={formData.incidentId} onChange={handleChange} className="form-input">
                <option value="" className="text-gray-400">— None / Not linked —</option>
                {incidents.map((inc) => (
                  <option key={inc.id} value={inc.id}>
                    {inc.referenceNumber} — {inc.generalCategory} ({new Date(inc.dateOfIncident).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-bfp-navy mb-4">
              <Send className="w-5 h-5" /> Submit To
            </h2>
            <div>
              <label className="form-label">Recipient</label>
              <RecipientSelect value={recipientRole} onChange={setRecipientRole} />
            </div>
          </div>

        <AttachmentInput
          ref={attachmentInputRef}
          files={attachments}
          onChange={handleAttachmentChange}
          highlight={attachmentHighlight}
        />

        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="btn btn-primary px-8">
            {loading ? 'Submitting…' : 'Submit Progress Investigation Report'}
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
        <AttachmentWarningModal onConfirm={goToAttachments} />
      )}
    </div>
  );
}
