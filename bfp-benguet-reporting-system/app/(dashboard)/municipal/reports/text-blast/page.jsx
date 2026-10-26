'use client';

import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
  MessageSquare, Users, ListChecks, Plus, Save, RotateCcw, ChevronUp, ChevronDown, X, Highlighter, Eye,
} from 'lucide-react';
import BackButton from '../../../../../components/common/BackButton';
import PageHeader from '../../../../../components/common/PageHeader';
import FieldIcon from '../../../../../components/reports/FieldIcon';
import TextBlastFields from '../../../../../components/common/TextBlastFields';
import { useToast } from '../../../../../components/common/ToastProvider';
import {
  TEXT_BLAST_TEMPLATE_LABELS,
  TEXT_BLAST_STYLES,
  TEXT_BLAST_NOTE_MAX_LENGTH,
  TEXT_BLAST_MAX_FIELDS,
  TEXT_BLAST_LABEL_MAX_LENGTH,
  TEXT_BLAST_VALUE_MAX_LENGTH,
} from '../../../../../lib/text-blast';

// Matches TEXT_BLAST_RECIPIENT_ROLES in POST /api/reports/text-blast.
const RECIPIENTS = [
  { role: 'MUNICIPAL_FIRE_MARSHAL', label: 'Municipal Fire Marshal', hint: 'Your municipality' },
  { role: 'MUNICIPAL_CHIEF_IIS', label: 'Municipal Chief IIS', hint: 'Your municipality' },
  { role: 'PROVINCIAL_CHIEF_IIS', label: 'Provincial Chief IIS', hint: 'Province' },
];

const STYLE_OPTIONS = [
  { style: TEXT_BLAST_STYLES.NORMAL, title: 'Normal text', render: () => <span className="font-bold">A</span> },
  { style: TEXT_BLAST_STYLES.BLUE, title: 'Blue text', render: () => <span className="font-bold text-blue-700">A</span> },
  { style: TEXT_BLAST_STYLES.HIGHLIGHT, title: 'Highlight', render: () => <Highlighter className="w-4 h-4" /> },
];

// The investigator's own version of the template (labels and styles, never values) — kept per
// browser, since it's a personal working preference rather than shared data.
const SAVED_TEMPLATE_KEY = 'firetrack.textBlastTemplate';

let nextFieldId = 1;
const makeField = (label = '', style = TEXT_BLAST_STYLES.NORMAL) => ({ id: nextFieldId++, label, value: '', style });
const defaultFields = () => TEXT_BLAST_TEMPLATE_LABELS.map((label) => makeField(label));

const loadSavedTemplate = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED_TEMPLATE_KEY));
    if (Array.isArray(saved) && saved.length) {
      return saved.slice(0, TEXT_BLAST_MAX_FIELDS).map((field) => makeField(String(field.label || ''), field.style));
    }
  } catch {
    // Missing, unreadable or blocked storage — use the standard template.
  }
  return null;
};

// A quick text message to the officers the investigator picks — separate from the report forms,
// since it isn't a report itself. Recipients get it as an in-app notification and an email. The
// fill-in template (lib/text-blast.js) can be edited: rename, add, remove and reorder fields,
// and mark lines blue or highlighted so the important ones stand out to recipients.
export default function TextBlastPage() {
  const toast = useToast();
  const [fields, setFields] = useState(defaultFields);
  const [message, setMessage] = useState('');
  const [selectedRoles, setSelectedRoles] = useState(RECIPIENTS.map((r) => r.role));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const newFieldRef = useRef(null);
  const focusFieldId = useRef(null);

  useEffect(() => {
    const saved = loadSavedTemplate();
    if (saved) setFields(saved);
  }, []);

  // Puts the cursor in a just-added field's label box.
  useEffect(() => {
    if (focusFieldId.current && newFieldRef.current) {
      newFieldRef.current.focus();
      focusFieldId.current = null;
    }
  }, [fields]);

  const toggleRole = (role) => {
    setSelectedRoles((current) =>
      current.includes(role) ? current.filter((r) => r !== role) : [...current, role]
    );
  };

  const updateField = (id, changes) => {
    setFields((current) => current.map((field) => (field.id === id ? { ...field, ...changes } : field)));
  };

  const removeField = (id) => setFields((current) => current.filter((field) => field.id !== id));

  const moveField = (index, offset) => {
    setFields((current) => {
      const target = index + offset;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const addField = () => {
    if (fields.length >= TEXT_BLAST_MAX_FIELDS) return;
    const field = makeField();
    focusFieldId.current = field.id;
    setFields((current) => [...current, field]);
  };

  const saveTemplate = () => {
    const template = fields
      .filter((field) => field.label.trim())
      .map((field) => ({ label: field.label.trim(), style: field.style }));
    try {
      localStorage.setItem(SAVED_TEMPLATE_KEY, JSON.stringify(template));
      toast.success('Template saved. It will load the next time you open Text Blast on this device.');
    } catch {
      toast.error('Could not save the template in this browser.');
    }
  };

  const resetTemplate = () => {
    if (!window.confirm('Restore the standard template? Your added/removed fields and typed values will be cleared.')) return;
    try {
      localStorage.removeItem(SAVED_TEMPLATE_KEY);
    } catch {
      // Nothing saved to clear.
    }
    setFields(defaultFields());
  };

  const filledFields = fields.filter((field) => field.label.trim() && field.value.trim());

  const handleSend = async (e) => {
    e.preventDefault();
    setError('');
    if (!filledFields.length && !message.trim()) {
      setError('Fill in at least one field or type a message before sending.');
      return;
    }
    if (!selectedRoles.length) {
      setError('Choose at least one recipient.');
      return;
    }

    setSending(true);
    try {
      const response = await axios.post(
        '/api/reports/text-blast',
        {
          message,
          fields: filledFields.map(({ label, value, style }) => ({ label, value, style })),
          recipientRoles: selectedRoles,
        },
        { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } }
      );
      // Keep the template (labels, order, styles) for the next blast — only the typed values go.
      setFields((current) => current.map((field) => ({ ...field, value: '' })));
      setMessage('');
      toast.success(response.data.message || 'Text blast sent.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send text blast.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <BackButton className="mb-3" />
        <PageHeader icon={MessageSquare} eyebrow="Quick Report" title="Text Blast" description="Send a quick text report to the officers you choose. They are notified in the system and by email." border={false} />
      </div>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

      <form onSubmit={handleSend} className="space-y-6">
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-bfp-navy mb-4">
            <Users className="w-5 h-5" /> Send To
          </h2>
          <div className="space-y-2">
            {RECIPIENTS.map(({ role, label, hint }) => (
              <label
                key={role}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                  selectedRoles.includes(role) ? 'border-bfp-navy bg-bfp-navy/5' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedRoles.includes(role)}
                  onChange={() => toggleRole(role)}
                  className="h-4 w-4"
                />
                <span className="font-medium text-gray-900">{label}</span>
                <span className="ml-auto text-xs text-gray-500">{hint}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <h2 className="flex items-center gap-2 text-lg font-bold text-bfp-navy">
              <ListChecks className="w-5 h-5" /> Incident Details
            </h2>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={saveTemplate} className="btn btn-secondary text-sm inline-flex items-center gap-1.5">
                <Save className="w-4 h-4" /> Save as My Template
              </button>
              <button type="button" onClick={resetTemplate} className="btn btn-secondary text-sm inline-flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4" /> Reset
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Fill in what applies — empty fields are left out. Click a field name to rename it, use{' '}
            <span className="font-bold text-blue-700">A</span> for blue text or{' '}
            <Highlighter className="inline w-3.5 h-3.5 -mt-0.5" /> to highlight important lines.
          </p>

          <div className="space-y-2">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className={`rounded-lg border p-2 sm:flex sm:items-center sm:gap-2 ${
                  field.style === TEXT_BLAST_STYLES.HIGHLIGHT ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200'
                }`}
              >
                <input
                  ref={focusFieldId.current === field.id ? newFieldRef : undefined}
                  value={field.label}
                  onChange={(e) => updateField(field.id, { label: e.target.value })}
                  maxLength={TEXT_BLAST_LABEL_MAX_LENGTH}
                  placeholder="Field name"
                  aria-label="Field name"
                  className={`w-full sm:w-72 sm:flex-shrink-0 rounded border border-transparent bg-transparent px-2 py-1.5 text-sm font-semibold hover:border-gray-200 focus:border-bfp-navy focus:bg-white focus:outline-none ${
                    field.style === TEXT_BLAST_STYLES.BLUE ? 'text-blue-700' : 'text-gray-800'
                  }`}
                />
                <div className="mt-1 flex items-center gap-2 sm:mt-0 sm:flex-1">
                  <input
                    value={field.value}
                    onChange={(e) => updateField(field.id, { value: e.target.value })}
                    maxLength={TEXT_BLAST_VALUE_MAX_LENGTH}
                    placeholder="—"
                    aria-label={`${field.label || 'Field'} value`}
                    className={`form-input flex-1 min-w-0 py-1.5 text-sm ${field.style === TEXT_BLAST_STYLES.BLUE ? 'text-blue-700' : ''}`}
                  />
                  <div className="flex flex-shrink-0 rounded-lg border border-gray-200 bg-white" role="group" aria-label="Text style">
                    {STYLE_OPTIONS.map((option) => (
                      <button
                        key={option.style}
                        type="button"
                        title={option.title}
                        aria-label={option.title}
                        aria-pressed={field.style === option.style}
                        onClick={() => updateField(field.id, { style: option.style })}
                        className={`flex h-8 w-8 items-center justify-center text-sm first:rounded-l-lg last:rounded-r-lg ${
                          field.style === option.style
                            ? option.style === TEXT_BLAST_STYLES.HIGHLIGHT ? 'bg-yellow-200' : 'bg-bfp-navy/10'
                            : 'hover:bg-gray-100'
                        }`}
                      >
                        {option.render()}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-shrink-0 flex-col">
                    <button type="button" onClick={() => moveField(index, -1)} disabled={index === 0} title="Move up" aria-label="Move up" className="text-gray-400 hover:text-bfp-navy disabled:opacity-30">
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => moveField(index, 1)} disabled={index === fields.length - 1} title="Move down" aria-label="Move down" className="text-gray-400 hover:text-bfp-navy disabled:opacity-30">
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                  <button type="button" onClick={() => removeField(field.id)} title="Remove field" aria-label={`Remove ${field.label || 'field'}`} className="flex-shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addField}
            disabled={fields.length >= TEXT_BLAST_MAX_FIELDS}
            className="mt-3 w-full rounded-lg border-2 border-dashed border-gray-300 py-2 text-sm font-medium text-bfp-navy hover:border-bfp-navy hover:bg-bfp-navy/5 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add Field
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-bfp-navy mb-4">
            <MessageSquare className="w-5 h-5" /> Additional Notes <span className="text-sm font-normal text-gray-400">(optional)</span>
          </h2>
          <div className="form-field-icon-wrap">
            <FieldIcon src="/icons/text-blast.svg" />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={TEXT_BLAST_NOTE_MAX_LENGTH}
              className="form-textarea-icon"
              placeholder="Anything else the officers should know..."
            />
          </div>
          <p className="mt-1 text-right text-xs text-gray-400">{message.length}/{TEXT_BLAST_NOTE_MAX_LENGTH}</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-bfp-navy mb-1">
            <Eye className="w-5 h-5" /> Preview
          </h2>
          <p className="text-xs text-gray-500 mb-3">This is how the officers will see it in FireTrack and in their email.</p>
          {filledFields.length || message.trim() ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <TextBlastFields fields={filledFields} />
              {message.trim() && <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">{message.trim()}</p>}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Fill in a field to see the preview.</p>
          )}
        </div>

        <button type="submit" disabled={sending} className="btn btn-success px-8">
          {sending ? 'Sending…' : 'Send Text Blast'}
        </button>
      </form>
    </div>
  );
}
