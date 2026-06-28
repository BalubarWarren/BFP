'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { GENERAL_CATEGORIES, SUB_CATEGORIES } from '@/lib/constants';
import AttachmentInput from '@/components/reports/AttachmentInput';

export default function MinimalDamageFireIncidentReportForm() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [recipientRole, setRecipientRole] = useState('MUNICIPAL_CHIEF_IIS');

  const [formData, setFormData] = useState({
    reportDate: new Date().toISOString().split('T')[0],
    dateOfIncident: new Date().toISOString().split('T')[0],
    timeOfIncident: '00:00',
    barangay: '',
    address: '',
    generalCategory: '',
    subCategory: '',
    propertyOwner: '',
    occupancyType: '',
    description: '',
    damageDescription: '',
    estimatedDamage: '',
    casualtiesInjured: 0,
    casualtiesFatalities: 0,
    probableCause: '',
    actionTaken: '',
    respondingUnits: '',
    respondingOfficer: '',
    reportingOfficerRank: '',
    stationCommanderName: '',
  });

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) setUser(JSON.parse(userData));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: ['casualtiesInjured', 'casualtiesFatalities'].includes(name)
        ? parseInt(value) || 0
        : value,
    }));
  };

  const handleAttachmentChange = (e) => {
    setAttachments(Array.from(e.target.files || []));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.generalCategory) { setError('Please select a fire category.'); return; }
    if (!formData.estimatedDamage) { setError('Please enter the estimated damage.'); return; }
    if (!formData.respondingOfficer) { setError('Please enter the reporting officer name.'); return; }

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
      payload.append('reportType', 'MDFIR');
      payload.append('municipalityId', String(effectiveUser.municipalityId));
      payload.append('reportDate', formData.reportDate);
      payload.append('respondingUnits', formData.respondingUnits);
      payload.append('respondingOfficer', formData.respondingOfficer);
      payload.append('reportingOfficerRank', formData.reportingOfficerRank);
      payload.append('stationCommanderName', formData.stationCommanderName);
      payload.append('content', JSON.stringify({
        reportName: 'Minimal Damage Fire Incident Report',
        dateOfIncident: formData.dateOfIncident,
        timeOfIncident: formData.timeOfIncident,
        barangay: formData.barangay,
        address: formData.address,
        generalCategory: formData.generalCategory,
        subCategory: formData.subCategory,
        propertyOwner: formData.propertyOwner,
        occupancyType: formData.occupancyType,
        description: formData.description,
        damageDescription: formData.damageDescription,
        estimatedDamage: formData.estimatedDamage,
        casualtiesInjured: formData.casualtiesInjured,
        casualtiesFatalities: formData.casualtiesFatalities,
        probableCause: formData.probableCause,
        actionTaken: formData.actionTaken,
      }));
      attachments.forEach((file) => payload.append('attachments', file));
      payload.append('passedToRole', recipientRole);

      await axios.post('/api/reports', payload, { headers: { Authorization: `Bearer ${token}` } });
      setSuccess('MDFIR submitted successfully.');
      setTimeout(() => router.push('/municipal'), 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit MDFIR.');
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
        <h1 className="text-2xl font-bold text-bfp-navy">📝 MDFIR</h1>
        <p className="text-gray-500 text-sm mt-1">Minimal Damage Fire Incident Report for documented low-damage fire incidents.</p>
      </div>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}
      {success && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">{success}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-bold text-bfp-navy mb-4">Incident Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Report Date *</label>
              <input type="date" name="reportDate" value={formData.reportDate} onChange={handleChange} className="form-input" required />
            </div>
            <div>
              <label className="form-label">Date of Incident *</label>
              <input type="date" name="dateOfIncident" value={formData.dateOfIncident} onChange={handleChange} className="form-input" required />
            </div>
            <div>
              <label className="form-label">Time of Incident</label>
              <input type="time" name="timeOfIncident" value={formData.timeOfIncident} onChange={handleChange} className="form-input" />
            </div>
            <div>
              <label className="form-label">Barangay</label>
              <input type="text" name="barangay" value={formData.barangay} onChange={handleChange} className="form-input" placeholder="Barangay name" />
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Address</label>
              <input type="text" name="address" value={formData.address} onChange={handleChange} className="form-input" placeholder="Street / building address" />
            </div>
            <div>
              <label className="form-label">General Category *</label>
              <select name="generalCategory" value={formData.generalCategory} onChange={(e) => setFormData((p) => ({ ...p, generalCategory: e.target.value, subCategory: '' }))} className="form-input" required>
                <option value="">— Select —</option>
                {Object.keys(GENERAL_CATEGORIES).map((key) => (
                  <option key={key} value={key}>{key.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Sub-Category</label>
              <select name="subCategory" value={formData.subCategory} onChange={handleChange} className="form-input" disabled={!formData.generalCategory}>
                <option value="">— Select —</option>
                {(SUB_CATEGORIES[formData.generalCategory] || []).map((subcategory) => (
                  <option key={subcategory} value={subcategory}>{subcategory}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Property Owner / Occupant</label>
              <input type="text" name="propertyOwner" value={formData.propertyOwner} onChange={handleChange} className="form-input" placeholder="Full name or establishment" />
            </div>
            <div>
              <label className="form-label">Occupancy Type</label>
              <input type="text" name="occupancyType" value={formData.occupancyType} onChange={handleChange} className="form-input" placeholder="e.g. Residential, sari-sari store" />
            </div>
            <div>
              <label className="form-label">Casualties — Injured</label>
              <input type="number" name="casualtiesInjured" value={formData.casualtiesInjured} onChange={handleChange} min="0" className="form-input" />
            </div>
            <div>
              <label className="form-label">Casualties — Fatalities</label>
              <input type="number" name="casualtiesFatalities" value={formData.casualtiesFatalities} onChange={handleChange} min="0" className="form-input" />
            </div>
            <div>
              <label className="form-label">Estimated Damage (₱) *</label>
              <input type="text" name="estimatedDamage" value={formData.estimatedDamage} onChange={handleChange} className="form-input" placeholder="e.g. 5,000" required />
            </div>
            <div>
              <label className="form-label">Probable Cause</label>
              <input type="text" name="probableCause" value={formData.probableCause} onChange={handleChange} className="form-input" placeholder="Initial probable cause" />
            </div>
          </div>
          <div className="mt-4">
            <label className="form-label">Brief Description of Incident</label>
            <textarea name="description" value={formData.description} onChange={handleChange} rows={3} className="form-input" placeholder="Brief narrative of the incident..." />
          </div>
          <div className="mt-4">
            <label className="form-label">Damage Description</label>
            <textarea name="damageDescription" value={formData.damageDescription} onChange={handleChange} rows={3} className="form-input" placeholder="Describe affected property, items, or area..." />
          </div>
          <div className="mt-4">
            <label className="form-label">Action Taken</label>
            <textarea name="actionTaken" value={formData.actionTaken} onChange={handleChange} rows={3} className="form-input" placeholder="Actions taken by responding personnel..." />
          </div>
        </div>

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

        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="btn btn-primary px-8">
            {loading ? 'Submitting…' : 'Submit MDFIR'}
          </button>
          <button type="button" onClick={() => router.back()} className="btn btn-secondary px-6">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
