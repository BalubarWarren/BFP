'use client';

const RECIPIENT_OPTIONS = [
  { value: 'MUNICIPAL_CHIEF_IIS', label: 'Municipal Chief IIS' },
  { value: 'MUNICIPAL_CHIEF_OPERATION', label: 'Municipal Chief Operation' },
  { value: 'MUNICIPAL_FIRE_MARSHAL', label: 'Municipal Fire Marshal' },
  { value: 'PROVINCIAL_CHIEF_IIS', label: 'Provincial Chief IIS' },
];

// Shared "who should receive this report" dropdown — every investigation report form
// (MDFIR, Spot, Progress, Final) offers the same four recipients.
export default function RecipientSelect({ value, onChange, className = 'form-select max-w-xs' }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={className}>
      {RECIPIENT_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}
