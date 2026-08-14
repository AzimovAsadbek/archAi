import type { RoomType } from '@archai/shared';
import {
  DOOR_WIDTH_M,
  DOOR_WIDTH_NARROW_M,
  EXTERIOR_WALL_M,
  NARROW_DOOR_ROOM_TYPES,
  SNAP_M,
  WINDOWLESS_ROOM_TYPES,
  WINDOW_MAX_LENGTH_M,
  WINDOW_MIN_LENGTH_M,
  WINDOW_WALL_RATIO,
} from './constants';
import {
  bottom,
  clamp,
  edgeKey,
  edgeMidpoint,
  eq,
  gte,
  intervalLength,
  intervalsOverlap,
  right,
  sharedEdge,
  snap,
  subtractIntervals,
} from './geometry';
import type { Interval, SharedEdge } from './geometry';
import type { LayoutBand } from './layout';
import type { ExteriorSide, WallLayout } from './walls';
import type { Door, PlacedRoom, Point, Rect, Stair, Window } from './types';

/** Tie-break order when several exterior sides are candidates. */
const SIDE_PRIORITY: readonly ExteriorSide[] = ['south', 'north', 'west', 'east'];

export interface BuildOpeningsParams {
  floorIndex: number;
  widthM: number;
  lengthM: number;
  outline: Rect;
  /** Rooms in input order. */
  rooms: PlacedRoom[];
  /** Room keys in placement order (band order, then left→right). */
  placementOrder: string[];
  bands: LayoutBand[];
  corridor: Rect | null;
  stairs: Stair | null;
  walls: WallLayout;
}

export interface Openings {
  doors: Door[];
  windows: Window[];
}

function doorWidthFor(types: readonly RoomType[]): number {
  const narrow = types.some((type) =>
    (NARROW_DOOR_ROOM_TYPES as readonly RoomType[]).includes(type),
  );
  return narrow ? DOOR_WIDTH_NARROW_M : DOOR_WIDTH_M;
}

function edgeSpan(edge: SharedEdge): Interval {
  return { from: edge.from, to: edge.to };
}

/** The room's run along `side`, or null when the room does not touch it. */
function exteriorRun(room: Rect, outline: Rect, side: ExteriorSide): Interval | null {
  switch (side) {
    case 'north':
      return eq(room.y, outline.y) ? { from: room.x, to: right(room) } : null;
    case 'south':
      return eq(bottom(room), bottom(outline)) ? { from: room.x, to: right(room) } : null;
    case 'west':
      return eq(room.x, outline.x) ? { from: room.y, to: bottom(room) } : null;
    case 'east':
      return eq(right(room), right(outline)) ? { from: room.y, to: bottom(room) } : null;
  }
}

function exteriorPoint(side: ExteriorSide, along: number, widthM: number, lengthM: number): Point {
  const half = snap(EXTERIOR_WALL_M / 2);
  switch (side) {
    case 'north':
      return { x: snap(along), y: half };
    case 'south':
      return { x: snap(along), y: snap(lengthM - half) };
    case 'west':
      return { x: half, y: snap(along) };
    case 'east':
      return { x: snap(widthM - half), y: snap(along) };
  }
}

export function buildOpenings(params: BuildOpeningsParams): Openings {
  const {
    floorIndex,
    widthM,
    lengthM,
    outline,
    rooms,
    placementOrder,
    bands,
    corridor,
    stairs,
    walls,
  } = params;

  const doors: Door[] = [];
  const windows: Window[] = [];
  if (rooms.length === 0) return { doors, windows };

  const roomByKey = new Map<string, PlacedRoom>();
  for (const room of rooms) roomByKey.set(room.key, room);

  const bandSlot = new Map<string, { band: LayoutBand; index: number }>();
  for (const band of bands) {
    band.roomKeys.forEach((key, index) => bandSlot.set(key, { band, index }));
  }

  /** Spans already taken on each wall (x for horizontal walls, y for vertical). */
  const occupancy = new Map<string, Interval[]>();
  const emittedPairs = new Set<string>();
  const exteriorDoorRooms = new Set<string>();

  function isFree(wallId: string, span: Interval): boolean {
    const taken = occupancy.get(wallId);
    if (!taken) return true;
    return !taken.some((other) => intervalsOverlap(other, span));
  }

  function occupy(wallId: string, span: Interval): void {
    const taken = occupancy.get(wallId);
    if (taken) taken.push(span);
    else occupancy.set(wallId, [span]);
  }

  function emitInteriorDoor(
    pairKey: string,
    edge: SharedEdge,
    roomKeys: [string, string | null],
    types: RoomType[],
  ): boolean {
    const wallId = walls.interiorByEdge.get(edgeKey(edge));
    if (!wallId) return false;
    const width = doorWidthFor(types);
    const span = edgeSpan(edge);
    if (!gte(intervalLength(span), width)) return false;
    const center = edgeMidpoint(edge);
    const along = edge.orientation === 'vertical' ? center.y : center.x;
    const doorSpan: Interval = { from: snap(along - width / 2), to: snap(along + width / 2) };
    if (!isFree(wallId, doorSpan)) return false;
    occupy(wallId, doorSpan);
    doors.push({
      id: `f${floorIndex}-door-${doors.length + 1}`,
      wallId,
      roomKeys,
      center,
      width,
    });
    emittedPairs.add(pairKey);
    return true;
  }

  function emitExteriorDoor(room: PlacedRoom, side: ExteriorSide): boolean {
    const run = exteriorRun(room.rect, outline, side);
    if (!run) return false;
    const wallId = walls.exteriorIds[side];
    const width = doorWidthFor([room.type]);
    if (!gte(intervalLength(run), width)) return false;
    // One snap step of slack keeps the rounded centre inside the free run.
    const free = subtractIntervals(run, occupancy.get(wallId) ?? []).filter((interval) =>
      gte(intervalLength(interval), width + SNAP_M),
    );
    const slot = free.reduce<Interval | null>(
      (best, interval) =>
        best === null || intervalLength(interval) > intervalLength(best) ? interval : best,
      null,
    );
    if (!slot) return false;
    const along = snap((slot.from + slot.to) / 2);
    const span: Interval = { from: snap(along - width / 2), to: snap(along + width / 2) };
    occupy(wallId, span);
    doors.push({
      id: `f${floorIndex}-door-${doors.length + 1}`,
      wallId,
      roomKeys: [room.key, null],
      center: exteriorPoint(side, along, widthM, lengthM),
      width,
    });
    emittedPairs.add(`${room.key}|ext-${side}`);
    exteriorDoorRooms.add(room.key);
    return true;
  }

  function pairKeyFor(a: string, b: string): string {
    const orderA = placementOrder.indexOf(a);
    const orderB = placementOrder.indexOf(b);
    return orderA <= orderB ? `${a}|${b}` : `${b}|${a}`;
  }

  /** True when the room ends up served by a door shared with `otherKey`. */
  function tryNeighbourDoor(room: PlacedRoom, otherKey: string | undefined): boolean {
    if (!otherKey) return false;
    const other = roomByKey.get(otherKey);
    if (!other) return false;
    const edge = sharedEdge(room.rect, other.rect);
    if (!edge) return false;
    const key = pairKeyFor(room.key, otherKey);
    if (emittedPairs.has(key)) return true; // already served by that shared door
    const first = placementOrder.indexOf(room.key) <= placementOrder.indexOf(otherKey);
    const roomKeys: [string, string | null] = first ? [room.key, otherKey] : [otherKey, room.key];
    return emitInteriorDoor(key, edge, roomKeys, [room.type, other.type]);
  }

  // ── Doors: every room gets one, corridor first, then stairs, then neighbours ──
  for (const key of placementOrder) {
    const room = roomByKey.get(key);
    if (!room) continue;

    // 1. corridor-facing edge
    if (corridor) {
      const edge = sharedEdge(room.rect, corridor);
      if (edge) {
        const pairKey = `${key}|corridor`;
        if (emittedPairs.has(pairKey)) continue;
        if (emitInteriorDoor(pairKey, edge, [key, null], [room.type])) continue;
      }
    }

    // 2. stair-side edge
    if (stairs) {
      const edge = sharedEdge(room.rect, stairs.rect);
      if (edge) {
        const pairKey = `${key}|stairs`;
        if (emittedPairs.has(pairKey)) continue;
        if (emitInteriorDoor(pairKey, edge, [key, null], [room.type])) continue;
      }
    }

    // 3./4. previous, then next room in the same band
    const slot = bandSlot.get(key);
    if (slot) {
      const previous = tryNeighbourDoor(room, slot.band.roomKeys[slot.index - 1]);
      if (previous) continue;
      const next = tryNeighbourDoor(room, slot.band.roomKeys[slot.index + 1]);
      if (next) continue;
    }

    // 5. any adjacent room (e.g. across bands)
    let connected = false;
    for (const otherKey of placementOrder) {
      if (otherKey === key) continue;
      const result = tryNeighbourDoor(room, otherKey);
      if (result) {
        connected = true;
        break;
      }
    }
    if (connected) continue;

    // 6. exterior wall (entry on floor 0, last resort elsewhere)
    for (const side of SIDE_PRIORITY) {
      if (emitExteriorDoor(room, side)) break;
    }
  }

  // Floor 0 always has one exterior entry door — into the living room if present.
  if (floorIndex === 0) {
    const hasPerimeter = (room: PlacedRoom): boolean =>
      SIDE_PRIORITY.some((side) => exteriorRun(room.rect, outline, side) !== null);
    const entryRoom =
      rooms.find((room) => room.type === 'LIVING_ROOM' && hasPerimeter(room)) ??
      rooms.find(hasPerimeter) ??
      null;
    if (entryRoom && !exteriorDoorRooms.has(entryRoom.key)) {
      for (const side of SIDE_PRIORITY) {
        if (emitExteriorDoor(entryRoom, side)) break;
      }
    }
  }

  // Safety net: every room must own at least one door.
  const servedRooms = new Set<string>();
  for (const door of doors) {
    servedRooms.add(door.roomKeys[0]);
    if (door.roomKeys[1]) servedRooms.add(door.roomKeys[1]);
  }
  for (const key of placementOrder) {
    if (servedRooms.has(key)) continue;
    const room = roomByKey.get(key);
    if (!room) continue;
    for (const side of SIDE_PRIORITY) {
      if (emitExteriorDoor(room, side)) {
        servedRooms.add(key);
        break;
      }
    }
  }

  // ── Windows ─────────────────────────────────────────────────────────────
  for (const room of rooms) {
    if ((WINDOWLESS_ROOM_TYPES as readonly RoomType[]).includes(room.type)) continue;

    let bestSide: ExteriorSide | null = null;
    let bestRun: Interval | null = null;
    for (const side of SIDE_PRIORITY) {
      const run = exteriorRun(room.rect, outline, side);
      if (!run) continue;
      if (!bestRun || intervalLength(run) > intervalLength(bestRun)) {
        bestSide = side;
        bestRun = run;
      }
    }
    if (!bestSide || !bestRun) continue;

    const wallId = walls.exteriorIds[bestSide];
    const desired = clamp(
      snap(intervalLength(bestRun) * WINDOW_WALL_RATIO),
      WINDOW_MIN_LENGTH_M,
      WINDOW_MAX_LENGTH_M,
    );
    const free = subtractIntervals(bestRun, occupancy.get(wallId) ?? []);
    const slot = free.reduce<Interval | null>(
      (best, interval) =>
        best === null || intervalLength(interval) > intervalLength(best) ? interval : best,
      null,
    );
    if (!slot) continue;
    // One snap step of slack keeps the rounded centre — and therefore the whole
    // window span — inside the free run, clear of any door on the same wall.
    const available = snap(intervalLength(slot) - SNAP_M);
    if (!gte(available, WINDOW_MIN_LENGTH_M)) continue;

    const length = snap(Math.min(desired, available));
    const along = snap((slot.from + slot.to) / 2);
    const span: Interval = { from: snap(along - length / 2), to: snap(along + length / 2) };
    occupy(wallId, span);
    windows.push({
      id: `f${floorIndex}-win-${windows.length + 1}`,
      wallId,
      roomKey: room.key,
      center: exteriorPoint(bestSide, along, widthM, lengthM),
      length,
    });
  }

  return { doors, windows };
}
