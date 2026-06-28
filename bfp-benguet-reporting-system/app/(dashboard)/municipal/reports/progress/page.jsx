'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import AttachmentInput from '@/components/reports/AttachmentInput';

export default function ProgressInvestigationForm() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [incidents, setIncidents] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [recipientRole, setRecipientRole] = useState('MUNICIPAL_CHIEF_IIS');

  const [formData, setFormData] = useState({
    reportDate: new Date().toISOString().split('T')[0],
    incidentId: '',
    investigationStatus: 'ONGOING',
    currentFindings: '',
    witnessStatements: '',
    evidenceCollected: '',
    suspectedCause: '',
    furtherActionsNeeded: '',
    respondingUnits: '',
    respondingOfficer: '',
    reportingOfficerRank: '',
    stationCommanderName: '',
  });

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) setUser(JSON.parse(userData));
    fetchIncidents();
  }, []);

  const fetchIncidents = async () => {
    try {
      const token = localStorage.getItem('token');
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
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.respondingOfficer) { setError('Please enter the reporting officer name.'); return; }
    if (!formData.currentFindings) { setError('Please enter current investigation findings.'); return; }

    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      let effectiveUser = user;
      if (!effectiveUser) {
        try {
          const meRes = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
          if (meRes.ok) {
            const meJson = await meRes.json();
            effectiveUser = meJson.user;
            localStorage.setItem('user', JSON.stringify(effectiveUser));
            setUser(effectiveUser);
          }
        } catch (e) {}
      }
      if (!effectiveUser) throw new Error('Not authenticated. Please sign in again.');
      const payload = new FormData();
      payload.append('reportType', 'PROGRESS_INVESTIGATION');
      payload.append('municipalityId', String(effectiveUser.municipalityId));
      if (formData.incidentId) payload.append('incidentId', formData.incidentId);
      payload.append('reportDate', formData.reportDate);
      payload.append('respondingUnits', formData.respondingUnits);
      payload.append('respondingOfficer', formData.respondingOfficer);
      payload.append('reportingOfficerRank', formData.reportingOfficerRank);
      payload.append('stationCommanderName', formData.stationCommanderName);
      payload.append('content', JSON.stringify({
        investigationStatus: formData.investigationStatus,
        currentFindings: formData.currentFindings,
        witnessStatements: formData.witnessStatements,
        evidenceCollected: formData.evidenceCollected,
        suspectedCause: formData.suspectedCause,
        furtherActionsNeeded: formData.furtherActionsNeeded,
      }));
      attachments.forEach((file) => payload.append('attachments', file));
      payload.append('passedToRole', recipientRole);

      await axios.post(
        '/api/reports',
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess('Progress Investigation Report submitted successfully.');
      setTimeout(() => router.push('/municipal'), 1500);
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
        <h1 className="text-2xl font-bold text-bfp-navy">⏳ Progress Investigation Report</h1>
        <p className="text-gray-500 text-sm mt-1">Follow-up report on an ongoing fire investigation.</p>
      </div>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}
      {success && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">{success}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Report Info */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-bold text-bfp-navy mb-4">Report Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Report Date *</label>
              <input type="date" name="reportDate" value={formData.reportDate} onChange={handleChange} className="form-input" required />
            </div>
            <div>
              <label className="form-label">Linked Incident (optional)</label>
              <select name="incidentId" value={formData.incidentId} onChange={handleChange} className="form-input">
                <option value="">— None / Not linked —</option>
                {incidents.map((inc) => (
                  <option key={inc.id} value={inc.id}>
                    {inc.referenceNumber} — {inc.generalCategory} ({new Date(inc.dateOfIncident).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Investigation Status</label>
              <select name="investigationStatus" value={formData.investigationStatus} onChange={handleChange} className="form-input">
                <option value="ONGOING">Ongoing</option>
                <option value="PENDING_ADDITIONAL_INFO">Pending Additional Info</option>
                <option value="NEAR_COMPLETION">Near Completion</option>
              </select>
            </div>
          </div>
        </div>

          {/* Findings */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-bold text-bfp-navy mb-4">Investigation Findings</h2>
          <div className="space-y-4">
            <div>
              <label className="form-label">Current Findings *</label>
              <textarea name="currentFindings" value={formData.currentFindings} onChange={handleChange} rows={4} className="form-input" placeholder="Describe the current state of the investigation and findings so far..." required />
            </div>
            <div>
              <label className="form-label">Witness Statements</label>
              <textarea name="witnessStatements" value={formData.witnessStatements} onChange={handleChange} rows={3} className="form-input" placeholder="Summary of witness accounts..." />
            </div>
            <div>
              <label className="form-label">Evidence Collected</label>
              <textarea name="evidenceCollected" value={formData.evidenceCollected} onChange={handleChange} rows={3} className="form-input" placeholder="List of physical evidence gathered..." />
            </div>
            <div>
              <label className="form-label">Suspected Cause</label>
              <input type="text" name="suspectedCause" value={formData.suspectedCause} onChange={handleChange} className="form-input" placeholder="e.g. Electrical fault, open flame, etc." />
            </div>
            <div>
              <label className="form-label">Further Actions Needed</label>
              <textarea name="furtherActionsNeeded" value={formData.furtherActionsNeeded} onChange={handleChange} rows={2} className="form-input" placeholder="Next steps or pending actions..." />
            </div>
          </div>
        </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-bold text-bfp-navy mb-4">Submit To</h2>
            <div>
              <label className="form-label">Recipient</label>
              <select value={recipientRole} onChange={(e) => setRecipientRole(e.target.value)} className="form-select max-w-xs">
                <option value="MUNICIPAL_CHIEF_IIS">Municipal Chief IIS</option>
                <option value="MUNICIPAL_CHIEF_OPERATION">Municipal Chief Operation</option>
                <option value="MUNICIPAL_FIRE_MARSHAL">Municipal Fire Marshal</option>
                <option value="PROVINCIAL_CHIEF_IIS">Provincial Chief IIS</option>
              </select>
            </div>
          </div>

          {/* Officer Details */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-bold text-bfp-navy mb-4">Officer Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Responding Units</label>
              <input type="text" name="respondingUnits" value={formData.respondingUnits} onChange={handleChange} className="form-input" placeholder="Unit names / call signs" />
            </div>
            <div>
              <label className="form-label">Reporting Officer *</label>
              <input type="text" name="respondingOfficer" value={formData.respondingOfficer} onChange={handleChange} className="form-input" placeholder="Full name" required />
            </div>
            <div>
              <label className="form-label">Officer Rank</label>
              <input type="text" name="reportingOfficerRank" value={formData.reportingOfficerRank} onChange={handleChange} className="form-input" placeholder="e.g. FO3" />
            </div>
            <div>
              <label className="form-label">Chief Incharge</label>
              <input type="text" name="stationCommanderName" value={formData.stationCommanderName} onChange={handleChange} className="form-input" placeholder="Full name" />
            </div>
          </div>
        </div>

        <AttachmentInput files={attachments} onChange={handleAttachmentChange} />

        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="btn btn-primary px-8">
            {loading ? 'Submitting…' : 'Submit Progress Investigation Report'}
          </button>
          <button type="button" onClick={() => router.back()} className="btn btn-secondary px-6">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
