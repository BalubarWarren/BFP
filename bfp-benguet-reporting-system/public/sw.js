// FireTrack is no longer an installable app. This replacement worker exists only so browsers that
// registered the old one pick it up on their next update check and remove it cleanly.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(self.registration.unregister());
});
