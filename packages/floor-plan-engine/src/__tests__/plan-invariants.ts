import { expect } from 'vitest';
import {
  CORRIDOR_WIDTH_M,
  DOOR_WIDTH_M,
  DOOR_WIDTH_NARROW_M,
  EXTERIOR_WALL_M,
  FLOOR_PLAN_ENGINE_VERSION,
  INTERIOR_WALL_M,
  MIN_ROOM_SIDE_M,
  STAIR_DEPTH_M,
  STAIR_WIDTH_M,
  WINDOWLESS_ROOM_TYPES,
  WINDOW_MAX_LENGTH_M,
  WINDOW_MIN_LENGTH_M,
} from '../constants';
import {
  gte,
  intersectionArea,
  lte,
  pointOnSegment,
  rectArea,
  rectContains,
  segmentOrientation,
} from '../geometry';
import type { Interval } from '../geometry';
import type { RoomType } from '@archai/shared';
import type { FloorGeometry, FloorPlan, Rect, Segment } from '../types';

/** Tolerance used by the area invariant (spec §Invariants #4). */
export const AREA_TOLERANCE_M2 = 0.5;

function expectSnapped(value: number, what: string): void {
  expect(Number.isFinite(value), `${what} must be finite (got ${value})`).toBe(true);
  const off = Math.abs(value * 100 - Math.round(value * 100));
  expect(off < 1e-6, `${what} must be snapped to 0.01 m (got ${value})`).toBe(true);
}

function expectRectSnapped(r: Rect, what: string): void {
  expectSnapped(r.x, `${what}.x`);
  expectSnapped(r.y, `${what}.y`);
  expectSnapped(r.width, `${what}.width`);
  expectSnapped(r.height, `${what}.height`);
}

function segmentSpan(segment: Segment): Interval {
  const orientation = segmentOrientation(segment);
  return orientation === 'vertical'
    ? { from: Math.min(segment.y1, segment.y2), to: Math.max(segment.y1, segment.y2) }
    : { from: Math.min(segment.x1, segment.x2), to: Math.max(segment.x1, segment.x2) };
}

function openingSpan(segment: Segment, center: { x: number; y: number }, size: number): Interval {
  const orientation = segmentOrientation(segment);
  const along = orientation === 'vertical' ? center.y : center.x;
  return { from: along - size / 2, to: along + size / 2 };
}

function overlapLength(a: Interval, b: Interval): number {
  return Math.min(a.to, b.to) - Math.max(a.from, b.from);
}

/**
 * A floor whose room count is below the number of layout bands cannot tile the
 * outline: the stair core sits in the top-right corner and a single rectangle
 * cannot cover the resulting L-shape. Such a floor may leave the strip beside
 * the stairs empty — nothing else.
 */
export function allowedUncoveredArea(floor: FloorGeometry): number {
  // The 1.5 m strip beside the stair core is a landing, not a room band: it is
  // deep enough to walk through and too shallow to live in. Rooms are no longer
  // forced into it, so it is legitimately uncovered on every stair floor.
  if (floor.stairs) {
    return (floor.outline.width - floor.stairs.rect.width) * floor.stairs.rect.height;
  }
  return 0;
}

// ── Invariant 2 ───────────────────────────────────────────────────────────
export function assertInsideOutline(floor: FloorGeometry): void {
  const { outline } = floor;
  for (const room of floor.rooms) {
    expect(
      rectContains(outline, room.rect),
      `floor ${floor.index}: room ${room.key} escapes the outline`,
    ).toBe(true);
  }
  if (floor.corridor) {
    expect(
      rectContains(outline, floor.corridor),
      `floor ${floor.index}: corridor escapes the outline`,
    ).toBe(true);
  }
  if (floor.stairs) {
    expect(
      rectContains(outline, floor.stairs.rect),
      `floor ${floor.index}: stairs escape the outline`,
    ).toBe(true);
  }
}

// ── Invariant 3 ───────────────────────────────────────────────────────────
export function assertNoOverlaps(floor: FloorGeometry): void {
  const rooms = floor.rooms;
  for (let i = 0; i < rooms.length; i++) {
    const a = rooms[i];
    if (!a) continue;
    for (let j = i + 1; j < rooms.length; j++) {
      const b = rooms[j];
      if (!b) continue;
      expect(
        intersectionArea(a.rect, b.rect),
        `floor ${floor.index}: ${a.key} overlaps ${b.key}`,
      ).toBeLessThanOrEqual(1e-6);
    }
    if (floor.corridor) {
      expect(
        intersectionArea(a.rect, floor.corridor),
        `floor ${floor.index}: ${a.key} overlaps the corridor`,
      ).toBeLessThanOrEqual(1e-6);
    }
    if (floor.stairs) {
      expect(
        intersectionArea(a.rect, floor.stairs.rect),
        `floor ${floor.index}: ${a.key} overlaps the stairs`,
      ).toBeLessThanOrEqual(1e-6);
    }
  }
  if (floor.corridor && floor.stairs) {
    expect(
      intersectionArea(floor.corridor, floor.stairs.rect),
      `floor ${floor.index}: the corridor overlaps the stairs`,
    ).toBeLessThanOrEqual(1e-6);
  }
}

// ── Invariant 4 ───────────────────────────────────────────────────────────
export function assertAreaBalance(floor: FloorGeometry): void {
  const outlineArea = rectArea(floor.outline);
  const roomArea = floor.rooms.reduce((sum, room) => sum + rectArea(room.rect), 0);
  const corridorArea = floor.corridor ? rectArea(floor.corridor) : 0;
  const stairArea = floor.stairs ? rectArea(floor.stairs.rect) : 0;
  const covered = roomArea + corridorArea + stairArea;

  expect(
    covered,
    `floor ${floor.index}: covered area ${covered} exceeds the outline ${outlineArea}`,
  ).toBeLessThanOrEqual(outlineArea + AREA_TOLERANCE_M2);

  if (floor.rooms.length === 0) return; // an empty floor has nothing to fill it with
  expect(
    covered,
    `floor ${floor.index}: rooms + corridor + stairs (${covered}) do not fill the outline (${outlineArea})`,
  ).toBeGreaterThanOrEqual(outlineArea - AREA_TOLERANCE_M2 - allowedUncoveredArea(floor));
}

// ── Invariant 5 ───────────────────────────────────────────────────────────
export function assertOpeningsOnWalls(floor: FloorGeometry): void {
  const wallById = new Map(floor.walls.map((wall) => [wall.id, wall]));

  for (const door of floor.doors) {
    const wall = wallById.get(door.wallId);
    expect(wall, `floor ${floor.index}: door ${door.id} references unknown wall`).toBeDefined();
    if (!wall) continue;
    expect(
      pointOnSegment(door.center, wall.segment),
      `floor ${floor.index}: door ${door.id} centre is off its wall`,
    ).toBe(true);
    const span = openingSpan(wall.segment, door.center, door.width);
    const run = segmentSpan(wall.segment);
    expect(
      gte(span.from, run.from) && lte(span.to, run.to),
      `floor ${floor.index}: door ${door.id} runs past its wall`,
    ).toBe(true);
    expect([DOOR_WIDTH_M, DOOR_WIDTH_NARROW_M]).toContain(door.width);
  }

  for (const window of floor.windows) {
    const wall = wallById.get(window.wallId);
    expect(wall, `floor ${floor.index}: window ${window.id} references unknown wall`).toBeDefined();
    if (!wall) continue;
    expect(
      pointOnSegment(window.center, wall.segment),
      `floor ${floor.index}: window ${window.id} centre is off its wall`,
    ).toBe(true);
    const span = openingSpan(wall.segment, window.center, window.length);
    const run = segmentSpan(wall.segment);
    expect(
      gte(span.from, run.from) && lte(span.to, run.to),
      `floor ${floor.index}: window ${window.id} runs past its wall`,
    ).toBe(true);
    expect(gte(window.length, WINDOW_MIN_LENGTH_M)).toBe(true);
    expect(lte(window.length, WINDOW_MAX_LENGTH_M)).toBe(true);

    for (const door of floor.doors) {
      if (door.wallId !== window.wallId) continue;
      const doorSpan = openingSpan(wall.segment, door.center, door.width);
      expect(
        overlapLength(span, doorSpan),
        `floor ${floor.index}: window ${window.id} intersects door ${door.id}`,
      ).toBeLessThanOrEqual(1e-6);
    }
  }

  // Windows never sit on the excluded room types.
  const roomTypeByKey = new Map(floor.rooms.map((room) => [room.key, room.type]));
  for (const window of floor.windows) {
    const type = roomTypeByKey.get(window.roomKey);
    expect(type, `floor ${floor.index}: window ${window.id} references unknown room`).toBeDefined();
    expect(
      (WINDOWLESS_ROOM_TYPES as readonly RoomType[]).includes(type as RoomType),
      `floor ${floor.index}: ${String(type)} must not get a window`,
    ).toBe(false);
  }
}

// ── Invariant 6 ───────────────────────────────────────────────────────────
export function assertDoorCoverage(floor: FloorGeometry): void {
  const served = new Set<string>();
  for (const door of floor.doors) {
    served.add(door.roomKeys[0]);
    if (door.roomKeys[1]) served.add(door.roomKeys[1]);
  }
  for (const room of floor.rooms) {
    expect(served.has(room.key), `floor ${floor.index}: room ${room.key} has no door`).toBe(true);
  }

  const roomKeys = new Set(floor.rooms.map((room) => room.key));
  for (const door of floor.doors) {
    expect(roomKeys.has(door.roomKeys[0])).toBe(true);
    if (door.roomKeys[1]) expect(roomKeys.has(door.roomKeys[1])).toBe(true);
  }

  if (floor.index === 0 && floor.rooms.length > 0) {
    const exteriorWallIds = new Set(
      floor.walls.filter((wall) => wall.kind === 'exterior').map((wall) => wall.id),
    );
    const entries = floor.doors.filter((door) => exteriorWallIds.has(door.wallId));
    expect(entries.length, 'floor 0 must have an exterior entry door').toBeGreaterThanOrEqual(1);
  }
}

// ── Structural / numeric hygiene ──────────────────────────────────────────
function assertFloorStructure(floor: FloorGeometry, house: FloorPlan['house']): void {
  expectRectSnapped(floor.outline, `floor ${floor.index} outline`);
  expect(floor.outline.x).toBeCloseTo(EXTERIOR_WALL_M, 6);
  expect(floor.outline.y).toBeCloseTo(EXTERIOR_WALL_M, 6);
  expect(floor.outline.width).toBeCloseTo(house.widthM - 2 * EXTERIOR_WALL_M, 6);
  expect(floor.outline.height).toBeCloseTo(house.lengthM - 2 * EXTERIOR_WALL_M, 6);

  for (const room of floor.rooms) {
    expectRectSnapped(room.rect, `room ${room.key}`);
    expect(
      gte(room.rect.width, MIN_ROOM_SIDE_M) && gte(room.rect.height, MIN_ROOM_SIDE_M),
      `floor ${floor.index}: room ${room.key} is below the ${MIN_ROOM_SIDE_M} m minimum side`,
    ).toBe(true);
    // areaM2 is the placed area rounded to 0.1 m².
    expect(
      Math.abs(room.areaM2 - rectArea(room.rect)),
      `room ${room.key}: areaM2 ${room.areaM2} does not match its rect`,
    ).toBeLessThanOrEqual(0.0501);
    expect(Math.abs(room.areaM2 * 10 - Math.round(room.areaM2 * 10))).toBeLessThan(1e-6);
    if (room.requestedAreaM2 !== null) {
      expect(
        Math.abs(room.requestedAreaM2 * 10 - Math.round(room.requestedAreaM2 * 10)),
      ).toBeLessThan(1e-6);
    }
  }

  if (floor.corridor) {
    expectRectSnapped(floor.corridor, `floor ${floor.index} corridor`);
    // The corridor is a fixed architectural element, not whatever the rooms
    // left over: surplus floor is spread across the rooms instead, so a house
    // far larger than its program cannot produce a 50 m² "corridor".
    expect(floor.corridor.height, `floor ${floor.index}: corridor is not ${CORRIDOR_WIDTH_M} m deep`).toBeCloseTo(
      CORRIDOR_WIDTH_M,
      6,
    );
  }

  if (floor.stairs) {
    expectRectSnapped(floor.stairs.rect, `floor ${floor.index} stairs`);
    expect(floor.stairs.rect.width).toBeCloseTo(STAIR_WIDTH_M, 6);
    expect(floor.stairs.rect.height).toBeCloseTo(STAIR_DEPTH_M, 6);
    expect(['up', 'down', 'both']).toContain(floor.stairs.direction);
  }

  const exteriorWalls = floor.walls.filter((wall) => wall.kind === 'exterior');
  expect(exteriorWalls).toHaveLength(4);
  for (const wall of floor.walls) {
    expectSnapped(wall.segment.x1, `${wall.id}.x1`);
    expectSnapped(wall.segment.y1, `${wall.id}.y1`);
    expectSnapped(wall.segment.x2, `${wall.id}.x2`);
    expectSnapped(wall.segment.y2, `${wall.id}.y2`);
    expect(segmentOrientation(wall.segment), `${wall.id} must be axis-aligned`).not.toBeNull();
    expect(wall.thickness).toBeCloseTo(
      wall.kind === 'exterior' ? EXTERIOR_WALL_M : INTERIOR_WALL_M,
      6,
    );
  }

  const wallIds = floor.walls.map((wall) => wall.id);
  expect(new Set(wallIds).size, `floor ${floor.index}: duplicate wall ids`).toBe(wallIds.length);

  const openingIds = [...floor.doors.map((d) => d.id), ...floor.windows.map((w) => w.id)];
  expect(new Set(openingIds).size, `floor ${floor.index}: duplicate opening ids`).toBe(
    openingIds.length,
  );

  for (const door of floor.doors) {
    expectSnapped(door.center.x, `${door.id}.center.x`);
    expectSnapped(door.center.y, `${door.id}.center.y`);
  }
  for (const window of floor.windows) {
    expectSnapped(window.center.x, `${window.id}.center.x`);
    expectSnapped(window.center.y, `${window.id}.center.y`);
    expectSnapped(window.length, `${window.id}.length`);
  }

  // At most one window per room (spec §8).
  const windowsPerRoom = new Map<string, number>();
  for (const window of floor.windows) {
    windowsPerRoom.set(window.roomKey, (windowsPerRoom.get(window.roomKey) ?? 0) + 1);
  }
  for (const [key, count] of windowsPerRoom) {
    expect(count, `floor ${floor.index}: room ${key} has ${count} windows`).toBeLessThanOrEqual(1);
  }
}

/** Runs every geometric invariant from the spec against a generated plan. */
export function assertValidPlan(plan: FloorPlan): void {
  expect(plan.engineVersion).toBe(FLOOR_PLAN_ENGINE_VERSION);
  expect(plan.floors).toHaveLength(plan.house.floorCount);

  const keys = new Set<string>();
  plan.floors.forEach((floor, index) => {
    expect(floor.index).toBe(index);
    assertFloorStructure(floor, plan.house);
    assertInsideOutline(floor);
    assertNoOverlaps(floor);
    assertAreaBalance(floor);
    assertOpeningsOnWalls(floor);
    assertDoorCoverage(floor);
    for (const room of floor.rooms) {
      expect(keys.has(room.key), `duplicate room key ${room.key}`).toBe(false);
      keys.add(room.key);
    }
  });

  // Invariant 6: every floor of a multi-floor house shares the same stair rect.
  if (plan.house.floorCount > 1) {
    const first = plan.floors[0]?.stairs;
    expect(first, 'multi-floor houses need stairs').toBeDefined();
    for (const floor of plan.floors) {
      expect(floor.stairs, `floor ${floor.index} is missing stairs`).not.toBeNull();
      expect(floor.stairs?.rect).toEqual(first?.rect);
    }
  } else {
    for (const floor of plan.floors) expect(floor.stairs).toBeNull();
  }
}
