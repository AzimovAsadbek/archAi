import { describe, expect, it } from 'vitest';
import {
  CORRIDOR_WIDTH_M,
  DOOR_WIDTH_NARROW_M,
  FLOOR_PLAN_ENGINE_VERSION,
  WINDOW_MAX_LENGTH_M,
  WINDOW_MIN_LENGTH_M,
} from '../constants';
import { generateFloorPlan } from '../generate-floor-plan';
import {
  intersectionArea,
  pointOnSegment,
  rectContains,
  round1,
  sharedEdge,
  snap,
  subtractIntervals,
} from '../geometry';
import { assertValidPlan } from './plan-invariants';
import { input, planOf, room } from './fixtures';

describe('geometry helpers', () => {
  it('snaps to the 0.01 grid without float artefacts', () => {
    expect(snap(2.675)).toBe(2.68);
    expect(snap(1.005)).toBe(1.01);
    expect(snap(0.1 + 0.2)).toBe(0.3);
    expect(snap(-0.001)).toBe(0);
    expect(snap(Number.NaN)).toBe(0);
    expect(round1(11.44)).toBe(11.4);
    expect(round1(0.05)).toBe(0.1);
  });

  it('measures intersections and containment with the 0.005 epsilon', () => {
    const a = { x: 0, y: 0, width: 2, height: 2 };
    const b = { x: 2, y: 0, width: 2, height: 2 };
    expect(intersectionArea(a, b)).toBe(0);
    expect(intersectionArea(a, { x: 1, y: 1, width: 2, height: 2 })).toBeCloseTo(1, 9);
    expect(rectContains({ x: 0, y: 0, width: 4, height: 4 }, a)).toBe(true);
    expect(rectContains(a, { x: -0.004, y: 0, width: 2, height: 2 })).toBe(true);
    expect(rectContains(a, { x: -0.02, y: 0, width: 2, height: 2 })).toBe(false);
  });

  it('finds shared edges but ignores corner contact', () => {
    const a = { x: 0, y: 0, width: 2, height: 2 };
    expect(sharedEdge(a, { x: 2, y: 0, width: 2, height: 2 })?.orientation).toBe('vertical');
    expect(sharedEdge(a, { x: 0, y: 2, width: 2, height: 2 })?.orientation).toBe('horizontal');
    expect(sharedEdge(a, { x: 2, y: 2, width: 2, height: 2 })).toBeNull();
    expect(sharedEdge(a, { x: 5, y: 0, width: 2, height: 2 })).toBeNull();
  });

  it('subtracts blocked spans and tests points on segments', () => {
    expect(subtractIntervals({ from: 0, to: 10 }, [{ from: 4, to: 6 }])).toEqual([
      { from: 0, to: 4 },
      { from: 6, to: 10 },
    ]);
    expect(subtractIntervals({ from: 0, to: 10 }, [])).toEqual([{ from: 0, to: 10 }]);
    const segment = { x1: 0.15, y1: 0.15, x2: 0.15, y2: 5 };
    expect(pointOnSegment({ x: 0.15, y: 2 }, segment)).toBe(true);
    expect(pointOnSegment({ x: 0.5, y: 2 }, segment)).toBe(false);
    expect(pointOnSegment({ x: 0.15, y: 9 }, segment)).toBe(false);
  });
});

describe('engine contract', () => {
  it('stamps the engine version on every plan', () => {
    expect(FLOOR_PLAN_ENGINE_VERSION).toBe('1.3.0');
    expect(planOf(input(10, 10, 1, [room('BEDROOM', 0)])).engineVersion).toBe(
      FLOOR_PLAN_ENGINE_VERSION,
    );
  });

  it('adds a corridor from four rooms upwards, not below', () => {
    const three = planOf(
      input(12, 12, 1, [room('BEDROOM', 0), room('KITCHEN', 0), room('BATHROOM', 0)]),
    );
    expect(three.floors[0]?.corridor).toBeNull();

    const four = planOf(
      input(12, 12, 1, [
        room('BEDROOM', 0),
        room('KITCHEN', 0),
        room('BATHROOM', 0),
        room('OFFICE', 0),
      ]),
    );
    expect(four.floors[0]?.corridor?.height).toBeCloseTo(CORRIDOR_WIDTH_M, 6);
    assertValidPlan(four);
  });

  it('keeps windows off bathrooms, storage, laundry and hallways', () => {
    const plan = planOf(
      input(14, 12, 1, [
        room('BEDROOM', 0, 4, 4),
        room('BATHROOM', 0, 2, 2),
        room('STORAGE', 0, 2, 2),
        room('LAUNDRY', 0, 2, 2),
        room('HALLWAY', 0, 3, 2),
      ]),
    );
    const floor = plan.floors[0];
    const typeByKey = new Map(floor?.rooms.map((r) => [r.key, r.type]));
    for (const window of floor?.windows ?? []) {
      expect(['BEDROOM', 'LIVING_ROOM', 'KITCHEN', 'DINING_ROOM', 'OFFICE', 'OTHER']).toContain(
        typeByKey.get(window.roomKey),
      );
      expect(window.length).toBeGreaterThanOrEqual(WINDOW_MIN_LENGTH_M);
      expect(window.length).toBeLessThanOrEqual(WINDOW_MAX_LENGTH_M);
    }
    expect(floor?.windows.length).toBeGreaterThan(0);
  });

  it('uses the narrow door width for bathrooms and storage', () => {
    const plan = planOf(input(12, 12, 1, [room('BEDROOM', 0, 5, 4), room('BATHROOM', 0, 2, 2)]));
    const floor = plan.floors[0];
    const bathroom = floor?.rooms.find((r) => r.type === 'BATHROOM');
    const bathroomDoors = floor?.doors.filter((door) =>
      door.roomKeys.some((key) => key === bathroom?.key),
    );
    expect(bathroomDoors?.length).toBeGreaterThan(0);
    expect(bathroomDoors?.[0]?.width).toBe(DOOR_WIDTH_NARROW_M);
  });

  it('reports feasibility issues instead of throwing', () => {
    const narrow = generateFloorPlan(
      input(4.5, 12, 2, [room('BEDROOM', 0), room('OFFICE', 0), room('BEDROOM', 1)]),
    );
    expect(narrow.ok).toBe(false);
    if (!narrow.ok) expect(narrow.issues[0]?.code).toBe('FOOTPRINT_TOO_SMALL');

    const wrongFloor = generateFloorPlan(input(10, 10, 1, [room('BEDROOM', 2)]));
    expect(wrongFloor.ok).toBe(false);
    if (!wrongFloor.ok) expect(wrongFloor.issues[0]?.code).toBe('ROOM_ON_MISSING_FLOOR');

    const invalid = generateFloorPlan({
      house: { widthM: -5, lengthM: 10, floorCount: 1 },
      rooms: [],
    });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.issues[0]?.code).toBe('INVALID_INPUT');
  });

  it('lays out a house with no rooms at all', () => {
    const plan = planOf(input(10, 10, 2, []));
    assertValidPlan(plan);
    for (const floor of plan.floors) {
      expect(floor.rooms).toEqual([]);
      expect(floor.doors).toEqual([]);
      expect(floor.stairs).not.toBeNull();
    }
  });
});
