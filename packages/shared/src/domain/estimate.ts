import { SOTIX_IN_M2 } from '../constants';
import {
  type EstimateRules,
  type FeatureKey,
  FEATURE_KEYS,
  type FinishLevel,
} from '../schemas/estimate.schema';
import { type ProjectConfiguration } from './validate-project';

/** Money is presented in thousands of UZS — anything finer is false precision. */
const ROUNDING_UZS = 1000;

/** Breakdown rows, in presentation order. `labor-info` is informational only. */
export const ESTIMATE_LINE_KEYS = [
  'structure',
  'finish',
  'features',
  'labor-info',
  'contingency',
] as const;
export type EstimateLineKey = (typeof ESTIMATE_LINE_KEYS)[number];

export interface EstimateLine {
  key: EstimateLineKey;
  /** UZS, rounded to 1000. */
  amount: number;
  /** Inputs behind the amount, for the UI footnotes. */
  meta?: Record<string, string | number>;
}

export interface EstimateFeatureLine {
  key: FeatureKey;
  /** UZS, rounded to 1000. */
  amount: number;
  meta?: Record<string, string | number>;
}

export interface EstimateResult {
  /** Always all five `ESTIMATE_LINE_KEYS`, in that order. */
  lines: EstimateLine[];
  /** One row per enabled feature, in `FEATURE_KEYS` order; empty when none. */
  featureLines: EstimateFeatureLine[];
  /** structure + finish + features + contingency (labor is already inside the first two). */
  total: number;
  rangeMin: number;
  rangeMax: number;
  costPerM2: number;
  grossFloorAreaM2: number;
  finishLevel: FinishLevel;
  rulesVersion: string;
  currency: EstimateRules['currency'];
}

/**
 * `calculateEstimate` throws this when the configuration cannot be priced at all.
 *
 * `validateProjectConfiguration` returns a result object because it reports many
 * issues on a half-finished configuration; pricing has a single hard precondition
 * (land + house) and no meaningful partial answer, so it throws instead — a caller
 * can never accidentally use a result that was never computed. The API maps it to
 * 409 `PROJECT_NOT_CONFIGURED`.
 */
export class IncompleteConfigError extends Error {
  /** Stable discriminator for logs; `instanceof` is the runtime check. */
  readonly code = 'INCOMPLETE_CONFIG';
  /** Configuration blocks that were missing, e.g. `['land']`. */
  readonly missing: readonly ('land' | 'house')[];

  constructor(missing: readonly ('land' | 'house')[]) {
    super(`Estimate requires land and house configuration — missing: ${missing.join(', ')}`);
    this.name = 'IncompleteConfigError';
    this.missing = missing;
  }
}

function roundUzs(value: number): number {
  return Math.round(value / ROUNDING_UZS) * ROUNDING_UZS;
}

/** Areas are presented with 2 decimals; also removes float noise from side products. */
function roundArea(value: number): number {
  return Math.round(value * 100) / 100;
}

function toFeatureLines(
  config: ProjectConfiguration,
  landAreaM2: number,
  rules: EstimateRules,
): EstimateFeatureLine[] {
  const enabled = config.features ?? {};
  const lines: EstimateFeatureLine[] = [];
  for (const key of FEATURE_KEYS) {
    if (enabled[key] !== true) {
      continue;
    }
    if (key === 'garden') {
      // The garden follows the plot, not the house: priced per sotix of land.
      const amount = rules.features.garden * (landAreaM2 / SOTIX_IN_M2);
      lines.push({
        key,
        amount: roundUzs(amount),
        meta: { landAreaM2, per100M2: rules.features.garden },
      });
      continue;
    }
    lines.push({ key, amount: roundUzs(rules.features[key]) });
  }
  return lines;
}

/**
 * Deterministic, rule-based cost estimate (docs/estimate.md §Calculation). Pure:
 * identical inputs always produce identical output, and no price is ever invented
 * here — every number comes from `rules`.
 *
 * Every line is rounded to 1000 UZS and each downstream figure is derived from the
 * *rounded* lines, so the breakdown the user sees always adds up to the total.
 *
 * @throws IncompleteConfigError when land or house configuration is missing.
 */
export function calculateEstimate(
  config: ProjectConfiguration,
  rules: EstimateRules,
  finishLevel: FinishLevel,
): EstimateResult {
  const { land, house } = config;
  if (!land || !house) {
    const missing: ('land' | 'house')[] = [];
    if (!land) {
      missing.push('land');
    }
    if (!house) {
      missing.push('house');
    }
    throw new IncompleteConfigError(missing);
  }

  const footprintM2 = roundArea(house.widthM * house.lengthM);
  const grossFloorAreaM2 = roundArea(footprintM2 * house.floorCount);

  let structureRaw = 0;
  for (let floor = 0; floor < house.floorCount; floor++) {
    // Floors above the ground one carry the extra cost of building on top.
    const factor = floor === 0 ? 1 : rules.extraFloorFactor;
    structureRaw += footprintM2 * rules.structureCostPerM2 * factor;
  }
  const structure = roundUzs(structureRaw);
  const finish = roundUzs(grossFloorAreaM2 * rules.finishCostPerM2[finishLevel]);

  const featureLines = toFeatureLines(config, land.areaM2, rules);
  const features = featureLines.reduce((sum, line) => sum + line.amount, 0);

  // Labor is a presentation split of what is already inside structure + finish;
  // it is never added to the total. Materials take the remainder so both halves
  // always sum back to the priced work.
  const materialsAndWorks = structure + finish;
  const labor = roundUzs(materialsAndWorks * rules.laborShare);
  const materials = materialsAndWorks - labor;

  const contingency = roundUzs((materialsAndWorks + features) * rules.contingencyShare);
  const total = structure + finish + features + contingency;

  const lines: EstimateLine[] = [
    {
      key: 'structure',
      amount: structure,
      meta: {
        footprintM2,
        floorCount: house.floorCount,
        costPerM2: rules.structureCostPerM2,
        extraFloorFactor: rules.extraFloorFactor,
      },
    },
    {
      key: 'finish',
      amount: finish,
      meta: { finishLevel, costPerM2: rules.finishCostPerM2[finishLevel] },
    },
    { key: 'features', amount: features, meta: { count: featureLines.length } },
    {
      key: 'labor-info',
      amount: labor,
      meta: { share: rules.laborShare, materialsAmount: materials },
    },
    { key: 'contingency', amount: contingency, meta: { share: rules.contingencyShare } },
  ];

  return {
    lines,
    featureLines,
    total,
    rangeMin: roundUzs(total * (1 - rules.rangeShare)),
    rangeMax: roundUzs(total * (1 + rules.rangeShare)),
    costPerM2: roundUzs(total / grossFloorAreaM2),
    grossFloorAreaM2,
    finishLevel,
    rulesVersion: rules.version,
    currency: rules.currency,
  };
}
