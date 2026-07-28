/** @type {import('next').NextConfig} */

// 'unsafe-inline' on script/style is a deliberate tradeoff, not an
// oversight: this app uses plenty of inline style={{...}} attributes
// (marketplace theme colors, chart segment colors, KPI accent borders)
// and Next.js's own hydration data script — a nonce-based CSP would be
// stricter but requires per-request nonce plumbing through every
// Server Component that renders inline styles, which is a much bigger
// change. script-src otherwise stays locked to 'self'; there is no
// third-party script anywhere in this app.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // preload requires actually submitting the domain to hstspreload.org —
  // safe to send the header either way, browsers just won't preload it
  // until that's done.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

module.exports = nextConfig;
