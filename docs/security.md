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
