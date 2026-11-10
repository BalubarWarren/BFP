import { Inter } from 'next/font/google';
import '../styles/globals.css';
// react-pdf-highlighter (used by components/reports/PdfAnnotator.jsx for "Review & Annotate" /
// viewing a report's PDF attachments) ships its layout CSS as separate files rather than one
// bundled stylesheet, and never imported them itself — without these, pdf.js's text layer
// renders as unpositioned, unstyled text instead of being precisely overlaid on the rendered
// page, which is what made the PDF viewer look like garbled, overlapping text bleeding across
// the whole screen instead of a contained document. Imported globally here (rather than in
// PdfAnnotator.jsx itself) because Next.js only reliably allows importing plain, non-module CSS
// from node_modules at the root layout.
import 'react-pdf-highlighter/dist/style/pdf_viewer.css';
import 'react-pdf-highlighter/dist/style/PdfHighlighter.css';
import 'react-pdf-highlighter/dist/style/Highlight.css';
import 'react-pdf-highlighter/dist/style/AreaHighlight.css';
import 'react-pdf-highlighter/dist/style/Tip.css';
import 'react-pdf-highlighter/dist/style/MouseSelection.css';
import { ThemeProvider } from '../components/common/ThemeProvider';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata = {
  title: 'FireTrack — Fire Incident Report Tracking System',
  description: 'FireTrack — fire incident report tracking for BFP Benguet: submit, review and trace every report through the approval chain.',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    // iOS ignores SVG home-screen icons, so "Add to Home Screen" needs a PNG.
    apple: '/pwa/apple-touch-icon.png',
  },
  themeColor: '#1A2B4A',
  appleWebApp: {
    capable: true,
    title: 'FireTrack',
    statusBarStyle: 'black-translucent',
  },
};

// Runs in <head> before React loads. Chrome/Edge fire `beforeinstallprompt` once, early, and only
// that event can open the install dialog later — so it's stashed on window here (and announced)
// rather than relying on InstallAppButton having mounted in time to catch it.
const INSTALL_PROMPT_SCRIPT = `(function(){window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__fireTrackInstallPrompt=e;window.dispatchEvent(new Event('firetrack:installable'));});window.addEventListener('appinstalled',function(){window.__fireTrackInstallPrompt=null;window.dispatchEvent(new Event('firetrack:installed'));});})();`;

// Production only: in `next dev` a service worker just gets in the way of hot reloading.
const SW_REGISTER_SCRIPT = `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){});});}`;

export default function RootLayout({
  children,
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/* Applies the saved theme before first paint so there's no light-mode flash for users
            who chose dark (or whose system is dark) — this runs before React hydrates. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('bfp-theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
        <script dangerouslySetInnerHTML={{ __html: INSTALL_PROMPT_SCRIPT }} />
        {process.env.NODE_ENV === 'production' && (
          <script dangerouslySetInnerHTML={{ __html: SW_REGISTER_SCRIPT }} />
        )}
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
