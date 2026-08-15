import { describe, expect, it } from 'vitest';
import { generateFloorPlan } from '../generate-floor-plan';
import { adjacencyScore, rectsAdjacent } from '../layout/adjacency';
import { generateBestFloorPlan } from '../layout/optimize';
import { scoreFloorPlan } from '../layout/score';
import { assertValidPlan } from './plan-invariants';
import type { FloorPlanInput } from '../types';

/** A 2-floor family house with enough rooms for orderings to matter. */
const FAMILY: FloorPlanInput = {
  house: { widthM: 12, lengthM: 10, floorCount: 2 },
  rooms: [
    { type: 'LIVING_ROOM', floor: 0 },
    { type: 'KITCHEN', floor: 0 },
    { type: 'DINING_ROOM', floor: 0 },
    { type: 'BATHROOM', floor: 0 },
    { type: 'BEDROOM', floor: 1, widthM: 4, lengthM: 4 },
    { type: 'BEDROOM', floor: 1 },
    { type: 'BATHROOM', floor: 1 },
  ],
};

describe('rectsAdjacent', () => {
  it('detects shared walls and rejects corners/gaps', () => {
    const a = { x: 0, y: 0, width: 4, height: 4 };
    expect(rectsAdjacent(a, { x: 4, y: 1, width: 3, height: 3 })).toBe(true); // shared edge
    expect(rectsAdjacent(a, { x: 4, y: 3.5, width: 3, height: 3 })).toBe(false); // 0.5 m overlap < door
    expect(rectsAdjacent(a, { x: 5, y: 0, width: 3, height: 3 })).toBe(false); // 1 m gap
    expect(rectsAdjacent(a, { x: 4, y: 4, width: 3, height: 3 })).toBe(false); // corner touch
  });
});

describe('scoreFloorPlan', () => {
  it('returns a normalized, explainable score for a real plan', () => {
    const result = generateFloorPlan(FAMILY);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const score = scoreFloorPlan(result.plan);
    expect(score.total).toBeGreaterThan(0);
    expect(score.total).toBeLessThanOrEqual(100);
    expect(score.components).toHaveLength(5);
    for (const component of score.components) {
      expect(component.score).toBeGreaterThanOrEqual(0);
      expect(component.score).toBeLessThanOrEqual(1);
      expect(component.explanation.length).toBeGreaterThan(0);
    }
    // Weights sum to 1, so the weighted total is a true 0..100 scale.
    expect(score.components.reduce((sum, c) => sum + c.weight, 0)).toBeCloseTo(1, 6);
    // Adjacency is computed against the plan's real geometry.
    expect(adjacencyScore(result.plan.floors[0]?.rooms ?? [])).toBeGreaterThanOrEqual(0);
  });
});

describe('generateBestFloorPlan', () => {
  it('is deterministic: same input + seed => deep-equal plan and score', () => {
    const a = generateBestFloorPlan(FAMILY, { seed: 7 });
    const b = generateBestFloorPlan(FAMILY, { seed: 7 });
    expect(a).toEqual(b);
  });

  it('never scores below the identity ordering and yields a valid plan', () => {
    const identity = generateFloorPlan(FAMILY);
    const best = generateBestFloorPlan(FAMILY, { seed: 1, maxCandidates: 16 });
    expect(identity.ok).toBe(true);
    expect(best.ok).toBe(true);
    if (!identity.ok || !best.ok) return;

    assertValidPlan(best.plan);
    expect(best.candidatesTried).toBeGreaterThanOrEqual(1);
    expect(best.candidatesTried).toBeLessThanOrEqual(16);
    expect(best.score.total).toBeGreaterThanOrEqual(scoreFloorPlan(identity.plan).total);
  });

  it('keeps the room set intact — optimization reorders, never drops (§7)', () => {
    const best = generateBestFloorPlan(FAMILY, { seed: 3 });
    expect(best.ok).toBe(true);
    if (!best.ok) return;
    const placed = best.plan.floors.flatMap((floor) => floor.rooms.map((room) => room.type)).sort();
    const requested = FAMILY.rooms.map((room) => room.type).sort();
    expect(placed).toEqual(requested);
  });

  it('returns the structured failure of an impossible input (§24/§70)', () => {
    const impossible: FloorPlanInput = {
      house: { widthM: 4, lengthM: 4, floorCount: 1 },
      rooms: Array.from({ length: 8 }, () => ({ type: 'BEDROOM' as const, floor: 0 })),
    };
    const result = generateBestFloorPlan(impossible, { seed: 1 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.every((issue) => typeof issue.code === 'string')).toBe(true);
  });

  it('handles a single-room house (no permutations to explore)', () => {
    const tiny: FloorPlanInput = {
      house: { widthM: 8, lengthM: 8, floorCount: 1 },
      rooms: [{ type: 'LIVING_ROOM', floor: 0 }],
    };
    const result = generateBestFloorPlan(tiny, { seed: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.candidatesTried).toBe(1);
  });
});
