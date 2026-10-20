'use client';

import { BFP_RANK_GROUPS, BFP_RANKS } from '../../lib/constants';

// Rank picker used wherever a BFP rank is entered. A value saved before the dropdown existed
// (free text, e.g. "FO3") is kept as its own option so editing a record never silently drops it.
export default function RankSelect({ value, onChange, name = 'rank', className = 'form-input', placeholder = 'Select rank', ...rest }) {
  const isLegacy = value && !BFP_RANKS.includes(value);

  return (
    <select name={name} value={value || ''} onChange={onChange} className={className} {...rest}>
      <option value="">{placeholder}</option>
      {isLegacy && <option value={value}>{value} (current)</option>}
      {BFP_RANK_GROUPS.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.ranks.map((rank) => (
            <option key={rank.value} value={rank.value}>
              {rank.abbr ? `${rank.value} (${rank.abbr})` : rank.value}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
