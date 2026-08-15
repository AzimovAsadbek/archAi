/**
 * Only same-origin, absolute-path redirects survive — never an open redirect.
 * Resolves against a throwaway base and compares origins so that authority-position
 * tricks the browser treats as a host (`//evil.com`, `/\evil.com`, `/\/evil.com`)
 * are rejected — a prefix check on `//` misses the backslash form.
 *
 * A final guard rejects any resolved path that still begins with `//`: inputs like
 * `/..//evil.com` normalise to the pathname `//evil.com`, which a browser reads as a
 * protocol-relative URL and follows off-site. Same-origin resolution alone misses it.
 */
export function safeNextPath(value: string | string[] | undefined, fallback = '/dashboard'): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate !== 'string' || !candidate.startsWith('/')) return fallback;
  try {
    const base = 'http://x.invalid';
    const url = new URL(candidate, base);
    if (url.origin !== base) return fallback;
    const path = url.pathname + url.search + url.hash;
    // Protocol-relative once resolved (`//evil.com`) → treat as off-site.
    if (path.startsWith('//')) return fallback;
    return path;
  } catch {
    return fallback;
  }
}
