'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// Renders its children straight into <body>. Every full-screen modal goes through this.
//
// A `position: fixed` element is only fixed to the screen if none of its ancestors has a
// transform, filter or backdrop-filter. Otherwise it is fixed to that ancestor instead and gets
// cut off or squashed. The blurred sticky header, the sliding sidebar, animated modal panels and
// hover-lift cards all have one, so a modal opened from inside them used to render clipped. Being
// a child of <body> avoids that wherever the modal is opened from.
export default function Portal({ children }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}
