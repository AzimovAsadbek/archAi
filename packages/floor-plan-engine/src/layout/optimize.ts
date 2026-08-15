import { generateFloorPlan } from '../generate-floor-plan';
import type { EngineIssue, FloorPlan, FloorPlanInput, FloorPlanResult, RoomSpec } from '../types';
import { mulberry32, shuffle } from './rng';
import { scoreFloorPlan, type LayoutScore } from './score';

/**
 * Candidate-based layout optimization (§19–§23), built on the audited fact that
 * `layoutFloor` places rooms in input order: permuting the room order walks the
 * space of band layouts through the exact same fuzz-hardened generation path.
 * Deterministic (seeded), bounded (maxCandidates), explainable (LayoutScore),
 * and hard constraints stay exactly where they were — a candidate that fails
 * generation is simply not a candidate (§14: scoring never compensates).
 */
export interface LayoutGenerationOptions {
  /** Same input + seed + engine version ⇒ identical best plan (§22). */
  seed?: number;
  /** Upper bound on generated candidates, identity ordering included (§23). */
  maxCandidates?: number;
}

export type BestFloorPlanResult =
  | { ok: true; plan: FloorPlan; score: LayoutScore; candidatesTried: number }
  | { ok: false; issues: EngineIssue[] };

const DEFAULT_SEED = 1;
const DEFAULT_MAX_CANDIDATES = 16;

/** Stable signature of an ordering, for dedup across shuffles. */
function signature(rooms: readonly RoomSpec[]): string {
  return rooms.map((room) => `${room.floor}|${room.type}|${room.id ?? ''}`).join(';');
}

/**
 * Generates up to `maxCandidates` room orderings, runs each through the
 * deterministic engine, scores the valid results and returns the best plan with
 * its score. Ties keep the earliest candidate, so the identity ordering wins
 * unless a permutation is strictly better — output stays stable release to
 * release. With no valid candidate the identity ordering's issues are returned.
 */
export function generateBestFloorPlan(
  input: FloorPlanInput,
  options: LayoutGenerationOptions = {},
): BestFloorPlanResult {
  const seed = options.seed ?? DEFAULT_SEED;
  const maxCandidates = Math.max(1, options.maxCandidates ?? DEFAULT_MAX_CANDIDATES);
  const baseRooms = Array.isArray(input.rooms) ? input.rooms : [];

  const rng = mulberry32(seed);
  const seen = new Set<string>();
  const orderings: RoomSpec[][] = [];

  // Candidate 1 is always the identity ordering (today's behaviour).
  orderings.push([...baseRooms]);
  seen.add(signature(baseRooms));

  // Bounded attempts: tiny room counts run out of distinct permutations fast.
  let attempts = 0;
  while (orderings.length < maxCandidates && attempts < maxCandidates * 4) {
    attempts += 1;
    const candidate = shuffle([...baseRooms], rng);
    const key = signature(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    orderings.push(candidate);
  }

  let best: { plan: FloorPlan; score: LayoutScore } | null = null;
  let identityFailure: Extract<FloorPlanResult, { ok: false }> | null = null;

  for (const [index, rooms] of orderings.entries()) {
    const result = generateFloorPlan({ house: input.house, rooms });
    if (!result.ok) {
      if (index === 0) identityFailure = result;
      continue;
    }
    const score = scoreFloorPlan(result.plan);
    if (best === null || score.total > best.score.total) {
      best = { plan: result.plan, score };
    }
  }

  if (best === null) {
    // No ordering produced a valid plan — surface the identity ordering's
    // issues (they name the real bottleneck: footprint, room count, …).
    return (
      identityFailure ?? {
        ok: false,
        issues: [
          {
            code: 'INTERNAL_ERROR',
            message: 'No candidate ordering produced a valid plan',
          },
        ],
      }
    );
  }

  return { ok: true, plan: best.plan, score: best.score, candidatesTried: orderings.length };
}
