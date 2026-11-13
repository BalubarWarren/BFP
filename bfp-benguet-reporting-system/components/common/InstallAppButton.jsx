'use client';

import { useEffect, useState } from 'react';
import { Download, Share, PlusSquare, MoreVertical, MoreHorizontal, X } from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';

// "Install app" button. Installing just opens this same deployment in its own app window with a
// home-screen / Start-menu / dock icon — the app is still served from Vercel, so there's nothing
// separate to update. Hidden only once the app is already installed (i.e. we're running inside it).
//
// - When the browser has handed us its install prompt (Chrome / Edge / Android, captured in
//   app/layout.jsx), clicking opens the browser's own install dialog.
// - Otherwise it shows that browser's manual install steps. This covers iPhone/iPad and Mac Safari
//   (no install API at all), Firefox, and also Chrome/Edge before they decide to offer the prompt —
//   Chrome withholds it until the visitor has clicked on the page and stayed ~30 seconds, so a
//   button that waited for it would look missing on a first visit.

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function detectPlatform() {
  const ua = window.navigator.userAgent;
  // iPadOS reports itself as a Mac; touch support tells them apart.
  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) {
    return 'ios';
  }
  if (/Firefox\//.test(ua)) return /Android/.test(ua) ? 'android' : 'firefox';
  if (/Android/.test(ua)) return 'android';
  if (/Edg\//.test(ua)) return 'edge';
  if (/Chrome\//.test(ua)) return 'chrome';
  if (/Safari\//.test(ua) && /Macintosh/.test(ua)) return 'mac-safari';
  return 'other';
}

const Icon = ({ as: Component }) => <Component className="inline h-4 w-4 align-text-bottom" />;

const STEPS = {
  ios: [
    <>Tap the <Icon as={Share} /> <b>Share</b> button in Safari&apos;s toolbar.</>,
    <>Choose <Icon as={PlusSquare} /> <b>Add to Home Screen</b>, then tap <b>Add</b>.</>,
  ],
  android: [
    <>Open the browser menu <Icon as={MoreVertical} /> (top-right corner).</>,
    <>Tap <b>Install app</b> or <b>Add to Home screen</b>, then confirm.</>,
  ],
  chrome: [
    <>Click the install icon <Icon as={Download} /> at the right end of the address bar, <b>or</b></>,
    <>open the menu <Icon as={MoreVertical} /> → <b>Cast, save and share</b> → <b>Install page as app</b>.</>,
  ],
  edge: [
    <>Click the <b>App available</b> icon at the right end of the address bar, <b>or</b></>,
    <>open the menu <Icon as={MoreHorizontal} /> → <b>Apps</b> → <b>Install this site as an app</b>.</>,
  ],
  'mac-safari': [
    <>In the menu bar, choose <b>File</b> → <b>Add to Dock</b>.</>,
    <>Click <b>Add</b>.</>,
  ],
  firefox: [
    <>Firefox on computers can&apos;t install web apps.</>,
    <>Open this site in <b>Chrome</b> or <b>Edge</b> and click <b>Install App</b> there.</>,
  ],
  other: [
    <>Look for <b>Install</b> or <b>Add to Home Screen</b> in your browser&apos;s menu.</>,
    <>If it isn&apos;t there, open this site in <b>Chrome</b> or <b>Edge</b> instead.</>,
  ],
};

export default function InstallAppButton({ variant = 'header' }) {
  const [visible, setVisible] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEscapeKey(() => setShowHelp(false), showHelp);

  useEffect(() => {
    if (isStandalone()) return undefined;
    setVisible(true);

    const onInstalled = () => {
      setVisible(false);
      setShowHelp(false);
    };
    window.addEventListener('firetrack:installed', onInstalled);
    return () => window.removeEventListener('firetrack:installed', onInstalled);
  }, []);

  if (!visible) return null;

  const handleClick = async () => {
    const promptEvent = window.__fireTrackInstallPrompt;
    if (!promptEvent) {
      setShowHelp(true);
      return;
    }
    // The event can only be used once; if they dismiss it, Chrome fires a fresh one later and
    // until then the next click falls back to the manual steps.
    window.__fireTrackInstallPrompt = null;
    promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') setVisible(false);
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
        className="flex h-9 min-w-[2.25rem] items-center justify-center gap-1.5 rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 lg:px-2.5 dark:hover:bg-gray-800 dark:hover:text-white"
        aria-label="Install FireTrack app"
        title="Install FireTrack app"
      >
        <Download className="h-[18px] w-[18px] lg:h-4 lg:w-4" />
        <span className="hidden text-sm font-medium lg:inline">Install App</span>
      </button>
    );

  const steps = showHelp ? STEPS[detectPlatform()] : null;

  return (
    <>
      {button}
      {steps && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center modal-overlay p-4 sm:items-center"
          onClick={() => setShowHelp(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-help-title"
            className="w-full max-w-sm rounded-xl bg-white p-5 text-left text-gray-900 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 id="install-help-title" className="text-lg font-semibold tracking-tight text-gray-900">
                Install FireTrack
              </h2>
              <button
                type="button"
                onClick={() => setShowHelp(false)}
                className="rounded p-1 text-gray-500 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ol className="space-y-3 text-sm text-gray-700">
              {steps.map((step, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="font-semibold">{index + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs text-gray-500">
              FireTrack will then open from its own icon, in its own window, like an app.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
