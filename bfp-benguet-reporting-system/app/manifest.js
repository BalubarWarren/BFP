// Web app manifest — served by Next.js at /manifest.webmanifest and linked from every page
// automatically. Together with public/sw.js this is what lets browsers offer "Install FireTrack"
// (see components/common/InstallAppButton.jsx): the installed app is still just this Vercel
// deployment opened in its own window, so there is nothing extra to host or update.
export default function manifest() {
  return {
    id: '/',
    name: 'FireTrack — BFP Benguet',
    short_name: 'FireTrack',
    description:
      'Fire incident report tracking for BFP Benguet: submit, review and trace every report through the approval chain.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#1A2B4A',
    theme_color: '#1A2B4A',
    icons: [
      { src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
