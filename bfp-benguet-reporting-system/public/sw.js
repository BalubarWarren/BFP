// FireTrack service worker. Its only jobs are to make the app installable and to show a friendly
// "you're offline" page instead of the browser's error page when the installed app is opened
// without a connection. It deliberately caches NOTHING else: every page, API call and attachment
// still goes straight to the network, so users never see stale reports or a stale login state.

const OFFLINE_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>FireTrack — Offline</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
    font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#1A2B4A;color:#fff;text-align:center;padding:24px}
  h1{font-size:1.4rem;margin:0 0 .5rem}
  p{color:rgba(255,255,255,.7);max-width:24rem;margin:0 auto 1.5rem}
  a{display:inline-block;border:2px solid #D4AF37;color:#fff;padding:.6rem 1.6rem;border-radius:8px;text-decoration:none;font-weight:600}
</style></head>
<body><div>
  <h1>You're offline</h1>
  <p>FireTrack needs an internet connection to load reports. Check your connection and try again.</p>
  <a href="">Try again</a>
</div></body></html>`;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Only page navigations get the offline fallback; everything else is left to the browser.
  if (event.request.mode !== 'navigate') return;

  event.respondWith(
    fetch(event.request).catch(
      () =>
        new Response(OFFLINE_HTML, {
          status: 503,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
    )
  );
});
