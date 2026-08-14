import { SOTIX_IN_M2 } from '@archai/shared';

/** Rounds to at most `decimals` places and drops trailing zeros. */
export function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function m2ToSotix(areaM2: number): number {
  return round(areaM2 / SOTIX_IN_M2, 2);
}

export function sotixToM2(sotix: number): number {
  return round(sotix * SOTIX_IN_M2, 2);
}

export function footprintM2(widthM: number, lengthM: number): number {
  return round(widthM * lengthM, 1);
}

export function coveragePercent(footprint: number, landAreaM2: number): number {
  if (landAreaM2 <= 0) return 0;
  return Math.round((footprint / landAreaM2) * 100);
}

/**
 * Money is always UZS here, so it is grouped the local way — whole so'm, spaced
 * thousands — whatever the UI language: a price reads wrong to a local eye with
 * commas in it. The separator is swapped in explicitly rather than left to the
 * locale, because CLDR groups `uz-Latn` with commas and Node and Chrome ship
 * different data for it, so the same amount would otherwise render two ways.
 * The currency word lives in the catalogs (`{amount} so'm` / `сум`) so each
 * locale can name it.
 */
const UZS_FORMAT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export function formatUZS(amount: number): string {
  return UZS_FORMAT.format(Math.round(amount)).replaceAll(',', '\u00A0');
}

/** Parses a user-typed decimal, tolerating a comma as the decimal separator. */
export function parseNumberInput(raw: string): number | null {
  const trimmed = raw.trim().replace(',', '.');
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

export function numberToInput(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return '?';
  return parts.map((part) => [...part][0]?.toUpperCase() ?? '').join('');
}
