'use client';

import { useState } from 'react';
import { displayName } from '../../lib/user-display';

// Gmail-style letter avatars: each name always gets the same colour from this set.
const COLORS = ['#c2185b', '#7b1fa2', '#512da8', '#1976d2', '#0288d1', '#00796b', '#388e3c', '#e64a19', '#5d4037', '#455a64'];

const colorFor = (text) => {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return COLORS[hash % COLORS.length];
};

// The user's Google profile photo when they've signed in with Google (avatarUrl), otherwise the
// first letter of their name on a coloured circle — like Gmail. Falls back to the letter if the
// photo can't load (e.g. it was removed from the Google account).
export default function UserAvatar({ user, size = 40, className = '' }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const name = displayName(user);
  const dimensions = { width: size, height: size };

  if (user?.avatarUrl && !photoFailed) {
    return (
      <img
        src={user.avatarUrl}
        alt=""
        style={dimensions}
        className={`flex-shrink-0 rounded-full object-cover ${className}`}
        // Google's image host refuses some requests that carry a Referer.
        referrerPolicy="no-referrer"
        onError={() => setPhotoFailed(true)}
      />
    );
  }

  return (
    <div
      style={{ ...dimensions, backgroundColor: colorFor(name || '?'), fontSize: Math.round(size * 0.42) }}
      className={`flex flex-shrink-0 items-center justify-center rounded-full font-semibold text-white ${className}`}
      aria-hidden="true"
    >
      {(name.trim().charAt(0) || '?').toUpperCase()}
    </div>
  );
}
