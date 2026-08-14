import { describe, expect, it } from 'vitest';
import { CORRIDOR_WIDTH_M, MIN_ROOM_SIDE_M, STAIR_DEPTH_M, STAIR_WIDTH_M } from '../constants';
import { generateFloorPlan } from '../generate-floor-plan';
import { assertValidPlan } from './plan-invariants';
import {
  MINIMAL_HOUSE,
  OVERSIZED_ROOMS,
  ROOMLESS_UPPER_FLOOR,
  SEED_CONFIG,
  STRESS_40_ROOMS,
  THREE_FLOOR_GROUND_ONLY,
  VARIED_CONFIGS,
  planOf,
} from './fixtures';

describe('scenario (a) seed-style project — 11×13 m, 2 floors, 8 mixed rooms', () => {
  const plan = planOf(SEED_CONFIG);

  it('produces valid geometry for both floors', () => {
    assertValidPlan(plan);
  });

  it('places every configured room and keeps labels and declared areas', () => {
    const rooms = plan.floors.flatMap((floor) => floor.rooms);
    expect(rooms).toHaveLength(8);
    expect(plan.floors[0]?.rooms).toHaveLength(5);
    expect(plan.floors[1]?.rooms).toHaveLength(3);

    const living = rooms.find((r) => r.type === 'LIVING_ROOM');
    expect(living?.label).toBe('Mehmonxona');
    expect(living?.requestedAreaM2).toBe(30);

    const undeclared = rooms.filter((r) => r.requestedAreaM2 === null);
    expect(undeclared).toHaveLength(0);
  });

  it('gives the 5-room ground floor a corridor and the 3-room upper floor none', () => {
    expect(plan.floors[0]?.corridor?.height).toBeCloseTo(CORRIDOR_WIDTH_M, 6);
    expect(plan.floors[0]?.corridor?.width).toBeCloseTo(plan.floors[0]?.outline.width ?? 0, 6);
    expect(plan.floors[1]?.corridor).toBeNull();
  });

  it('repeats the stair core at the top-right of every floor', () => {
    const ground = plan.floors[0]?.stairs;
    const upper = plan.floors[1]?.stairs;
    expect(ground?.rect.width).toBeCloseTo(STAIR_WIDTH_M, 6);
    expect(ground?.rect.height).toBeCloseTo(STAIR_DEPTH_M, 6);
    expect(ground?.rect.y).toBeCloseTo(plan.floors[0]?.outline.y ?? 0, 6);
    expect(ground?.rect.x).toBeCloseTo(
      (plan.floors[0]?.outline.x ?? 0) + (plan.floors[0]?.outline.width ?? 0) - STAIR_WIDTH_M,
      6,
    );
    expect(upper?.rect).toEqual(ground?.rect);
    expect(ground?.direction).toBe('up');
    expect(upper?.direction).toBe('down');
  });
});

describe('scenario (b) roomless floor 1 of a 2-floor house', () => {
  const plan = planOf(ROOMLESS_UPPER_FLOOR);

  it('produces valid geometry', () => {
    assertValidPlan(plan);
  });

  it('emits an empty upper floor that still carries the stair core', () => {
    const upper = plan.floors[1];
    expect(upper?.rooms).toEqual([]);
    expect(upper?.doors).toEqual([]);
    expect(upper?.windows).toEqual([]);
    expect(upper?.corridor).toBeNull();
    expect(upper?.stairs?.rect).toEqual(plan.floors[0]?.stairs?.rect);
    expect(upper?.walls.filter((wall) => wall.kind === 'exterior')).toHaveLength(4);
  });

  it('lays out the ground floor normally', () => {
    expect(plan.floors[0]?.rooms).toHaveLength(4);
    expect(plan.floors[0]?.corridor).not.toBeNull();
  });
});

describe('scenario (c) single room in the minimal 4×4 house', () => {
  const plan = planOf(MINIMAL_HOUSE);

  it('produces valid geometry', () => {
    assertValidPlan(plan);
  });

  it('fills the usable outline with the single room and no stairs or corridor', () => {
    const floor = plan.floors[0];
    expect(plan.floors).toHaveLength(1);
    expect(floor?.stairs).toBeNull();
    expect(floor?.corridor).toBeNull();
    expect(floor?.rooms).toHaveLength(1);
    expect(floor?.rooms[0]?.rect).toEqual(floor?.outline);
    expect(floor?.rooms[0]?.requestedAreaM2).toBeNull();
  });

  it('still gets an exterior entry door and a window', () => {
    const floor = plan.floors[0];
    const exteriorWallIds = new Set(
      floor?.walls.filter((wall) => wall.kind === 'exterior').map((wall) => wall.id),
    );
    expect(floor?.doors.filter((door) => exteriorWallIds.has(door.wallId)).length).toBe(1);
    expect(floor?.windows).toHaveLength(1);
  });
});

describe('scenario (d) 3-floor house with rooms only on the ground floor', () => {
  const plan = planOf(THREE_FLOOR_GROUND_ONLY);

  it('produces valid geometry', () => {
    assertValidPlan(plan);
  });

  it('keeps the same stair core on all three floors with matching directions', () => {
    expect(plan.floors).toHaveLength(3);
    const reference = plan.floors[0]?.stairs?.rect;
    expect(reference).toBeDefined();
    for (const floor of plan.floors) expect(floor.stairs?.rect).toEqual(reference);
    expect(plan.floors.map((floor) => floor.stairs?.direction)).toEqual(['up', 'both', 'down']);
  });

  it('leaves the upper floors empty', () => {
    expect(plan.floors[0]?.rooms).toHaveLength(5);
    expect(plan.floors[1]?.rooms).toEqual([]);
    expect(plan.floors[2]?.rooms).toEqual([]);
  });
});

describe('scenario (e) 40 rooms on one floor of a large house', () => {
  it('either lays all 40 rooms out validly or fails with TOO_MANY_ROOMS_PER_FLOOR', () => {
    const result = generateFloorPlan(STRESS_40_ROOMS);
    if (result.ok) {
      assertValidPlan(result.plan);
      expect(result.plan.floors[0]?.rooms).toHaveLength(40);
      expect(result.plan.floors[0]?.corridor).not.toBeNull();
      for (const room of result.plan.floors[0]?.rooms ?? []) {
        expect(room.rect.width).toBeGreaterThanOrEqual(MIN_ROOM_SIDE_M - 0.005);
        expect(room.rect.height).toBeGreaterThanOrEqual(MIN_ROOM_SIDE_M - 0.005);
      }
    } else {
      expect(result.issues.map((issue) => issue.code)).toContain('TOO_MANY_ROOMS_PER_FLOOR');
    }
  });

  it('never emits overlapping geometry when the floor is over-subscribed', () => {
    const tooMany = generateFloorPlan({
      house: { widthM: 6, lengthM: 6, floorCount: 1 },
      rooms: Array.from({ length: 40 }, () => ({ type: 'STORAGE' as const, floor: 0 })),
    });
    expect(tooMany.ok).toBe(false);
    if (!tooMany.ok) {
      expect(tooMany.issues.map((issue) => issue.code)).toContain('TOO_MANY_ROOMS_PER_FLOOR');
    }
  });
});

describe('scenario (f) declared room dimensions larger than the house', () => {
  const plan = planOf(OVERSIZED_ROOMS);

  it('produces valid geometry', () => {
    assertValidPlan(plan);
  });

  it('scales every target by one factor so declared proportions survive', () => {
    const floor = plan.floors[0];
    const rooms = floor?.rooms ?? [];
    expect(rooms).toHaveLength(3);
    expect(rooms.map((r) => r.requestedAreaM2)).toEqual([300, 168, 90]);

    const outlineArea = (floor?.outline.width ?? 0) * (floor?.outline.height ?? 0);
    const placed = rooms.reduce((sum, r) => sum + r.rect.width * r.rect.height, 0);
    expect(placed).toBeCloseTo(outlineArea, 6);

    const requestedRatio = 300 / 168;
    const placedRatio =
      ((rooms[0]?.rect.width ?? 0) * (rooms[0]?.rect.height ?? 0)) /
      ((rooms[1]?.rect.width ?? 1) * (rooms[1]?.rect.height ?? 1));
    expect(placedRatio).toBeCloseTo(requestedRatio, 1);

    for (const room of rooms) {
      expect(room.rect.width).toBeGreaterThanOrEqual(MIN_ROOM_SIDE_M - 0.005);
      expect(room.areaM2).toBeLessThan(room.requestedAreaM2 ?? Number.POSITIVE_INFINITY);
    }
  });
});

describe('scenario (g) determinism across varied configurations', () => {
  it('returns deep-equal plans on a second run for 5 varied configs', () => {
    expect(VARIED_CONFIGS).toHaveLength(5);
    for (const config of VARIED_CONFIGS) {
      const first = generateFloorPlan(config);
      const second = generateFloorPlan(config);
      expect(first.ok).toBe(true);
      expect(second).toEqual(first);
      expect(JSON.parse(JSON.stringify(second))).toEqual(JSON.parse(JSON.stringify(first)));
    }
  });

  it('round-trips through JSON unchanged (the API persists geometry as JSONB)', () => {
    for (const config of VARIED_CONFIGS) {
      const plan = planOf(config);
      expect(JSON.parse(JSON.stringify(plan))).toEqual(plan);
    }
  });
});
