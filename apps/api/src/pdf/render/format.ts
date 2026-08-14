/**
 * Value formatting for the document. Every formatter is pure and locale-stable:
 * the same inputs must always produce the same bytes, so nothing here reads the
 * clock or the host locale.
 */

/** Keeps grouped thousands on one line. */
const NBSP = String.fromCharCode(0xa0);

/**
 * Money is always UZS, grouped the local way — whole so'm, non-breaking spaces
 * between thousands — whatever the document language, mirroring
 * `apps/web/src/lib/format.ts`.
 */
const GROUPED = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export function formatAmount(value: number): string {
  return GROUPED.format(Math.round(value)).replaceAll(',', NBSP);
}

/** Rounds to at most `decimals` places and drops trailing zeros. */
export function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Decimal number with a dot separator — read the same way in all three locales. */
export function formatNumber(value: number, decimals = 1): string {
  return String(round(value, decimals));
}

const TASHKENT_DATE = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Tashkent',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** `dd.MM.yyyy` in Asia/Tashkent — the timezone the product is written for. */
export function formatDate(date: Date): string {
  return TASHKENT_DATE.format(date).replaceAll('/', '.');
}

/**
 * Folds the apostrophe variants Uzbek text arrives with (U+02BB, U+02BC and the
 * curly quotes) onto the ASCII one. Manrope has no glyph for the modifier
 * letters — upstream, not just in the static build — and an unmapped code point
 * would print as a blank box in the middle of a word.
 */
export function sanitize(text: string): string {
  return text.replace(/[ʻʼ‘’]/g, "'");
}

/** Short, stable project reference for the cover — the id's trailing segment. */
export function shortId(id: string): string {
  return id.slice(-8).toUpperCase();
}

/**
 * ASCII, lowercase, hyphen-joined name for the download filename. Non-latin
 * names collapse to nothing, so the caller falls back to the project id.
 */
export function slugify(name: string): string {
  return sanitize(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
