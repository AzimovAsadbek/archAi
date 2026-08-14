# Security

Threat posture: consumer web product; primary risks are account takeover, cross-tenant data
access (IDOR), injection via user input, and secret leakage.

## Implemented (slice 1)

- Passwords: argon2id. Uniform `INVALID_CREDENTIALS` on login (no user enumeration);
  auth endpoints rate-limited (10/min/IP), baseline 100/min/IP per endpoint (throttler keys
  counters per route+IP; revisit with a custom key generator if a true global cap is needed).
- Sessions: httpOnly SameSite=Lax cookies; 15-min access JWT; 30-day opaque refresh token,
  sha256-hashed at rest, rotated per use; reuse of a revoked token revokes all user sessions.
- Authorization: global auth guard (allowlist via @Public); every project query owner-scoped
  in the `where`; cross-user access answers 404 (no existence leak). Client-side guards are UX only.
- Input: all bodies/queries validated by shared zod schemas; domain rules enforced server-side
  (422). API never echoes stack traces; 500s are generic + logged with request id.
- Headers/transport: helmet defaults; CORS locked to `WEB_ORIGIN` with credentials.
- Secrets: env-only (`apps/api/.env`, gitignored); `.env.example` documents keys; startup
  fails fast on missing env. AI keys will be server-side only.

## Standing rules for future slices

- New resources: owner FK + scoped queries + 404 policy + e2e ownership test — before merge.
- Admin surface: explicit RBAC checks + audit log entries; no implicit bypasses.
- Uploads (slice 5+): MIME + size validation, no path traversal, object storage, no direct
  serving from user-controlled names. AI prompts treated as untrusted (injection defenses,
  output schema-validated, no tool/SQL execution from model output).
- Never log tokens, password material, or full request bodies of auth routes.

## Review cadence

security-reviewer agent pass before every milestone push; full checklist (auth, authz, CSRF,
XSS, injection, uploads, SSRF, rate limits, secrets, logging) before any production claim.

## Independent review 2026-08-15 (post-admin) — findings & resolutions

An independent fresh-context review (live-verified against the running app) confirmed the
IDOR/404 policy, soft-delete honoring, admin RBAC+audit, mass-assignment stripping, Prisma
operator-injection closure, PDF Content-Disposition safety, CORS lockdown, XSS sink absence,
and AI injection defenses as solid. Fixed:

- **[High] Deactivated user kept access** until the 15-min access token expired — the guard
  verified only the JWT signature. `JwtAuthGuard` now loads the user and rejects when missing
  or inactive on every request, and takes `role` from the live row (immediate deactivation
  and demotion). e2e asserts a data endpoint 401s post-deactivation, not just `/users/me`.
- **[High] Open redirect** via a backslash (`/\evil.com`) slipping past the `//` prefix check
  in `safeNextPath` — now resolves against a throwaway base and compares origins.
- **[Med] No web security headers** — `next.config.ts` sets `frame-ancestors 'none'` +
  X-Frame-Options DENY (clickjacking on one-click destructive actions), Referrer-Policy,
  nosniff, Permissions-Policy, and HSTS in production.
- **[Med] Concurrent refresh false-positive** killed the whole session family — rotation is
  now an atomic conditional revoke, and reuse inside a 10 s grace window is treated as benign
  concurrency (reject the presenter, spare the family); genuine reuse past the window still
  revokes the family. e2e covers both.
- **[Med] Seed script** had no production guard and plants a repo-published admin password —
  now refuses in production without `ALLOW_PROD_SEED=true`; the login-page demo-credentials
  panel is gated out of production builds.
- **[Low] Malformed `:id`** (NUL byte) surfaced as 500 — `IdParamPipe` 404s ids that can't be
  real. Compute endpoints (`/floor-plan`, `/estimate`) gained rate limits.

Deferred (documented, not blocking): register-endpoint email enumeration (product tradeoff;
login is uniform), `x-request-id` echo (not rendered, CR/LF-safe), and throttler `trust proxy`
tuning (deployment-time — must match the real hop count).
