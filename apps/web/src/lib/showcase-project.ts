import {
  generateBestFloorPlan,
  type FloorPlan,
  type FloorPlanInput,
} from '@archai/floor-plan-engine';
import { calculateEstimate, type EstimateResult, type EstimateRules } from '@archai/shared';

/**
 * The worked example the landing page shows.
 *
 * It is the brief from the product's own docs — 6 sotix, two floors, four
 * rooms, modern — run through the *real* engine and the *real* estimate
 * function at render time. Nothing is hand-drawn and nothing is cached from a
 * previous run, so the landing page cannot drift away from what the product
 * actually produces: if the engine changes, this changes with it.
 *
 * Deliberately not fetched from the API. The engine is a pure function and the
 * estimate is a pure function, so a marketing page can call both without a
 * database, without auth, and without a network hop.
 */

export const SHOWCASE_BRIEF = {
  landAreaM2: 600,
  widthM: 12,
  lengthM: 15,
  floorCount: 2,
} as const;

const SHOWCASE_INPUT: FloorPlanInput = {
  house: {
    widthM: SHOWCASE_BRIEF.widthM,
    lengthM: SHOWCASE_BRIEF.lengthM,
    floorCount: SHOWCASE_BRIEF.floorCount,
  },
  rooms: [
    { id: 's-living', type: 'LIVING_ROOM', floor: 0, widthM: 6, lengthM: 5.5 },
    { id: 's-kitchen', type: 'KITCHEN', floor: 0, widthM: 3.6, lengthM: 4 },
    { id: 's-dining', type: 'DINING_ROOM', floor: 0, widthM: 3.6, lengthM: 3.8 },
    { id: 's-bath-0', type: 'BATHROOM', floor: 0, widthM: 2, lengthM: 2.5 },
    { id: 's-bed-1', type: 'BEDROOM', floor: 1, widthM: 4.2, lengthM: 4.4 },
    { id: 's-bed-2', type: 'BEDROOM', floor: 1, widthM: 3.8, lengthM: 4 },
    { id: 's-bed-3', type: 'BEDROOM', floor: 1, widthM: 3.6, lengthM: 3.8 },
    { id: 's-bath-1', type: 'BATHROOM', floor: 1, widthM: 2, lengthM: 2.5 },
  ],
};

/**
 * Pricing for the specimen only. The product prices from the active
 * `estimate_rules` row in the database; the landing page has no database, so it
 * uses the same numbers the seed ships with. They are labelled as indicative in
 * the UI, exactly like every other estimate the product shows.
 */
const SHOWCASE_RULES: EstimateRules = {
  version: '1',
  currency: 'UZS',
  structureCostPerM2: 3_500_000,
  finishCostPerM2: { STANDARD: 2_000_000, COMFORT: 3_200_000, PREMIUM: 5_000_000 },
  extraFloorFactor: 1.08,
  features: {
    garage: 60_000_000,
    terrace: 25_000_000,
    balcony: 15_000_000,
    pool: 120_000_000,
    garden: 8_000_000,
  },
  laborShare: 0.35,
  contingencyShare: 0.08,
  rangeShare: 0.15,
};

export interface ShowcaseData {
  plan: FloorPlan;
  estimate: EstimateResult;
}

/**
 * Returns the specimen, or `null` when the engine cannot lay the brief out.
 * The caller drops the section rather than substituting a picture — a landing
 * page that shows a plan the engine refused to produce would be the exact
 * dishonesty this section exists to avoid.
 */
let cached: ShowcaseData | null | undefined;

export function buildShowcase(): ShowcaseData | null {
  // Memoized for the life of the process. The input is a module constant and
  // the engine is deterministic, so every call returns a deep-equal result —
  // recomputing per request bought nothing but CPU, measured at 3.4 ms warm and
  // 10.5 ms cold. A deploy restarts the process, so a genuine engine change
  // still takes effect.
  if (cached === undefined) cached = computeShowcase();
  return cached;
}

function computeShowcase(): ShowcaseData | null {
  const result = generateBestFloorPlan(SHOWCASE_INPUT, { seed: 1 });
  if (!result.ok) return null;

  const estimate = calculateEstimate(
    {
      land: { areaM2: SHOWCASE_BRIEF.landAreaM2, widthM: null, lengthM: null },
      house: {
        widthM: SHOWCASE_BRIEF.widthM,
        lengthM: SHOWCASE_BRIEF.lengthM,
        floorCount: SHOWCASE_BRIEF.floorCount,
        style: 'MODERN',
      },
      rooms: [],
      features: { garage: true, terrace: true, balcony: false, pool: false, garden: false },
    },
    SHOWCASE_RULES,
    'STANDARD',
  );

  return { plan: result.plan, estimate };
}
