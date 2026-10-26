'use client';

import { useRef, useState } from 'react';
import axios from 'axios';
import { MessageSquare, Users, Save, RotateCcw } from 'lucide-react';
import BackButton from '../../../../../components/common/BackButton';
import PageHeader from '../../../../../components/common/PageHeader';
import TextBlastEditor from '../../../../../components/reports/TextBlastEditor';
import { useToast } from '../../../../../components/common/ToastProvider';
import {
  TEXT_BLAST_TEMPLATE_LINES,
  TEXT_BLAST_MAX_CHARACTERS,
  lineText,
  isUnfilledTemplateLine,
  sentCharacterCount,
} from '../../../../../lib/text-blast';

// Matches TEXT_BLAST_RECIPIENT_ROLES in POST /api/reports/text-blast.
const RECIPIENTS = [
  { role: 'MUNICIPAL_FIRE_MARSHAL', label: 'Municipal Fire Marshal', hint: 'Your municipality' },
  { role: 'MUNICIPAL_CHIEF_IIS', label: 'Municipal Chief IIS', hint: 'Your municipality' },
  { role: 'PROVINCIAL_CHIEF_IIS', label: 'Provincial Chief IIS', hint: 'Province' },
];

// The investigator's own version of the template — kept per browser, since it's a personal
// working preference rather than shared data.
const SAVED_TEMPLATE_KEY = 'firetrack.textBlastTemplate';

const loadTemplate = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED_TEMPLATE_KEY));
    if (Array.isArray(saved) && saved.every(Array.isArray)) return saved;
  } catch {
    // Missing, unreadable or blocked storage — use the standard template.
  }
  return TEXT_BLAST_TEMPLATE_LINES;
};

// What "Save as My Template" keeps: each "Label: answer" line cut back to "Label: " (keeping the
// label's formatting), so the saved template is the investigator's layout without this incident's
// details. Lines without a colon (headings, notes) are kept as they are.
const toTemplate = (lines) =>
  lines.map((line) => {
    const colonAt = lineText(line).indexOf(':');
    if (colonAt === -1) return line;
    const kept = [];
    let remaining = colonAt + 1;
    for (const run of line) {
      if (remaining <= 0) break;
      kept.push({ ...run, t: run.t.slice(0, remaining) });
      remaining -= run.t.length;
    }
    kept.push({ t: ' ' });
    return kept;
  });

// A quick text message to the officers the investigator picks — separate from the report forms,
// since it isn't a report itself. Recipients get it as an in-app notification and an email, with
// the bold/blue formatting kept (see lib/text-blast.js).
export default function TextBlastPage() {
  const toast = useToast();
  const editorRef = useRef(null);
  const [lines, setLines] = useState([]);
  const [selectedRoles, setSelectedRoles] = useState(RECIPIENTS.map((r) => r.role));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  // Read lazily so the server render (no localStorage) and the first client render agree.
  const [initialLines] = useState(() => (typeof window === 'undefined' ? TEXT_BLAST_TEMPLATE_LINES : loadTemplate()));

  // Only what will be sent counts — unfilled template lines don't (see lib/text-blast.js).
  const characters = sentCharacterCount(lines);
  const hasContent = lines.some((line) => lineText(line).trim() && !isUnfilledTemplateLine(line));

  const toggleRole = (role) => {
    setSelectedRoles((current) =>
      current.includes(role) ? current.filter((r) => r !== role) : [...current, role]
    );
  };

  const saveTemplate = () => {
    try {
      localStorage.setItem(SAVED_TEMPLATE_KEY, JSON.stringify(toTemplate(editorRef.current.getLines())));
      toast.success('Template saved. It will load the next time you open Text Blast on this device.');
    } catch {
      toast.error('Could not save the template in this browser.');
    }
  };

  const resetTemplate = () => {
    if (!window.confirm('Restore the standard template? What you typed here will be cleared.')) return;
    try {
      localStorage.removeItem(SAVED_TEMPLATE_KEY);
    } catch {
      // Nothing saved to clear.
    }
    editorRef.current.setLines(TEXT_BLAST_TEMPLATE_LINES);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    setError('');
    const content = editorRef.current.getLines();
    if (!content.some((line) => lineText(line).trim() && !isUnfilledTemplateLine(line))) {
      setError('Fill in the template or type a message before sending.');
      return;
    }
    if (characters > TEXT_BLAST_MAX_CHARACTERS) {
      setError(`The message is too long — keep it to ${TEXT_BLAST_MAX_CHARACTERS} characters.`);
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
        { lines: content, recipientRoles: selectedRoles },
        { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } }
      );
      // Ready for the next one: back to the investigator's template, answers cleared.
      editorRef.current.setLines(loadTemplate());
      toast.success(response.data.message || 'Text blast sent.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send text blast.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
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
              <MessageSquare className="w-5 h-5" /> Message
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
          <p className="text-xs text-gray-500 mb-3">
            Type after each colon, and delete or add lines as needed. Lines left blank after the colon aren&rsquo;t
            sent. Select text to make it <strong>bold</strong> or{' '}
            <span className="font-semibold text-blue-700">blue</span>.
          </p>

          <TextBlastEditor ref={editorRef} initialLines={initialLines} onChange={setLines} />

          <p className={`mt-1 text-right text-xs ${characters > TEXT_BLAST_MAX_CHARACTERS ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
            {characters}/{TEXT_BLAST_MAX_CHARACTERS}
          </p>
        </div>

        <button type="submit" disabled={sending || !hasContent} className="btn btn-success px-8">
          {sending ? 'Sending…' : 'Send Text Blast'}
        </button>
      </form>
    </div>
  );
}
