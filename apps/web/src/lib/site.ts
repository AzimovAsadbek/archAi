/**
 * Canonical origin of the public site. Used for `<link rel="canonical">`, Open
 * Graph URLs, the sitemap and robots.txt — everything that must be absolute.
 * Overridable per deployment; falls back to the local dev origin.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
).replace(/\/+$/, '');

/** Joins a path onto {@link SITE_URL}, guaranteeing exactly one slash. */
export function absoluteUrl(path = '/'): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/** The one honest contact channel — a real mailbox, never a form that only pretends to send. */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'info@archai.uz';
