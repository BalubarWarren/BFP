import { Inter } from 'next/font/google';
import '../styles/globals.css';
import { ThemeProvider } from '../components/common/ThemeProvider';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata = {
  title: 'BFP Benguet Fire Incident Reporting System',
  description: 'Digital fire incident reporting portal for Benguet Province',
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
