import { type HouseStyle, type RoomType } from '@archai/shared';

/**
 * The landing brief a visitor fills in before they have an account.
 *
 * It is a *hint*, never a source of truth: it is stored in sessionStorage,
 * survives exactly one registration hop, and is re-validated by the shared
 * schemas the moment the configurator reads it. Anything malformed is dropped
 * rather than repaired, so a tampered value can only ever mean "no brief".
 */
export interface LandingBrief {
  landAreaM2: number;
  widthM: number | null;
  lengthM: number | null;
  floorCount: number;
  rooms: { type: RoomType; floor: number }[];
  style: HouseStyle;
}

const KEY = 'archai_landing_brief';

export function saveBrief(brief: LandingBrief): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(brief));
  } catch {
    // Private mode or a full quota: the brief is a convenience, never a
    // requirement, so losing it must not break the sign-up path.
  }
}

/** Reads and clears the brief — it is single-use by design. */
export function takeBrief(): LandingBrief | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (raw === null) return null;
    window.sessionStorage.removeItem(KEY);
    const parsed: unknown = JSON.parse(raw);
    return isBrief(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isBrief(value: unknown): value is LandingBrief {
  if (typeof value !== 'object' || value === null) return false;
  const b = value as Record<string, unknown>;
  return (
    typeof b.landAreaM2 === 'number' &&
    Number.isFinite(b.landAreaM2) &&
    typeof b.floorCount === 'number' &&
    Number.isInteger(b.floorCount) &&
    typeof b.style === 'string' &&
    Array.isArray(b.rooms)
  );
}
