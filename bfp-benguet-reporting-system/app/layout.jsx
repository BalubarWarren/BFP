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
    apple: '/favicon.svg',
  },
};

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
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
