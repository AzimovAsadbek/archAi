import type { FloorPlan, PlacedRoom } from '../types';
import { adjacencyScore, rectsAdjacent } from './adjacency';
import { ROOM_PROFILES } from './requirements';
import { STRATEGY_CONFIGS, type LayoutWeights } from './strategies';

/**
 * Deterministic, explainable layout scoring (§17/§18/§45). Every component is
 * normalized to 0..1 before weighting, so no category dominates by unit scale.
 * Hard validity is NOT scored here — invalid plans never reach scoring: the
 * engine's own generation guarantees (and `ok: false` results) are the hard
 * constraint layer (§14); this ranks the already-valid.
 */
export interface LayoutScoreComponent {
  code: keyof LayoutWeights;
  /** 0..1 — normalized quality. */
  score: number;
  weight: number;
  /** Developer-facing; the UI localizes by `code`. */
  explanation: string;
}

export interface LayoutScore {
  /** Weighted 0..100 total. */
  total: number;
  components: LayoutScoreComponent[];
}

/** Default weights = the BALANCED strategy (§28); callers pass others. */
export const LAYOUT_WEIGHTS: LayoutWeights = STRATEGY_CONFIGS.BALANCED.weights;

/** Aspect ratios beyond this read as corridors, not rooms (§37). */
const ASPECT_COMFORT = 1.8;
const ASPECT_LIMIT = 3.2;

/** Usable-area share that reads as efficient without being corridor-free (§36). */
const EFFICIENCY_IDEAL = 0.82;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * Floor-affinity satisfaction (§21): the share of affinity-carrying rooms that
 * landed on a matching floor (GROUND → floor 0, UPPER → any floor above it).
 * Neutral 1 for single-floor houses — there is nothing to satisfy.
 */
function floorPreferenceScore(plan: FloorPlan): number {
  if (plan.house.floorCount <= 1) return 1;
  let matched = 0;
  let applicable = 0;
  for (const floor of plan.floors) {
    for (const room of floor.rooms) {
      const affinity = (ROOM_PROFILES[room.type] ?? ROOM_PROFILES.OTHER).floorAffinity;
      if (affinity === 'ANY') continue;
      applicable += 1;
      if (affinity === 'GROUND' ? floor.index === 0 : floor.index > 0) matched += 1;
    }
  }
  return applicable === 0 ? 1 : matched / applicable;
}

/**
 * Zone grouping (§18): within each floor, rooms of the same semantic zone
 * should cluster — measured as the adjacent share of same-zone room pairs.
 * Neutral 1 when no floor has two rooms of one zone.
 */
function zoneGroupingScore(plan: FloorPlan): number {
  let adjacentPairs = 0;
  let pairs = 0;
  for (const floor of plan.floors) {
    const byZone = new Map<string, PlacedRoom[]>();
    for (const room of floor.rooms) {
      const zone = (ROOM_PROFILES[room.type] ?? ROOM_PROFILES.OTHER).zone;
      byZone.set(zone, [...(byZone.get(zone) ?? []), room]);
    }
    for (const rooms of byZone.values()) {
      for (let i = 0; i < rooms.length; i++) {
        for (let j = i + 1; j < rooms.length; j++) {
          const a = rooms[i];
          const b = rooms[j];
          if (!a || !b) continue;
          pairs += 1;
          if (rectsAdjacent(a.rect, b.rect)) adjacentPairs += 1;
        }
      }
    }
  }
  return pairs === 0 ? 1 : adjacentPairs / pairs;
}

export function scoreFloorPlan(
  plan: FloorPlan,
  weights: LayoutWeights = LAYOUT_WEIGHTS,
): LayoutScore {
  const rooms = plan.floors.flatMap((floor) => floor.rooms);

  // Room area fit: placed vs requested area, when the user declared one (§8).
  let areaScore = 1;
  const requested = rooms.filter((room) => room.requestedAreaM2 !== null);
  if (requested.length > 0) {
    const deviations = requested.map((room) => {
      const target = room.requestedAreaM2 ?? room.areaM2;
      return target > 0 ? Math.abs(room.areaM2 - target) / target : 0;
    });
    areaScore = clamp01(1 - deviations.reduce((sum, d) => sum + d, 0) / deviations.length);
  }

  // Shape quality: penalize slab-like aspect ratios (§37).
  let shapeScore = 1;
  if (rooms.length > 0) {
    const penalties = rooms.map((room) => {
      const long = Math.max(room.rect.width, room.rect.height);
      const short = Math.min(room.rect.width, room.rect.height);
      const aspect = short > 0 ? long / short : ASPECT_LIMIT;
      return clamp01((aspect - ASPECT_COMFORT) / (ASPECT_LIMIT - ASPECT_COMFORT));
    });
    shapeScore = clamp01(1 - penalties.reduce((sum, p) => sum + p, 0) / penalties.length);
  }

  // Adjacency: per floor, weighted by that floor's room count.
  let adjScore = 1;
  if (rooms.length > 0) {
    const weighted = plan.floors.reduce(
      (sum, floor) => sum + adjacencyScore(floor.rooms) * floor.rooms.length,
      0,
    );
    adjScore = clamp01(weighted / rooms.length);
  }

  // Footprint efficiency: room area over usable area, scored against a band —
  // 100% utilisation is NOT ideal, circulation needs its share (§36).
  const usable = plan.floors.reduce(
    (sum, floor) => sum + floor.outline.width * floor.outline.height,
    0,
  );
  const roomArea = rooms.reduce((sum, room) => sum + room.areaM2, 0);
  const utilisation = usable > 0 ? roomArea / usable : 0;
  const efficiencyScore = clamp01(1 - Math.abs(utilisation - EFFICIENCY_IDEAL) / EFFICIENCY_IDEAL);

  // Daylight potential (§33): the share of rooms with at least one window.
  // Explicitly a heuristic proxy, not a solar simulation.
  let daylightScore = 1;
  if (rooms.length > 0) {
    const lit = new Set(plan.floors.flatMap((floor) => floor.windows.map((w) => w.roomKey)));
    daylightScore = clamp01(rooms.filter((room) => lit.has(room.key)).length / rooms.length);
  }

  const components: LayoutScoreComponent[] = [
    {
      code: 'roomArea',
      score: areaScore,
      weight: weights.roomArea,
      explanation:
        requested.length === 0
          ? 'No requested room areas to compare against'
          : `Mean deviation from requested areas across ${requested.length} room(s)`,
    },
    {
      code: 'shapeQuality',
      score: shapeScore,
      weight: weights.shapeQuality,
      explanation: `Aspect-ratio comfort across ${rooms.length} room(s) (penalty beyond ${ASPECT_COMFORT}:1)`,
    },
    {
      code: 'adjacency',
      score: adjScore,
      weight: weights.adjacency,
      explanation: 'Type-preference adjacency satisfaction (kitchen–dining, bedroom–bathroom, …)',
    },
    {
      code: 'efficiency',
      score: efficiencyScore,
      weight: weights.efficiency,
      explanation: `Room area is ${Math.round(utilisation * 100)}% of usable area (ideal ≈ ${Math.round(EFFICIENCY_IDEAL * 100)}%)`,
    },
    {
      code: 'daylight',
      score: daylightScore,
      weight: weights.daylight,
      explanation: 'Share of rooms with a window opportunity (daylight potential, not a simulation)',
    },
    {
      code: 'floorPreference',
      score: floorPreferenceScore(plan),
      weight: weights.floorPreference,
      explanation:
        'Share of rooms on their profile-preferred floor (living/kitchen ground, bedrooms upper)',
    },
    {
      code: 'zoneGrouping',
      score: zoneGroupingScore(plan),
      weight: weights.zoneGrouping,
      explanation: 'Same-zone rooms clustering per floor (public/private/service separation)',
    },
  ];

  const total = components.reduce((sum, c) => sum + c.score * c.weight, 0) * 100;
  return { total: Math.round(total * 10) / 10, components };
}
