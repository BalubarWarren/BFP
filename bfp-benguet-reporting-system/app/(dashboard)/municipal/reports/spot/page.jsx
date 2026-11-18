'use client';

import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { Search, ClipboardList, Send, HeartPulse, Building2, LocateFixed, Loader2 } from 'lucide-react';
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
import { getBarangays } from '../../../../../lib/barangays';
import SupportingDocsInput from '../../../../../components/reports/SupportingDocsInput';
import LateExplanationField from '../../../../../components/reports/LateExplanationField';
import { getSubmissionDeadline } from '../../../../../lib/report-timeliness';
import { PROPERTY_TYPES } from '../../../../../lib/incident-details';

export default function SpotInvestigationForm() {
  const router = useRouter();
  const { user, getEffectiveUser } = useEffectiveUser();
  // The investigator's municipality's barangays, for the Barangay dropdown. Empty until loaded
  // (or if the municipality isn't on the list), in which case the field falls back to free text.
  const [barangayOptions, setBarangayOptions] = useState([]);

  useEffect(() => {
    if (!user?.municipalityId) return;
    let cancelled = false;
    axios
      .get('/api/municipalities', { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } })
      .then((res) => {
        const own = (res.data.municipalities || []).find((m) => m.id === user.municipalityId);
        if (!cancelled) setBarangayOptions(getBarangays(own?.name));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.municipalityId]);
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
  const [locating, setLocating] = useState(false);

  const [formData, setFormData] = useState({
    reportDate: new Date().toISOString().split('T')[0],
    dateOfIncident: new Date().toISOString().split('T')[0],
    timeOfIncident: '',
    category: '',
    subCategory: '',
    barangay: '',
    address: '',
    casualtiesInjured: '0',
    casualtiesFatalities: '0',
    rescueOperations: '0',
    propertyType: '',
    establishmentName: '',
    ownerName: '',
    occupantName: '',
    numberOfStoreys: '',
    latitude: '',
    longitude: '',
    lateExplanation: '',
    description: '',
  });

  // The Spot report is due within 24 hours of the fire (lib/report-timeliness.js); past that, an
  // explanation for the late submission is required.
  const deadline = getSubmissionDeadline('SPOT_INVESTIGATION', {
    incident: { dateOfIncident: formData.dateOfIncident, timeOfIncident: formData.timeOfIncident || '00:00' },
  });
  const isLate = !!(formData.timeOfIncident && deadline && new Date() > deadline);

  // GPS: the device's current position (the investigator is normally at the scene).
  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('This device or browser cannot share its location. Enter the coordinates by hand.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData((prev) => ({
          ...prev,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));
        setLocating(false);
      },
      (geoError) => {
        setLocating(false);
        setError(
          geoError.code === 1
            ? 'Location permission was denied. Allow location access for this site, or enter the coordinates by hand.'
            : 'Could not get the current location. Try again outdoors, or enter the coordinates by hand.'
        );
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

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
    if (!formData.barangay.trim()) { setError('Please enter the barangay where the fire happened.'); return; }
    if (!formData.timeOfIncident) { setError('Please enter the time of the fire.'); return; }
    if ((formData.latitude && !formData.longitude) || (!formData.latitude && formData.longitude)) {
      setError('Enter both latitude and longitude, or leave both blank.');
      return;
    }
    if (hasInvalidAttachments(supportingDocs.map((doc) => doc.file))) {
      setError('One or more supporting documents are too large or an unsupported type. Remove or replace them before submitting.');
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
          reportType: 'SPOT_INVESTIGATION',
          municipalityId: String(effectiveUser.municipalityId),
          reportDate: formData.reportDate,
          category: formData.category,
          subCategory: formData.subCategory,
          content: JSON.stringify({
            dateOfIncident: formData.dateOfIncident,
            timeOfIncident: formData.timeOfIncident,
            description: formData.description,
            barangay: formData.barangay.trim(),
            address: formData.address.trim(),
            casualtiesInjured: Number(formData.casualtiesInjured) || 0,
            casualtiesFatalities: Number(formData.casualtiesFatalities) || 0,
            rescueOperations: Number(formData.rescueOperations) || 0,
            propertyType: formData.propertyType,
            establishmentName: formData.establishmentName.trim(),
            ownerName: formData.ownerName.trim(),
            occupantName: formData.occupantName.trim(),
            numberOfStoreys: formData.numberOfStoreys ? Number(formData.numberOfStoreys) : null,
            ...(formData.latitude && formData.longitude && {
              latitude: Number(formData.latitude),
              longitude: Number(formData.longitude),
            }),
            ...(isLate && { lateExplanation: formData.lateExplanation.trim() }),
          }),
          passedToRole: recipientRole,
        },
        files: attachments,
        emsFiles,
        supportingDocs,
      });
      setSubmittedReport(response.data.report);
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
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-gray-900 mb-4">
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
              <label className="form-label">Date of Fire <span className="text-bfp-red">*</span></label>
              <div className="form-field-icon-wrap">
                <FieldIcon src="/icons/calendar.svg" />
                <input type="date" name="dateOfIncident" value={formData.dateOfIncident} onChange={handleChange} className="form-input-icon" max={new Date().toISOString().split('T')[0]} required />
              </div>
            </div>
            <div>
              <label className="form-label">Time of Fire <span className="text-bfp-red">*</span></label>
              <input type="time" name="timeOfIncident" value={formData.timeOfIncident} onChange={handleChange} className="form-input" required />
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
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Barangay <span className="text-bfp-red">*</span></label>
              <div className="form-field-icon-wrap">
                <FieldIcon src="/icons/location.svg" />
                {barangayOptions.length ? (
                  <select name="barangay" value={formData.barangay} onChange={handleChange} className="form-select-icon" required>
                    <option value="" className="text-gray-400">— Select barangay —</option>
                    {barangayOptions.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                ) : (
                  <input type="text" name="barangay" value={formData.barangay} onChange={handleChange} className="form-input-icon" placeholder="e.g. Poblacion" maxLength={100} required />
                )}
              </div>
            </div>
            <div>
              <label className="form-label">Exact Location</label>
              <div className="form-field-icon-wrap">
                <FieldIcon src="/icons/location.svg" />
                <input type="text" name="address" value={formData.address} onChange={handleChange} className="form-input-icon" placeholder="Street, sitio or landmark" maxLength={200} />
              </div>
            </div>
          </div>
          <p className="mt-1 text-xs text-gray-500">The place of the fire becomes the report&apos;s title, shared by its Progress and Final reports.</p>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="form-label">Casualties: Injured <span className="text-bfp-red">*</span></label>
              <input type="number" name="casualtiesInjured" value={formData.casualtiesInjured} onChange={handleChange} className="form-input" min="0" max="9999" step="1" inputMode="numeric" placeholder="0" required />
            </div>
            <div>
              <label className="form-label">Casualties: Fatalities <span className="text-bfp-red">*</span></label>
              <input type="number" name="casualtiesFatalities" value={formData.casualtiesFatalities} onChange={handleChange} className="form-input" min="0" max="9999" step="1" inputMode="numeric" placeholder="0" required />
            </div>
            <div>
              <label className="form-label">Rescue Operations</label>
              <input type="number" name="rescueOperations" value={formData.rescueOperations} onChange={handleChange} className="form-input" min="0" max="9999" step="1" inputMode="numeric" placeholder="0" />
            </div>
          </div>

          {/* GPS */}
          <div className="mt-4 rounded-md border border-gray-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-gray-900">GPS Location <span className="font-normal text-gray-500">(optional)</span></p>
              <button type="button" onClick={useCurrentLocation} disabled={locating} className="btn btn-secondary inline-flex items-center gap-1.5 text-sm">
                {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
                {locating ? 'Getting location…' : 'Use my current location'}
              </button>
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="form-label text-xs">Latitude</label>
                <input type="number" name="latitude" value={formData.latitude} onChange={handleChange} className="form-input" step="0.000001" min="-90" max="90" placeholder="e.g. 16.4560" />
              </div>
              <div>
                <label className="form-label text-xs">Longitude</label>
                <input type="number" name="longitude" value={formData.longitude} onChange={handleChange} className="form-input" step="0.000001" min="-180" max="180" placeholder="e.g. 120.5880" />
              </div>
            </div>
            {formData.latitude && formData.longitude && (
              <a
                href={`https://www.google.com/maps?q=${formData.latitude},${formData.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-xs font-medium text-bfp-navy hover:underline dark:text-blue-400"
              >
                Check this point on the map
              </a>
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
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-gray-900 mb-4">
            <Building2 className="w-5 h-5" /> Property Involved
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Property Type</label>
              <select name="propertyType" value={formData.propertyType} onChange={handleChange} className="form-input">
                <option value="">— Select —</option>
                {PROPERTY_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Name of Establishment / Property</label>
              <input type="text" name="establishmentName" value={formData.establishmentName} onChange={handleChange} className="form-input" maxLength={200} placeholder="e.g. Dela Cruz Sari-sari Store" />
            </div>
            <div>
              <label className="form-label">Owner</label>
              <input type="text" name="ownerName" value={formData.ownerName} onChange={handleChange} className="form-input" maxLength={200} placeholder="Full name" />
            </div>
            <div>
              <label className="form-label">Occupant</label>
              <input type="text" name="occupantName" value={formData.occupantName} onChange={handleChange} className="form-input" maxLength={200} placeholder="Full name (if different from the owner)" />
            </div>
            <div>
              <label className="form-label">Number of Storeys</label>
              <input type="number" name="numberOfStoreys" value={formData.numberOfStoreys} onChange={handleChange} className="form-input" min="0" max="200" step="1" inputMode="numeric" placeholder="e.g. 2" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-gray-900 mb-4">
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

        <SupportingDocsInput docs={supportingDocs} onChange={setSupportingDocs} />

        {isLate && (
          <LateExplanationField
            deadline={deadline}
            value={formData.lateExplanation}
            onChange={(value) => setFormData((prev) => ({ ...prev, lateExplanation: value }))}
          />
        )}

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
