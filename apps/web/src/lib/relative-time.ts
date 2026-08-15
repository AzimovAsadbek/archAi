/**
 * Relative-time bucketing, kept pure and translator-free so it is trivially
 * testable and locale-agnostic. The caller renders the returned descriptor
 * through the `time` message namespace — `t(key, { count })` — which localises
 * correctly even for `uz`, whose relative-time CLDR data Chrome and Node lack,
 * so `Intl.RelativeTimeFormat('uz')` emits a raw "-15 h" instead of words.
 * (The same locale-data gap is documented for currency grouping in `format.ts`.)
 *
 * Designed for *past* timestamps such as `updatedAt`: a sub-minute delta — and
 * any small future skew between a server timestamp and the client clock, which
 * otherwise surfaced as "+17 s" — collapses to "now".
 */
export type RelativeUnitKey = 'minutesAgo' | 'hoursAgo' | 'daysAgo' | 'monthsAgo' | 'yearsAgo';
export type RelativeTimeParts = { key: 'now' } | { key: RelativeUnitKey; count: number };

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 2_629_800; // avg month, 30.44 d in seconds
const YEAR = 31_557_600; // Julian year in seconds

const toMs = (value: Date | number | string): number =>
  value instanceof Date
    ? value.getTime()
    : typeof value === 'number'
      ? value
      : new Date(value).getTime();

export function relativeTimeParts(
  from: Date | number | string,
  now: Date | number | string,
): RelativeTimeParts {
  const seconds = Math.round((toMs(now) - toMs(from)) / 1000);
  const round = (unit: number) => Math.max(1, Math.round(seconds / unit));

  if (seconds < 45) return { key: 'now' };
  if (seconds < 45 * MINUTE) return { key: 'minutesAgo', count: round(MINUTE) };
  if (seconds < 22 * HOUR) return { key: 'hoursAgo', count: round(HOUR) };
  if (seconds < 26 * DAY) return { key: 'daysAgo', count: round(DAY) };
  if (seconds < 11 * MONTH) return { key: 'monthsAgo', count: round(MONTH) };
  return { key: 'yearsAgo', count: round(YEAR) };
}
