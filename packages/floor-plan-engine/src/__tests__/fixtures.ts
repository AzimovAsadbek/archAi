import { expect } from 'vitest';
import type { RoomType } from '@archai/shared';
import { generateFloorPlan } from '../generate-floor-plan';
import type { FloorPlan, FloorPlanInput, RoomSpec } from '../types';

export function room(
  type: RoomType,
  floor: number,
  widthM?: number,
  lengthM?: number,
  extra: Partial<RoomSpec> = {},
): RoomSpec {
  return {
    type,
    floor,
    widthM: widthM ?? null,
    lengthM: lengthM ?? null,
    ...extra,
  };
}

export function input(
  widthM: number,
  lengthM: number,
  floorCount: number,
  rooms: RoomSpec[],
): FloorPlanInput {
  return { house: { widthM, lengthM, floorCount }, rooms };
}

/** Generates and asserts success — returns the plan for further assertions. */
export function planOf(config: FloorPlanInput): FloorPlan {
  const result = generateFloorPlan(config);
  if (!result.ok) {
    throw new Error(
      `expected a plan, got issues: ${result.issues.map((issue) => `${issue.code}: ${issue.message}`).join('; ')}`,
    );
  }
  expect(result.ok).toBe(true);
  return result.plan;
}

// ── Scenario configurations ───────────────────────────────────────────────

/** (a) Seed-style project: 11×13 m, 2 floors, 8 mixed rooms with declared dims. */
export const SEED_CONFIG: FloorPlanInput = input(11, 13, 2, [
  room('LIVING_ROOM', 0, 6, 5, { label: 'Mehmonxona' }),
  room('KITCHEN', 0, 4, 3.5),
  room('DINING_ROOM', 0, 4, 3),
  room('BATHROOM', 0, 2.5, 2),
  room('HALLWAY', 0, 3, 2),
  room('BEDROOM', 1, 4, 4, { label: 'Yotoqxona 1' }),
  room('BEDROOM', 1, 3.5, 4),
  room('BATHROOM', 1, 2.5, 2),
]);

/** (b) Two-floor house whose first floor (index 1) has no rooms at all. */
export const ROOMLESS_UPPER_FLOOR: FloorPlanInput = input(10, 12, 2, [
  room('LIVING_ROOM', 0, 5, 4),
  room('KITCHEN', 0, 3.5, 3),
  room('BATHROOM', 0, 2, 2),
  room('BEDROOM', 0, 4, 3.5),
]);

/** (c) Smallest allowed footprint with a single room. */
export const MINIMAL_HOUSE: FloorPlanInput = input(4, 4, 1, [room('BEDROOM', 0)]);

/** (d) Three floors, every room on the ground floor. */
export const THREE_FLOOR_GROUND_ONLY: FloorPlanInput = input(14, 12, 3, [
  room('LIVING_ROOM', 0, 6, 5),
  room('KITCHEN', 0, 4, 3),
  room('BATHROOM', 0, 2.5, 2),
  room('BEDROOM', 0, 4, 4),
  room('OFFICE', 0, 3, 3),
]);

const STRESS_TYPES: RoomType[] = [
  'BEDROOM',
  'BATHROOM',
  'OFFICE',
  'STORAGE',
  'LIVING_ROOM',
  'KITCHEN',
  'LAUNDRY',
  'DINING_ROOM',
  'HALLWAY',
  'OTHER',
];

/** (e) 40 rooms on a single floor of a large house. */
export const STRESS_40_ROOMS: FloorPlanInput = input(
  60,
  40,
  1,
  Array.from({ length: 40 }, (_, index) =>
    room(STRESS_TYPES[index % STRESS_TYPES.length] ?? 'OTHER', 0),
  ),
);

/** (f) Declared room dimensions far larger than the house footprint. */
export const OVERSIZED_ROOMS: FloorPlanInput = input(12, 10, 1, [
  room('LIVING_ROOM', 0, 20, 15),
  room('BEDROOM', 0, 14, 12),
  room('KITCHEN', 0, 10, 9),
]);

/** (g) Five varied configurations used by the determinism checks. */
export const VARIED_CONFIGS: FloorPlanInput[] = [
  SEED_CONFIG,
  ROOMLESS_UPPER_FLOOR,
  MINIMAL_HOUSE,
  THREE_FLOOR_GROUND_ONLY,
  OVERSIZED_ROOMS,
];
