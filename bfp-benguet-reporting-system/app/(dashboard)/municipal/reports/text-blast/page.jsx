'use client';

import { useState } from 'react';
import axios from 'axios';
import { MessageSquare, Users } from 'lucide-react';
import BackButton from '../../../../../components/common/BackButton';
import FieldIcon from '../../../../../components/reports/FieldIcon';
import { useToast } from '../../../../../components/common/ToastProvider';

const MAX_LENGTH = 1000;

// Matches TEXT_BLAST_RECIPIENT_ROLES in POST /api/reports/text-blast.
const RECIPIENTS = [
  { role: 'MUNICIPAL_FIRE_MARSHAL', label: 'Municipal Fire Marshal', hint: 'Your municipality' },
  { role: 'MUNICIPAL_CHIEF_IIS', label: 'Municipal Chief IIS', hint: 'Your municipality' },
  { role: 'PROVINCIAL_CHIEF_IIS', label: 'Provincial Chief IIS', hint: 'Province' },
];

// A quick text message to the officers the investigator picks — separate from the report forms,
// since it isn't a report itself. Recipients get it as an in-app notification and an email.
export default function TextBlastPage() {
  const toast = useToast();
  const [message, setMessage] = useState('');
  const [selectedRoles, setSelectedRoles] = useState(RECIPIENTS.map((r) => r.role));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const toggleRole = (role) => {
    setSelectedRoles((current) =>
      current.includes(role) ? current.filter((r) => r !== role) : [...current, role]
    );
  };

  const handleSend = async (e) => {
    e.preventDefault();
    setError('');
    if (!message.trim()) {
      setError('Type a message before sending.');
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
        { message, recipientRoles: selectedRoles },
        { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } }
      );
      setMessage('');
      toast.success(response.data.message || 'Text blast sent.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send text blast.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <BackButton className="mb-3" />
        <h1 className="flex items-center gap-2 text-2xl font-bold text-bfp-navy">
          <MessageSquare className="w-6 h-6" /> Text Blast
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Send a quick text report to the officers you choose. They are notified in the system and by email.
        </p>
      </div>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

      <form onSubmit={handleSend} className="space-y-6">
        <div className="bg-white rounded-lg shadow-md p-6">
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

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-bfp-navy mb-4">
            <MessageSquare className="w-5 h-5" /> Message
          </h2>
          <div className="form-field-icon-wrap">
            <FieldIcon src="/icons/text-blast.svg" />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              maxLength={MAX_LENGTH}
              className="form-textarea-icon"
              placeholder="Type the text blast message..."
            />
          </div>
          <p className="mt-1 text-right text-xs text-gray-400">{message.length}/{MAX_LENGTH}</p>
        </div>

        <button type="submit" disabled={sending} className="btn btn-success px-8">
          {sending ? 'Sending…' : 'Send Text Blast'}
        </button>
      </form>
    </div>
  );
}
