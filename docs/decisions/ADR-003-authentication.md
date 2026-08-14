# ADR-003: Authentication design

**Status:** accepted · 2026-08-14

- Access: short-lived JWT (15 min) in httpOnly `archai_access` cookie, signed with
  `JWT_ACCESS_SECRET`, payload `{ sub, role }`.
- Refresh: 256-bit random opaque token in httpOnly `archai_refresh` cookie
  (path `/api/v1/auth`), SHA-256 hash stored in `refresh_tokens` with expiry, user agent,
  revocation. Rotation on every refresh; reuse of a revoked token revokes the whole family
  (all user sessions) as theft mitigation.
- Passwords: argon2id. Login errors are uniform (`INVALID_CREDENTIALS`) to prevent enumeration;
  auth endpoints rate-limited.
- CSRF posture: SameSite=Lax cookies + strict CORS origin + no state-changing GET.
  Revisit (double-submit token) if cross-site embedding ever appears.
- Web client: auth state via `/users/me`; on 401 it attempts one refresh then redirects to
  login. Route protection in the browser is UX only — the API is the security boundary.
