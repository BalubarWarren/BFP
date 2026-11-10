'use client';

import { useEffect, useState } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';

// "Install app" button. Installing just opens this same deployment in its own app window with a
// home-screen / Start-menu / dock icon — the app is still served from Vercel, so there's nothing
// separate to update. Hidden entirely when it would do nothing (already installed, or a browser
// that can't install web apps).
//
// - Chrome / Edge / Android: the browser's own install dialog (event captured in app/layout.jsx).
// - iPhone / iPad Safari: no install API exists, so the button shows the "Share → Add to Home
//   Screen" steps instead.

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function isIos() {
  const ua = window.navigator.userAgent;
  // iPadOS reports itself as a Mac; touch support tells them apart.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export default function InstallAppButton({ variant = 'header' }) {
  const [mode, setMode] = useState(null); // null (hidden) | 'prompt' | 'ios'
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEscapeKey(() => setShowIosHelp(false), showIosHelp);

  useEffect(() => {
    if (isStandalone()) return undefined;

    const sync = () => {
      if (window.__fireTrackInstallPrompt) setMode('prompt');
      else if (isIos()) setMode('ios');
      else setMode(null);
    };
    sync();

    window.addEventListener('firetrack:installable', sync);
    window.addEventListener('firetrack:installed', sync);
    return () => {
      window.removeEventListener('firetrack:installable', sync);
      window.removeEventListener('firetrack:installed', sync);
    };
  }, []);

  if (!mode) return null;

  const handleClick = async () => {
    if (mode === 'ios') {
      setShowIosHelp(true);
      return;
    }
    const promptEvent = window.__fireTrackInstallPrompt;
    if (!promptEvent) return;
    promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    // The event can only be used once; if they dismissed it, Chrome fires a fresh one later.
    window.__fireTrackInstallPrompt = null;
    if (outcome === 'accepted') setMode(null);
    else setMode(isIos() ? 'ios' : null);
  };

  const button =
    variant === 'landing' ? (
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-2 whitespace-nowrap rounded border border-bfp-gold px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-bfp-gold hover:text-bfp-navy sm:px-4"
      >
        <Download className="h-4 w-4" />
        <span>
          Install<span className="hidden sm:inline"> App</span>
        </span>
      </button>
    ) : (
      <button
        type="button"
        onClick={handleClick}
        className="flex items-center gap-1.5 rounded-md p-2 text-gray-600 hover:text-gray-900 lg:border lg:border-gray-300 lg:px-3 lg:py-1.5 lg:hover:bg-gray-50"
        aria-label="Install FireTrack app"
        title="Install FireTrack app"
      >
        <Download className="h-6 w-6 lg:h-4 lg:w-4" />
        <span className="hidden text-sm font-medium lg:inline">Install App</span>
      </button>
    );

  return (
    <>
      {button}
      {showIosHelp && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => setShowIosHelp(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-ios-title"
            className="w-full max-w-sm rounded-xl bg-white p-5 text-left text-gray-900 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 id="install-ios-title" className="text-lg font-bold text-bfp-navy">
                Install FireTrack
              </h2>
              <button
                type="button"
                onClick={() => setShowIosHelp(false)}
                className="rounded p-1 text-gray-500 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ol className="space-y-3 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="font-semibold">1.</span>
                <span>
                  Tap the <Share className="inline h-4 w-4 align-text-bottom" /> <b>Share</b> button
                  in Safari&apos;s toolbar.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold">2.</span>
                <span>
                  Choose <PlusSquare className="inline h-4 w-4 align-text-bottom" />{' '}
                  <b>Add to Home Screen</b>, then tap <b>Add</b>.
                </span>
              </li>
            </ol>
            <p className="mt-4 text-xs text-gray-500">
              FireTrack will open from your home screen in its own window, like an app.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
