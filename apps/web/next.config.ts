import path from 'node:path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/**
 * Baseline security headers on every HTML response. The API sets its own via
 * helmet; these protect the rendered app — the one-click destructive actions in
 * the workspace and admin panel make clickjacking the concrete risk, so
 * frame-ancestors/X-Frame-Options are the load-bearing entries. HSTS is emitted
 * only in production (it would pin localhost over HTTP in dev).
 */
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
    : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  /**
   * Forces a literal for the demo-credentials flag.
   *
   * Next only inlines `process.env.NEXT_PUBLIC_*` for variables that exist at
   * build time; an undefined one is left as a runtime property lookup. That is
   * enough to defeat dead-code elimination — the login form's guard could not
   * fold, so the seeded demo password shipped inside the production bundle even
   * though the panel showing it was correctly hidden. Defaulting to the string
   * `'false'` makes the comparison statically false, and the credentials are
   * dropped from the build entirely.
   */
  env: {
    NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS: process.env.NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS ?? 'false',
  },
  // Self-contained production server (traced deps + minimal server.js), used by
  // the Docker image. Standalone tracing creates symlinks, which Windows blocks
  // without elevation — so it is opt-in via env (the Dockerfile sets it) and the
  // local/CI build on any OS keeps the default output. Tracing root = repo root
  // so workspace packages are bundled.
  output: process.env.NEXT_OUTPUT_STANDALONE === 'true' ? 'standalone' : undefined,
  outputFileTracingRoot: path.join(__dirname, '../..'),
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  /**
   * Same-origin proxy to the API deployment.
   *
   * The session cookies are `SameSite=Lax`, which a browser will not send on a
   * cross-site request — and on Vercel's shared `*.vercel.app` domain two
   * deployments *are* cross-site, because `vercel.app` is on the Public Suffix
   * List. Relaxing them to `SameSite=None` would work only until third-party
   * cookie blocking caught up with it.
   *
   * Rewriting instead keeps the browser talking to one origin: it requests
   * `/api/v1/...` from the web deployment, Vercel proxies to the API, and the
   * `Set-Cookie` that comes back is first-party. The client sends relative
   * URLs (`NEXT_PUBLIC_API_URL=""`), so no CORS preflight happens at all.
   *
   * Unset `API_ORIGIN` — local development — and this is a no-op: the client
   * falls back to `http://localhost:3001` and talks to the API directly, where
   * localhost keeps both ports same-site anyway.
   */
  async rewrites() {
    const apiOrigin = process.env.API_ORIGIN?.replace(/\/$/, '');
    if (!apiOrigin) return [];
    return [{ source: '/api/v1/:path*', destination: `${apiOrigin}/api/v1/:path*` }];
  },
};

export default withNextIntl(nextConfig);
