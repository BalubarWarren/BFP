'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { CheckCircle2 } from 'lucide-react';
import AttachmentInput from '@/components/reports/AttachmentInput';

export default function FinalInvestigationForm() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [recipientRole, setRecipientRole] = useState('MUNICIPAL_CHIEF_IIS');

  const [formData, setFormData] = useState({
    reportDate: new Date().toISOString().split('T')[0],
    respondingUnits: '',
    respondingOfficer: '',
    reportingOfficerRank: '',
    stationCommanderName: '',
  });

  useEffect(() => {
    const userData = sessionStorage.getItem('user');
    if (userData) setUser(JSON.parse(userData));
  }, []);

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

    setLoading(true);
    setError('');
    try {
      const token = sessionStorage.getItem('token');
      let effectiveUser = user;
      if (!effectiveUser) {
        try {
          const meRes = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
          if (meRes.ok) {
            const meJson = await meRes.json();
            effectiveUser = meJson.user;
            sessionStorage.setItem('user', JSON.stringify(effectiveUser));
            setUser(effectiveUser);
          }
        } catch (e) {}
      }
      if (!effectiveUser) throw new Error('Not authenticated. Please sign in again.');
      const payload = new FormData();
      payload.append('reportType', 'FINAL_INVESTIGATION');
      payload.append('municipalityId', String(effectiveUser.municipalityId));
      payload.append('reportDate', formData.reportDate);
      payload.append('respondingUnits', formData.respondingUnits);
      payload.append('respondingOfficer', formData.respondingOfficer);
      payload.append('reportingOfficerRank', formData.reportingOfficerRank);
      payload.append('stationCommanderName', formData.stationCommanderName);
      payload.append('content', JSON.stringify({}));
      attachments.forEach((file) => payload.append('attachments', file));
      payload.append('passedToRole', recipientRole);

      await axios.post(
        '/api/reports',
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess('Final Investigation Report submitted successfully.');
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
        <h1 className="flex items-center gap-2 text-2xl font-bold text-bfp-navy"><CheckCircle2 className="w-6 h-6" /> Final Investigation Report</h1>
        <p className="text-gray-500 text-sm mt-1">Completed investigation report with cause of fire and final findings.</p>
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
            {loading ? 'Submitting…' : 'Submit Final Investigation Report'}
          </button>
          <button type="button" onClick={() => router.back()} className="btn btn-secondary px-6">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
