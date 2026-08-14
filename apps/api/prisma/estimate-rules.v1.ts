import { type EstimateRules } from '@archai/shared';

/**
 * Seeded pricing rules, version 1 — a realistic 2026 Uzbekistan ballpark for a
 * private house, deliberately easy to adjust (slice 8 makes them admin-editable).
 * They live outside `seed.ts` so the e2e suite can price against exactly the same
 * numbers instead of a copy that silently drifts.
 *
 * Amounts are UZS.
 */
export const ESTIMATE_RULES_V1: EstimateRules = {
  version: '1',
  currency: 'UZS',
  /** Foundation + frame + walls + roof, per floor m². */
  structureCostPerM2: 3_500_000,
  finishCostPerM2: {
    STANDARD: 2_000_000,
    COMFORT: 3_200_000,
    PREMIUM: 5_000_000,
  },
  /** Every floor above the ground one costs 8% more to build. */
  extraFloorFactor: 1.08,
  features: {
    garage: 60_000_000,
    terrace: 25_000_000,
    balcony: 15_000_000,
    pool: 120_000_000,
    /** Per 100 m² (1 sotix) of land. */
    garden: 8_000_000,
  },
  laborShare: 0.35,
  contingencyShare: 0.1,
  rangeShare: 0.15,
};
