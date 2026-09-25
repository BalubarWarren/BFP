// Attachment storage host — same env var lib/storage.js uses for the Supabase Storage client.
// Read here so the CSP directives below track whatever project/env this actually deploys to
// instead of a hardcoded hostname. Falls back to an empty string (CSP just allows 'self' for
// those directives) if it's ever missing, rather than throwing and breaking the build.
const SUPABASE_ORIGIN = (() => {
  try {
    return new URL(process.env.SUPABASE_URL).origin;
  } catch {
    return '';
  }
})();

// PdfAnnotator.jsx loads the pdf.js worker from unpkg at runtime (not bundled) — see
// components/reports/PdfAnnotator.jsx's WORKER_SRC. CSP has to explicitly allow it or the
// "Review & Annotate" PDF viewer breaks silently (the worker just fails to load, no visible
// error beyond the browser console).
const PDFJS_CDN_ORIGIN = 'https://unpkg.com';

// Content-Security-Policy: 'unsafe-inline' is kept for script-src/style-src rather than moving
// to a nonce-based policy — Next.js App Router injects its own per-request inline scripts for
// RSC streaming/hydration (see app/verify/[token]/page.jsx's rendered output for an example),
// which a static CSP can't allowlist by hash since their content differs every request. A
// nonce-based CSP (via middleware) would close this gap but is a larger, riskier change; every
// other directive below is scoped tightly (no wildcard origins) so this is a deliberate,
// documented trade-off rather than an oversight.
const CSP = [
  "default-src 'self'",
  // pdfjs-dist doesn't load its worker via `new Worker('https://unpkg.com/...')` directly — it
  // fetches the script text and constructs the worker from a `blob:` URL instead (visible as
  // "Creating a worker from 'blob:...'" if this ever regresses), and falls back to loading the
  // same script as a plain <script> ("fake worker" mode, main-thread parsing) when worker
  // creation is blocked. Both paths need to be allowed or the PDF viewer breaks: script-src
  // needs unpkg.com for the fallback, worker-src needs both unpkg.com and blob: for the normal
  // path.
  `script-src 'self' 'unsafe-inline' ${PDFJS_CDN_ORIGIN}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:" + (SUPABASE_ORIGIN ? ` ${SUPABASE_ORIGIN}` : ''),
  "font-src 'self'",
  `connect-src 'self' ${PDFJS_CDN_ORIGIN}` + (SUPABASE_ORIGIN ? ` ${SUPABASE_ORIGIN}` : ''),
  "frame-src 'self'" + (SUPABASE_ORIGIN ? ` ${SUPABASE_ORIGIN}` : ''),
  `worker-src 'self' blob: ${PDFJS_CDN_ORIGIN}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // Belt-and-suspenders with the X-Frame-Options header below — frame-ancestors is the modern
  // replacement, X-Frame-Options covers browsers that don't read CSP.
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Vercel already sets this at the edge, but declaring it explicitly here means it's correct
  // even if that changes, and it's consistent across every response type (including the 304s
  // ZAP flagged as missing it).
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: SECURITY_HEADERS,
      },
    ];
  },
}

module.exports = nextConfig
