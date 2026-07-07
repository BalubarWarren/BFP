'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Home, Building2, Trees, Car } from 'lucide-react';
import { useToast } from '@/components/common/ToastProvider';

export default function DailyReportForm() {
  const router = useRouter();
  const toast = useToast();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);

  const [formData, setFormData] = useState({
    reportDate: new Date().toISOString().split('T')[0],
    residentialCount: 0,
    nonResidentialCount: 0,
    nonStructuralCount: 0,
    transportCount: 0,
    reportingOfficer: '',
    respondingUnits: '',
  });

  const totalIncidents =
    formData.residentialCount +
    formData.nonResidentialCount +
    formData.nonStructuralCount +
    formData.transportCount;

  useEffect(() => {
    const userData = sessionStorage.getItem('user');
    if (userData) {
      try {
        setUser(JSON.parse(userData));
      } catch {
        setUser(null);
      }
    }
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: ['residentialCount', 'nonResidentialCount', 'nonStructuralCount', 'transportCount'].includes(name)
        ? parseInt(value) || 0
        : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (step === 1) {
      setStep(2);
      return;
    }

    // Validate
    if (!formData.reportingOfficer) {
      setError('Please enter the reporting officer name');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = sessionStorage.getItem('token');
      let effectiveUser = user;

      if (!effectiveUser) {
        const meResponse = await axios.get('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });

        effectiveUser = meResponse.data.user;
        sessionStorage.setItem('user', JSON.stringify(effectiveUser));
        setUser(effectiveUser);
      }

      if (!effectiveUser?.municipalityId) {
        throw new Error('Not authenticated. Please sign in again.');
      }

      // Create incident for daily report context
      const incidentResponse = await axios.post(
        '/api/incidents',
        {
          municipalityId: effectiveUser.municipalityId,
          dateOfIncident: formData.reportDate,
          generalCategory: 'NON_STRUCTURAL', // Daily reports are administrative
          status: 'EXTINGUISHED',
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Create report
      const reportResponse = await axios.post(
        '/api/reports',
        {
          reportType: 'DAILY',
          municipalityId: effectiveUser.municipalityId,
          incidentId: incidentResponse.data.incident.id,
          reportDate: new Date(formData.reportDate),
          respondingOfficer: formData.reportingOfficer,
          respondingUnits: formData.respondingUnits,
          content: {
            residentialCount: formData.residentialCount,
            nonResidentialCount: formData.nonResidentialCount,
            nonStructuralCount: formData.nonStructuralCount,
            transportCount: formData.transportCount,
          },
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Create daily report entry for monitoring board
      await axios.post(
        '/api/daily-report-entries',
        {
          reportId: reportResponse.data.report.id,
          municipalityId: effectiveUser.municipalityId,
          reportDate: new Date(formData.reportDate),
          residentialCount: formData.residentialCount,
          nonResidentialCount: formData.nonResidentialCount,
          nonStructuralCount: formData.nonStructuralCount,
          transportCount: formData.transportCount,
          reportingOfficer: formData.reportingOfficer,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Daily report submitted successfully!');
      router.push('/municipal/reports');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to submit report');
      console.error('Error submitting report:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-bfp-navy mb-2">Daily Fire Incident Report</h1>
        <p className="text-gray-600 mb-8">
          Submit your municipality's daily incident statistics
        </p>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* Progress Steps */}
        <div className="flex gap-4 mb-8">
          <div className={`flex-1 text-center pb-4 border-b-4 ${step >= 1 ? 'border-bfp-red text-bfp-navy font-bold' : 'border-gray-300 text-gray-600'}`}>
            Step 1: Incident Counts
          </div>
          <div className={`flex-1 text-center pb-4 border-b-4 ${step >= 2 ? 'border-bfp-red text-bfp-navy font-bold' : 'border-gray-300 text-gray-600'}`}>
            Step 2: Officer Details
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-8">
          {step === 1 && (
            <>
              {/* Report Date */}
              <div className="form-group">
                <label className="form-label">Report Date</label>
                <input
                  type="date"
                  className="form-input"
                  name="reportDate"
                  value={formData.reportDate}
                  onChange={handleInputChange}
                  required
                />
              </div>

              {/* Incident Counts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 p-6 bg-gray-50 rounded-lg">
                <div>
                  <div className="text-center p-4 bg-white rounded-lg border-2 border-blue-200">
                    <Home className="w-7 h-7 mb-2 mx-auto text-blue-600" />
                    <label className="form-label">Residential</label>
                    <input
                      type="number"
                      className="form-input text-center text-2xl font-bold"
                      name="residentialCount"
                      value={formData.residentialCount}
                      onChange={handleInputChange}
                      min="0"
                    />
                  </div>
                </div>
                <div>
                  <div className="text-center p-4 bg-white rounded-lg border-2 border-green-200">
                    <Building2 className="w-7 h-7 mb-2 mx-auto text-green-600" />
                    <label className="form-label">Non-Residential</label>
                    <input
                      type="number"
                      className="form-input text-center text-2xl font-bold"
                      name="nonResidentialCount"
                      value={formData.nonResidentialCount}
                      onChange={handleInputChange}
                      min="0"
                    />
                  </div>
                </div>
                <div>
                  <div className="text-center p-4 bg-white rounded-lg border-2 border-yellow-200">
                    <Trees className="w-7 h-7 mb-2 mx-auto text-yellow-600" />
                    <label className="form-label">Non-Structural</label>
                    <input
                      type="number"
                      className="form-input text-center text-2xl font-bold"
                      name="nonStructuralCount"
                      value={formData.nonStructuralCount}
                      onChange={handleInputChange}
                      min="0"
                    />
                  </div>
                </div>
                <div>
                  <div className="text-center p-4 bg-white rounded-lg border-2 border-purple-200">
                    <Car className="w-7 h-7 mb-2 mx-auto text-purple-600" />
                    <label className="form-label">Transport</label>
                    <input
                      type="number"
                      className="form-input text-center text-2xl font-bold"
                      name="transportCount"
                      value={formData.transportCount}
                      onChange={handleInputChange}
                      min="0"
                    />
                  </div>
                </div>
              </div>

              {/* Total Summary */}
              <div className="bg-bfp-red text-white p-6 rounded-lg text-center mb-8">
                <p className="text-lg mb-2">Total Incidents for {new Date(formData.reportDate).toLocaleDateString()}</p>
                <p className="text-5xl font-bold">{totalIncidents}</p>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              {/* Summary */}
              <div className="bg-bfp-navy/5 p-6 rounded-lg mb-8">
                <h3 className="font-bold text-lg mb-4">Report Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Residential</p>
                    <p className="text-2xl font-bold">{formData.residentialCount}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Non-Residential</p>
                    <p className="text-2xl font-bold">{formData.nonResidentialCount}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Non-Structural</p>
                    <p className="text-2xl font-bold">{formData.nonStructuralCount}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Transport</p>
                    <p className="text-2xl font-bold">{formData.transportCount}</p>
                  </div>
                </div>
              </div>

              {/* Officer Info */}
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
                <label className="form-label">Responding Units (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  name="respondingUnits"
                  placeholder="e.g., Engine 1, Tanker 2, Rescue 1"
                  value={formData.respondingUnits}
                  onChange={handleInputChange}
                />
              </div>
            </>
          )}

          {/* Buttons */}
          <div className="flex gap-4 mt-8">
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
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
              {loading ? 'Submitting...' : step === 1 ? 'Next →' : '✓ Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
