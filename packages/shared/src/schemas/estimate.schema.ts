import { z } from 'zod';
import { type FeaturesConfig } from './project.schema';

/** Finish quality tiers the user chooses between; selects `finishCostPerM2`. */
export const FINISH_LEVELS = ['STANDARD', 'COMFORT', 'PREMIUM'] as const;
export type FinishLevel = (typeof FINISH_LEVELS)[number];

/** Priced project features, in presentation order — a subset view of `FeaturesConfig`. */
export const FEATURE_KEYS = [
  'garage',
  'terrace',
  'balcony',
  'pool',
  'garden',
] as const satisfies readonly (keyof FeaturesConfig)[];
export type FeatureKey = (typeof FEATURE_KEYS)[number];

const price = z.number().positive();
const amount = z.number().nonnegative();
/** A 0..1 share of another amount. */
const share = z.number().min(0).max(1);

/**
 * Admin-editable pricing rules (docs/estimate.md §Rule model). Stored as JSONB in
 * `estimate_rules.data` and re-validated on every read — AI never invents prices,
 * and invalid stored data must never reach a calculation.
 */
export const estimateRulesSchema = z.object({
  /** Provenance echoed in every result, e.g. '1'. */
  version: z.string().min(1),
  currency: z.literal('UZS'),
  /** Foundation + frame + walls + roof, per floor m². */
  structureCostPerM2: price,
  finishCostPerM2: z.object({ STANDARD: price, COMFORT: price, PREMIUM: price }),
  /** Multiplier on the structure cost of every floor above the first, e.g. 1.08. */
  extraFloorFactor: z.number().min(1).max(3),
  /** Flat UZS amounts; `garden` is priced per 100 m² (1 sotix) of land. */
  features: z.object({
    garage: amount,
    terrace: amount,
    balcony: amount,
    pool: amount,
    garden: amount,
  }),
  /** Share of (structure + finish) reported as the informational labor line. */
  laborShare: share,
  /** Share of (structure + finish + features) added as contingency, e.g. 0.1. */
  contingencyShare: share,
  /** ± band around the total, e.g. 0.15. */
  rangeShare: share,
});
export type EstimateRules = z.infer<typeof estimateRulesSchema>;

/** Query of `GET /projects/:id/estimate` — the finish tier to price. */
export const estimateQuerySchema = z.object({
  finishLevel: z.enum(FINISH_LEVELS).default('STANDARD'),
});
export type EstimateQuery = z.infer<typeof estimateQuerySchema>;
