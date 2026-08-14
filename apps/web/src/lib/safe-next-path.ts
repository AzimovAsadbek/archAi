/**
 * Only same-origin, absolute-path redirects survive — never an open redirect.
 * Resolves against a throwaway base and compares origins so that authority-position
 * tricks the browser treats as a host (`//evil.com`, `/\evil.com`, `/\/evil.com`)
 * are rejected — a prefix check on `//` misses the backslash form.
 */
export function safeNextPath(value: string | string[] | undefined, fallback = '/dashboard'): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate !== 'string' || !candidate.startsWith('/')) return fallback;
  try {
    const base = 'http://x.invalid';
    const url = new URL(candidate, base);
    if (url.origin !== base) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
