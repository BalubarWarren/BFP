import '@/styles/globals.css';

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
