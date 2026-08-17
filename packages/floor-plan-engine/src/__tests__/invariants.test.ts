import { describe, expect, it } from 'vitest';
import { generateFloorPlan } from '../generate-floor-plan';
import type { FloorPlanInput } from '../types';
import {
  allowedUncoveredArea,
  assertAreaBalance,
  assertDoorCoverage,
  assertInsideOutline,
  assertNoOverlaps,
  assertOpeningsOnWalls,
  assertValidPlan,
} from './plan-invariants';
import {
  MINIMAL_HOUSE,
  OVERSIZED_ROOMS,
  ROOMLESS_UPPER_FLOOR,
  SEED_CONFIG,
  STRESS_40_ROOMS,
  THREE_FLOOR_GROUND_ONLY,
  input,
  planOf,
  room,
} from './fixtures';

const ALL_CONFIGS: { name: string; config: FloorPlanInput }[] = [
  { name: 'seed-style 11×13 / 2 floors / 8 rooms', config: SEED_CONFIG },
  { name: 'roomless upper floor', config: ROOMLESS_UPPER_FLOOR },
  { name: 'minimal 4×4 house', config: MINIMAL_HOUSE },
  { name: '3 floors, rooms on the ground floor only', config: THREE_FLOOR_GROUND_ONLY },
  { name: '40 rooms on one floor', config: STRESS_40_ROOMS },
  { name: 'oversized declared rooms', config: OVERSIZED_ROOMS },
];

describe('spec invariants', () => {
  it('invariant 1: determinism — two runs on the same input are deep-equal', () => {
    for (const { name, config } of ALL_CONFIGS) {
      const first = generateFloorPlan(config);
      const second = generateFloorPlan(config);
      expect(second, name).toEqual(first);
      expect(JSON.stringify(second), name).toBe(JSON.stringify(first));
    }
  });

  it('invariant 2: every room, corridor and stair rect stays inside the floor outline', () => {
    for (const { name, config } of ALL_CONFIGS) {
      const plan = planOf(config);
      for (const floor of plan.floors) {
        expect(floor.outline, name).toBeDefined();
        assertInsideOutline(floor);
      }
    }
  });

  it('invariant 3: no room overlaps another room, the corridor or the stairs', () => {
    for (const { config } of ALL_CONFIGS) {
      const plan = planOf(config);
      for (const floor of plan.floors) assertNoOverlaps(floor);
    }
  });

  it('invariant 4: rooms + corridor + stairs + stair landing fill the floor outline (±0.5 m²)', () => {
    for (const { config } of ALL_CONFIGS) {
      const plan = planOf(config);
      for (const floor of plan.floors) assertAreaBalance(floor);
    }

    // Exact fill on a floor that has enough rooms for every band. The strip
    // beside the stair core is circulation, not a room: it is 1.5 m deep, so a
    // room placed there came out as a slab. It carries no geometry of its own,
    // which is why it is added back here rather than read off the floor.
    const floor = planOf(SEED_CONFIG).floors[0];
    expect(floor).toBeDefined();
    if (!floor) return;
    const outlineArea = floor.outline.width * floor.outline.height;
    const covered =
      floor.rooms.reduce((sum, r) => sum + r.rect.width * r.rect.height, 0) +
      (floor.corridor ? floor.corridor.width * floor.corridor.height : 0) +
      (floor.stairs ? floor.stairs.rect.width * floor.stairs.rect.height : 0) +
      allowedUncoveredArea(floor);
    expect(covered).toBeCloseTo(outlineArea, 6);
  });

  it('invariant 5: door/window centres lie on their wall, windows stay in the run and clear doors', () => {
    for (const { config } of ALL_CONFIGS) {
      const plan = planOf(config);
      for (const floor of plan.floors) assertOpeningsOnWalls(floor);
    }
  });

  it('invariant 6: every room has a door, floor 0 has an exterior door, stairs repeat per floor', () => {
    for (const { config } of ALL_CONFIGS) {
      const plan = planOf(config);
      for (const floor of plan.floors) assertDoorCoverage(floor);

      if (plan.house.floorCount > 1) {
        const reference = plan.floors[0]?.stairs?.rect;
        expect(reference).toBeDefined();
        for (const floor of plan.floors) expect(floor.stairs?.rect).toEqual(reference);
      }
    }
  });

  it('invariant 7: room keys are unique and stable across runs', () => {
    for (const { name, config } of ALL_CONFIGS) {
      const first = planOf(config);
      const second = planOf(config);
      const keysOf = (plan: typeof first): string[] =>
        plan.floors.flatMap((floor) => floor.rooms.map((r) => r.key));
      const keys = keysOf(first);
      expect(new Set(keys).size, `${name}: keys must be unique`).toBe(keys.length);
      expect(keysOf(second), `${name}: keys must be stable`).toEqual(keys);
    }

    // Generated keys follow `f{floor}-{TYPE}-{ordinal}`; caller ids win verbatim.
    const plan = planOf(
      input(12, 12, 1, [
        room('BEDROOM', 0),
        room('BEDROOM', 0),
        room('KITCHEN', 0, undefined, undefined, { id: 'room-abc' }),
        room('BATHROOM', 0),
      ]),
    );
    expect(plan.floors[0]?.rooms.map((r) => r.key)).toEqual([
      'f0-BEDROOM-1',
      'f0-BEDROOM-2',
      'room-abc',
      'f0-BATHROOM-1',
    ]);

    // Duplicate caller ids still produce unique keys.
    const deduped = planOf(
      input(12, 12, 1, [
        room('BEDROOM', 0, undefined, undefined, { id: 'dup' }),
        room('BEDROOM', 0, undefined, undefined, { id: 'dup' }),
      ]),
    );
    const dedupedKeys = deduped.floors[0]?.rooms.map((r) => r.key) ?? [];
    expect(new Set(dedupedKeys).size).toBe(dedupedKeys.length);
  });

  it('invariant 8: degenerate inputs never throw and never emit invalid geometry', () => {
    const degenerate: FloorPlanInput[] = [
      MINIMAL_HOUSE,
      STRESS_40_ROOMS,
      THREE_FLOOR_GROUND_ONLY,
      OVERSIZED_ROOMS,
      input(4, 4, 1, []),
      input(4, 4, 3, [room('BEDROOM', 0), room('BEDROOM', 1), room('BEDROOM', 2)]),
      input(4, 60, 3, [room('BEDROOM', 0, 30, 30), room('OFFICE', 2)]),
      input(60, 4, 2, [room('BEDROOM', 0), room('BEDROOM', 0), room('OFFICE', 1)]),
      input(
        60,
        60,
        3,
        Array.from({ length: 40 }, () => room('BEDROOM', 2, 30, 30)),
      ),
      input(5, 5, 1, [
        room('BEDROOM', 0),
        room('BATHROOM', 0),
        room('KITCHEN', 0),
        room('STORAGE', 0),
      ]),
      input(
        4.5,
        4.5,
        1,
        Array.from({ length: 12 }, () => room('STORAGE', 0)),
      ),
      input(11, 13, 2, [room('BEDROOM', 5)]),
      input(11, 13, 1, [room('BEDROOM', 0, 0, 0)]),
      { house: { widthM: Number.NaN, lengthM: 10, floorCount: 1 }, rooms: [] },
      { house: { widthM: 10, lengthM: 10, floorCount: 0 }, rooms: [] },
    ];

    for (const config of degenerate) {
      const result = generateFloorPlan(config);
      expect(() => generateFloorPlan(config)).not.toThrow();
      if (result.ok) {
        assertValidPlan(result.plan);
      } else {
        expect(result.issues.length).toBeGreaterThan(0);
        for (const issue of result.issues) {
          expect(typeof issue.code).toBe('string');
          expect(issue.code).not.toBe('INTERNAL_ERROR');
          expect(typeof issue.message).toBe('string');
        }
      }
    }
  });
});
