'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

// Shared "Back" button for the report forms. Goes back one page when the user got here from
// inside FireTrack; when the page was opened directly (new tab, bookmark, after logging in),
// router.back() would leave the app entirely, so it goes to `fallbackHref` instead.
export default function BackButton({ fallbackHref = '/municipal', className = '' }) {
  const router = useRouter();

  const goBack = () => {
    const cameFromThisSite =
      window.history.length > 1 && document.referrer.startsWith(window.location.origin);
    if (cameFromThisSite) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  };

  return (
    <button
      type="button"
      onClick={goBack}
      className={`btn btn-secondary inline-flex items-center gap-2 text-sm py-1.5 px-3 ${className}`}
    >
      <ArrowLeft className="w-4 h-4" />
      Back
    </button>
  );
}
