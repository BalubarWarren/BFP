'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Search } from 'lucide-react';
import { GENERAL_CATEGORIES } from '@/lib/constants';
import AttachmentInput from '@/components/reports/AttachmentInput';

export default function SpotInvestigationForm() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [recipientRole, setRecipientRole] = useState('MUNICIPAL_CHIEF_IIS');
  const [textBlastFiles, setTextBlastFiles] = useState([]);
  const [textBlastMessage, setTextBlastMessage] = useState('');
  const [textBlastLoading, setTextBlastLoading] = useState(false);
  const [textBlastStatus, setTextBlastStatus] = useState('');

  const [formData, setFormData] = useState({
    reportDate: new Date().toISOString().split('T')[0],
    dateOfIncident: new Date().toISOString().split('T')[0],
    timeOfIncident: '00:00',
    category: '',
    description: '',
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

  const handleTextBlastFileChange = (e) => {
    setTextBlastFiles(Array.from(e.target.files || []));
  };

  const handleTextBlast = async () => {
    if (!textBlastFiles.length) {
      setTextBlastStatus('Attach at least one file before sending.');
      return;
    }

    setTextBlastLoading(true);
    setTextBlastStatus('');

    try {
      const token = sessionStorage.getItem('token');
      const payload = new FormData();
      payload.append('message', textBlastMessage);
      textBlastFiles.forEach((file) => payload.append('attachments', file));

      const response = await axios.post('/api/reports/text-blast', payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setTextBlastFiles([]);
      setTextBlastMessage('');
      setTextBlastStatus(response.data.message || 'Text blast sent successfully.');
    } catch (err) {
      setTextBlastStatus(err.response?.data?.error || 'Failed to send text blast.');
    } finally {
      setTextBlastLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.category) { setError('Please select a fire category.'); return; }

    setLoading(true);
    setError('');
    try {
      const token = sessionStorage.getItem('token');
      let effectiveUser = user;
      if (!effectiveUser) {
        // try to refresh user from API using token
        try {
          const meRes = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
          if (meRes.ok) {
            const meJson = await meRes.json();
            effectiveUser = meJson.user;
            sessionStorage.setItem('user', JSON.stringify(effectiveUser));
            setUser(effectiveUser);
          }
        } catch (e) {
          // ignore and continue; submission will fail with clearer error
        }
      }
      if (!effectiveUser) throw new Error('Not authenticated. Please sign in again.');
      const payload = new FormData();
      payload.append('reportType', 'SPOT_INVESTIGATION');
      payload.append('municipalityId', String(effectiveUser.municipalityId));
      payload.append('reportDate', formData.reportDate);
      payload.append('category', formData.category);
      payload.append('content', JSON.stringify({
        dateOfIncident: formData.dateOfIncident,
        timeOfIncident: formData.timeOfIncident,
        description: formData.description,
      }));
      attachments.forEach((file) => payload.append('attachments', file));
      payload.append('passedToRole', recipientRole);

      await axios.post('/api/reports', payload, { headers: { Authorization: `Bearer ${token}` } });
      setSuccess('Spot Investigation Report submitted successfully.');
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
        <h1 className="flex items-center gap-2 text-2xl font-bold text-bfp-navy"><Search className="w-6 h-6" /> Spot Investigation Report</h1>
        <p className="text-gray-500 text-sm mt-1">On-site preliminary investigation of a fire incident.</p>
      </div>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}
      {success && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">{success}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Incident Details */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-bold text-bfp-navy mb-4">Incident Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Report Date *</label>
              <input type="date" name="reportDate" value={formData.reportDate} onChange={handleChange} className="form-input" required />
            </div>
            <div>
              <label className="form-label">Category *</label>
              <select name="category" value={formData.category} onChange={handleChange} className="form-input" required>
                <option value="">— Select —</option>
                {Object.keys(GENERAL_CATEGORIES).map((k) => (
                  <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label className="form-label">Description of Incident</label>
            <textarea name="description" value={formData.description} onChange={handleChange} rows={3} className="form-input" placeholder="Brief description of what happened..." />
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

        <AttachmentInput files={attachments} onChange={handleAttachmentChange} />

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-bold text-bfp-navy mb-4">Text Blast</h2>
          <div className="space-y-4">
            <div>
              <label className="form-label">Attach File</label>
              <input type="file" multiple onChange={handleTextBlastFileChange} className="form-input" />
              {textBlastFiles.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm text-gray-600">
                  {textBlastFiles.map((file) => (
                    <li key={`${file.name}-${file.size}`}>{file.name}</li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label className="form-label">Message</label>
              <textarea
                value={textBlastMessage}
                onChange={(e) => setTextBlastMessage(e.target.value)}
                rows={3}
                className="form-input"
                placeholder="Optional note"
              />
            </div>

            {textBlastStatus && (
              <div className="text-sm text-gray-700 bg-gray-100 border border-gray-200 rounded p-3">
                {textBlastStatus}
              </div>
            )}

            <button
              type="button"
              onClick={handleTextBlast}
              disabled={textBlastLoading}
              className="btn btn-success px-6"
            >
              {textBlastLoading ? 'Sending...' : 'Text Blast'}
            </button>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="btn btn-primary px-8">
            {loading ? 'Submitting…' : 'Submit Spot Investigation Report'}
          </button>
          <button type="button" onClick={() => router.back()} className="btn btn-secondary px-6">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
