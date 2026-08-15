/**
 * Layout strategies (§27–§29): optimization *policies*, not separate engines.
 * A strategy only re-weights the shared scoring components — generation and
 * validation are identical for every strategy, so a strategy can never make an
 * invalid layout valid (§32). Selection precedence (§30): explicit user choice
 * > AI-suggested > BALANCED.
 */

export const LAYOUT_STRATEGIES = ['BALANCED', 'COMPACT', 'OPEN', 'PRIVACY', 'FAMILY'] as const;
export type LayoutStrategy = (typeof LAYOUT_STRATEGIES)[number];

export interface LayoutWeights {
  roomArea: number;
  shapeQuality: number;
  adjacency: number;
  efficiency: number;
  daylight: number;
  floorPreference: number;
  zoneGrouping: number;
}

export interface LayoutStrategyConfig {
  id: LayoutStrategy;
  /** Sums to 1 (tested), so totals stay a true 0..100 scale across strategies. */
  weights: LayoutWeights;
}

export const STRATEGY_CONFIGS: Record<LayoutStrategy, LayoutStrategyConfig> = {
  /** Even residential quality — the default. */
  BALANCED: {
    id: 'BALANCED',
    weights: {
      roomArea: 0.22,
      shapeQuality: 0.14,
      adjacency: 0.2,
      efficiency: 0.12,
      daylight: 0.08,
      floorPreference: 0.12,
      zoneGrouping: 0.12,
    },
  },
  /** Squeeze waste: efficiency and honest room shapes dominate. */
  COMPACT: {
    id: 'COMPACT',
    weights: {
      roomArea: 0.18,
      shapeQuality: 0.18,
      adjacency: 0.14,
      efficiency: 0.28,
      daylight: 0.06,
      floorPreference: 0.08,
      zoneGrouping: 0.08,
    },
  },
  /** Connected common areas: adjacency and daylight lead. */
  OPEN: {
    id: 'OPEN',
    weights: {
      roomArea: 0.16,
      shapeQuality: 0.12,
      adjacency: 0.3,
      efficiency: 0.08,
      daylight: 0.14,
      floorPreference: 0.08,
      zoneGrouping: 0.12,
    },
  },
  /** Private rooms kept away from the public hub: zoning and floors lead. */
  PRIVACY: {
    id: 'PRIVACY',
    weights: {
      roomArea: 0.16,
      shapeQuality: 0.1,
      adjacency: 0.16,
      efficiency: 0.08,
      daylight: 0.08,
      floorPreference: 0.2,
      zoneGrouping: 0.22,
    },
  },
  /** Family daily flow: strong social adjacency plus sensible floor split. */
  FAMILY: {
    id: 'FAMILY',
    weights: {
      roomArea: 0.2,
      shapeQuality: 0.12,
      adjacency: 0.24,
      efficiency: 0.08,
      daylight: 0.08,
      floorPreference: 0.16,
      zoneGrouping: 0.12,
    },
  },
};

/** Explicit choice > AI suggestion > BALANCED (§30). */
export function resolveStrategy(
  explicit: string | null | undefined,
  suggested?: string | null,
): LayoutStrategy {
  const pick = (value: string | null | undefined): LayoutStrategy | null =>
    (LAYOUT_STRATEGIES as readonly string[]).includes(value ?? '')
      ? (value as LayoutStrategy)
      : null;
  return pick(explicit) ?? pick(suggested) ?? 'BALANCED';
}
