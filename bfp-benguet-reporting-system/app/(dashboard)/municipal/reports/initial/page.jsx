'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { GENERAL_CATEGORIES, SUB_CATEGORIES } from '@/lib/constants';

export default function InitialReportForm() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const [municipalities, setMunicipalities] = useState([]);

  const [formData, setFormData] = useState({
    dateOfIncident: new Date().toISOString().split('T')[0],
    timeOfIncident: '00:00',
    barangay: '',
    address: '',
    generalCategory: '',
    subCategory: '',
    description: '',
    estimatedAffectedArea: '',
    status: 'ONGOING',
    casualtiesInjured: 0,
    casualtiesFatalities: 0,
    respondingUnits: '',
    reportingOfficer: '',
    reportingOfficerRank: '',
  });

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: ['casualtiesInjured', 'casualtiesFatalities'].includes(name)
        ? parseInt(value) || 0
        : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (step === 1) {
      if (!formData.generalCategory || !formData.subCategory) {
        setError('Please select incident category and sub-category');
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      if (!formData.reportingOfficer) {
        setError('Please enter reporting officer name');
        return;
      }
      setStep(3);
      return;
    }

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

      // Create incident
      const incidentResponse = await axios.post(
        '/api/incidents',
        {
          municipalityId: effectiveUser.municipalityId,
          dateOfIncident: new Date(formData.dateOfIncident),
          timeOfIncident: formData.timeOfIncident,
          barangay: formData.barangay,
          address: formData.address,
          generalCategory: formData.generalCategory,
          subCategory: formData.subCategory,
          description: formData.description,
          estimatedAffectedArea: formData.estimatedAffectedArea,
          status: formData.status,
          casualtiesInjured: formData.casualtiesInjured,
          casualtiesFatalities: formData.casualtiesFatalities,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const incidentId = incidentResponse.data.incident.id;
      const referenceNumber = incidentResponse.data.incident.referenceNumber;

      // Create initial report
      await axios.post(
        '/api/reports',
        {
          reportType: 'INITIAL',
          municipalityId: effectiveUser.municipalityId,
          incidentId,
          reportDate: new Date(formData.dateOfIncident),
          respondingUnits: formData.respondingUnits,
          respondingOfficer: formData.reportingOfficer,
          reportingOfficerRank: formData.reportingOfficerRank,
          content: {
            description: formData.description,
            estimatedAffectedArea: formData.estimatedAffectedArea,
          },
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert(`Initial report submitted successfully!\nIncident Reference: ${referenceNumber}`);
      router.push('/municipal/reports');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit report');
      console.error('Error submitting report:', err);
    } finally {
      setLoading(false);
    }
  };

  const availableSubCategories = formData.generalCategory
    ? SUB_CATEGORIES[formData.generalCategory] || []
    : [];

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-bfp-navy mb-2">🚨 Initial Fire Incident Report</h1>
        <p className="text-gray-600 mb-8">
          Submit this form as soon as possible after an incident occurs
        </p>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* Progress Steps */}
        <div className="flex gap-4 mb-8">
          <div className={`flex-1 text-center pb-4 border-b-4 ${step >= 1 ? 'border-bfp-red text-bfp-navy font-bold' : 'border-gray-300 text-gray-600'}`}>
            Step 1: Incident Type
          </div>
          <div className={`flex-1 text-center pb-4 border-b-4 ${step >= 2 ? 'border-bfp-red text-bfp-navy font-bold' : 'border-gray-300 text-gray-600'}`}>
            Step 2: Details
          </div>
          <div className={`flex-1 text-center pb-4 border-b-4 ${step >= 3 ? 'border-bfp-red text-bfp-navy font-bold' : 'border-gray-300 text-gray-600'}`}>
            Step 3: Officer Info
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-8">
          {step === 1 && (
            <>
              {/* Date & Time */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="form-group">
                  <label className="form-label">Date of Incident *</label>
                  <input
                    type="date"
                    className="form-input"
                    name="dateOfIncident"
                    value={formData.dateOfIncident}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Time of Incident *</label>
                  <input
                    type="time"
                    className="form-input"
                    name="timeOfIncident"
                    value={formData.timeOfIncident}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              {/* Location */}
              <div className="form-group">
                <label className="form-label">Barangay *</label>
                <input
                  type="text"
                  className="form-input"
                  name="barangay"
                  placeholder="Enter barangay name"
                  value={formData.barangay}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Address/Location *</label>
                <textarea
                  className="form-textarea"
                  name="address"
                  placeholder="Enter full address of the incident"
                  value={formData.address}
                  onChange={handleInputChange}
                  required
                />
              </div>

              {/* Fire Category */}
              <div className="form-group">
                <label className="form-label">Fire Type - General Category *</label>
                <select
                  className="form-select"
                  name="generalCategory"
                  value={formData.generalCategory}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">-- Select Category --</option>
                  <option value="RESIDENTIAL">🏘️ Residential</option>
                  <option value="NON_RESIDENTIAL">🏢 Non-Residential</option>
                  <option value="NON_STRUCTURAL">🌳 Non-Structural</option>
                  <option value="TRANSPORT">🚗 Transport</option>
                </select>
              </div>

              {formData.generalCategory && (
                <div className="form-group">
                  <label className="form-label">Fire Type - Sub-Category *</label>
                  <select
                    className="form-select"
                    name="subCategory"
                    value={formData.subCategory}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">-- Select Sub-Category --</option>
                    {availableSubCategories.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <div className="form-group">
                <label className="form-label">Brief Description of Incident *</label>
                <textarea
                  className="form-textarea"
                  name="description"
                  placeholder="Describe what happened, visible damage, etc."
                  value={formData.description}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Estimated Affected Area</label>
                <input
                  type="text"
                  className="form-input"
                  name="estimatedAffectedArea"
                  placeholder="e.g., 500 sq meters, 2 buildings"
                  value={formData.estimatedAffectedArea}
                  onChange={handleInputChange}
                />
              </div>

              {/* Current Status */}
              <div className="form-group">
                <label className="form-label">Current Status *</label>
                <select
                  className="form-select"
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  required
                >
                  <option value="ONGOING">🔥 Ongoing</option>
                  <option value="CONTROLLED">⚠️  Controlled</option>
                  <option value="EXTINGUISHED">✓ Extinguished</option>
                </select>
              </div>

              {/* Casualties */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="form-group">
                  <label className="form-label">Number of Injured</label>
                  <input
                    type="number"
                    className="form-input"
                    name="casualtiesInjured"
                    value={formData.casualtiesInjured}
                    onChange={handleInputChange}
                    min="0"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Number of Fatalities</label>
                  <input
                    type="number"
                    className="form-input"
                    name="casualtiesFatalities"
                    value={formData.casualtiesFatalities}
                    onChange={handleInputChange}
                    min="0"
                  />
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="form-group">
                <label className="form-label">Reporting Officer Name *</label>
                <input
                  type="text"
                  className="form-input"
                  name="reportingOfficer"
                  placeholder="e.g., FC Juan Dela Cruz"
                  value={formData.reportingOfficer}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Officer Rank *</label>
                <input
                  type="text"
                  className="form-input"
                  name="reportingOfficerRank"
                  placeholder="e.g., Fire Officer 1"
                  value={formData.reportingOfficerRank}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Responding Units Deployed</label>
                <textarea
                  className="form-textarea"
                  name="respondingUnits"
                  placeholder="e.g., Engine 1, Tanker 2, Rescue 1, Truck 3"
                  value={formData.respondingUnits}
                  onChange={handleInputChange}
                />
              </div>

              {/* Summary */}
              <div className="bg-blue-50 p-6 rounded-lg">
                <h3 className="font-bold mb-4">Report Summary</h3>
                <div className="space-y-2 text-sm">
                  <p><strong>Date/Time:</strong> {new Date(formData.dateOfIncident).toLocaleDateString()} at {formData.timeOfIncident}</p>
                  <p><strong>Location:</strong> {formData.barangay}, {formData.address}</p>
                  <p><strong>Category:</strong> {formData.generalCategory} - {formData.subCategory}</p>
                  <p><strong>Status:</strong> {formData.status}</p>
                  <p><strong>Casualties:</strong> {formData.casualtiesInjured} injured, {formData.casualtiesFatalities} fatalities</p>
                </div>
              </div>
            </>
          )}

          {/* Buttons */}
          <div className="flex gap-4 mt-8">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="btn btn-secondary"
              >
                ← Back
              </button>
            )}
            {step === 1 && (
              <button
                type="button"
                onClick={() => router.push('/municipal')}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary flex-1"
            >
              {loading ? 'Submitting...' : step < 3 ? 'Next →' : '✓ Submit Initial Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
