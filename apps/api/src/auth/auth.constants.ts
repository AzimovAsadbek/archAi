/** httpOnly cookie names (see ADR-003). */
export const AUTH_COOKIES = {
  access: 'archai_access',
  refresh: 'archai_refresh',
} as const;

/** The refresh cookie is only ever sent to the auth endpoints. */
export const REFRESH_COOKIE_PATH = '/api/v1/auth';
export const ACCESS_COOKIE_PATH = '/';

/** Bytes of entropy for the opaque refresh token. */
export const REFRESH_TOKEN_BYTES = 48;

/**
 * A refresh token seen already-revoked within this window is treated as a benign
 * concurrent rotation (two tabs, a retried request) — the presenter is rejected
 * but the session family is spared. Seen revoked beyond it, it is genuine reuse
 * (a replayed/stolen token) and the whole family is revoked.
 */
export const REFRESH_REUSE_GRACE_MS = 10_000;

export const RATE_LIMIT_TTL_MS = 60_000;
export const GLOBAL_RATE_LIMIT = 100;
export const AUTH_RATE_LIMIT = 10;
