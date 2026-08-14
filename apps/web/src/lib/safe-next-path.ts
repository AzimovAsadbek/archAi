/** Only same-origin, absolute-path redirects survive — never an open redirect. */
export function safeNextPath(value: string | string[] | undefined, fallback = '/dashboard'): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate !== 'string') return fallback;
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return fallback;
  return candidate;
}
