import type { RoomType } from '@archai/shared';
import {
  CORRIDOR_MIN_ROOMS,
  CORRIDOR_WIDTH_M,
  EPSILON_M,
  MIN_ROOM_SIDE_M,
  SNAP_M,
  STAIR_DEPTH_M,
  STAIR_WIDTH_M,
} from './constants';
import { bottom, clamp, gte, rect, rectArea, right, round1, snap } from './geometry';
import type { EngineIssue, PlacedRoom, Rect, Stair, StairDirection } from './types';

/**
 * Minimum side used while packing. It is one snap step above the published
 * minimum so that rounding an edge to the 0.01 grid can never push an emitted
 * room below `MIN_ROOM_SIDE_M`.
 */
export const MIN_PACK_SIDE_M = snap(MIN_ROOM_SIDE_M + SNAP_M);

export interface PreparedRoom {
  key: string;
  type: RoomType;
  label: string | null;
  /** Declared width×length, or the type default. Drives the area share. */
  targetAreaM2: number;
  /**
   * Hard lower bound on the placed area. Bands are never sized below the sum of
   * these; a floor that cannot honour them fails rather than shrinking a room
   * past what its type can use.
   */
  minAreaM2: number;
  /**
   * Hard upper bound on the placed area. This is what stops a room absorbing
   * spare floor: leftover depth goes to circulation instead of inflating rooms.
   * Tight around a declared size, generous for a profile default.
   */
  maxAreaM2: number;
  requestedAreaM2: number | null;
  /** Index in the floor's room list (input order). */
  inputIndex: number;
}

export interface LayoutBand {
  rect: Rect;
  /** Room keys left→right. */
  roomKeys: string[];
}

export interface FloorLayout {
  outline: Rect;
  stairs: Stair | null;
  corridor: Rect | null;
  /** Rooms in input order. */
  rooms: PlacedRoom[];
  /** Bands top→bottom. */
  bands: LayoutBand[];
  /** Room keys in placement order (band order, then left→right). */
  placementOrder: string[];
}

export type LayoutResult = { ok: true; layout: FloorLayout } | { ok: false; issues: EngineIssue[] };

interface PackedRoom {
  room: PreparedRoom;
  rect: Rect;
}

type PackResult = { ok: true; placed: PackedRoom[] } | { ok: false; issues: EngineIssue[] };

export function stairDirection(floorIndex: number, floorCount: number): StairDirection {
  if (floorIndex === 0) return 'up';
  if (floorIndex === floorCount - 1) return 'down';
  return 'both';
}

/** How many rooms a band of this width can host at the minimum side. */
export function bandCapacity(width: number): number {
  return Math.max(0, Math.floor(snap(width) / MIN_PACK_SIDE_M));
}

/**
 * Divides the floor's area budget between rooms, honouring each room's bounds.
 *
 * This is the layer that makes a placed room resemble the one that was asked
 * for. Rooms tile the floor, so the allocated areas *must* sum to the budget —
 * the envelope is a fixed rectangle and any area the rooms decline still has to
 * be drawn as something. The bounds therefore shape the **proportions** between
 * rooms; they are not a licence to leave the floor half empty.
 *
 * Three phases, in priority order:
 *
 *  1. One shared scale factor, each room clamped to its own `[min, max]`. This
 *     is the shape-preserving pass, and on a floor whose program roughly matches
 *     its footprint it is the only one that does anything.
 *  2. Surplus (every room at its max, budget still unspent) goes to **headroom**
 *     — `max - allocated` — so the rooms that were left unsized absorb it first
 *     and a declared 5 m² bathroom stays near 5 m².
 *  3. Only once every room is at its ceiling and the budget is *still* unspent
 *     does the remainder spread proportionally. At that point the house is far
 *     larger than the program it was given, and generous rooms are a better
 *     answer than a 50 m² corridor. The same pass runs in reverse for a deficit,
 *     which `layoutFloor` has already rejected as infeasible before calling.
 *
 * The scale factor is found by bisection rather than algebraically: clamping
 * makes total(s) a piecewise-linear, non-invertible function of s, but it is
 * monotonic non-decreasing, so bisection converges and — with a fixed iteration
 * count and no data-dependent branching on floats — stays deterministic, which
 * the engine requires.
 */
export function allocateAreas(
  rooms: readonly PreparedRoom[],
  areaBudget: number,
): Map<string, number> {
  const result = new Map<string, number>();
  if (rooms.length === 0) return result;

  const totalAt = (scale: number): number =>
    rooms.reduce(
      (sum, room) => sum + clamp(room.targetAreaM2 * scale, room.minAreaM2, room.maxAreaM2),
      0,
    );

  // Beyond every room's max, more scale buys nothing; below every min, less
  // buys nothing. The answer is somewhere between, so bracket it and bisect.
  let low = 0;
  let high = 1;
  while (totalAt(high) < areaBudget && high < 1024) high *= 2;

  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2;
    if (totalAt(mid) < areaBudget) low = mid;
    else high = mid;
  }

  const scale = (low + high) / 2;
  const allocated = rooms.map((room) =>
    clamp(room.targetAreaM2 * scale, room.minAreaM2, room.maxAreaM2),
  );

  // Phase 2 — spend what is left on the rooms that can still grow.
  let residual = areaBudget - allocated.reduce((sum, value) => sum + value, 0);
  if (residual > EPSILON_M) {
    const headroom = rooms.map((room, i) => Math.max(0, room.maxAreaM2 - (allocated[i] ?? 0)));
    const totalHeadroom = headroom.reduce((sum, value) => sum + value, 0);
    if (totalHeadroom > EPSILON_M) {
      const take = Math.min(residual, totalHeadroom);
      for (let i = 0; i < rooms.length; i++) {
        allocated[i] = (allocated[i] ?? 0) + take * ((headroom[i] ?? 0) / totalHeadroom);
      }
      residual -= take;
    }
  }

  // Phase 3 — the program cannot fill the envelope (or, in deficit, cannot fit
  // inside it). Spread the remainder proportionally so the rooms tile the floor.
  if (Math.abs(residual) > EPSILON_M) {
    const totalTarget = rooms.reduce((sum, room) => sum + room.targetAreaM2, 0);
    for (let i = 0; i < rooms.length; i++) {
      const share =
        totalTarget > EPSILON_M ? (rooms[i]?.targetAreaM2 ?? 0) / totalTarget : 1 / rooms.length;
      allocated[i] = Math.max(0, (allocated[i] ?? 0) + residual * share);
    }
  }

  rooms.forEach((room, i) => result.set(room.key, allocated[i] ?? room.targetAreaM2));
  return result;
}

/**
 * Strip packing: rooms fill a band left→right as full-height rects with
 * width ∝ target area. Rooms that would fall under the minimum side are
 * clamped (water filling) and the remaining width is redistributed
 * proportionally; the last room absorbs snapping drift so the band is filled
 * exactly.
 *
 * Area fidelity comes from the band *height*, not from this function: the
 * caller sizes each band as `Σ area ÷ band width`, so a width proportional to
 * area lands every room on the area it was allocated. Widening the band would
 * inflate every room in it, which is exactly the defect this layer used to have.
 */
function packBand(
  band: Rect,
  rooms: PreparedRoom[],
  floorIndex: number,
  areaOf: (room: PreparedRoom) => number,
): PackResult {
  if (rooms.length === 0) return { ok: true, placed: [] };

  if (!gte(band.height, MIN_ROOM_SIDE_M)) {
    return {
      ok: false,
      issues: [
        {
          code: 'ROOM_AREA_UNSATISFIABLE',
          message: `Floor ${floorIndex}: a layout band is only ${band.height} m deep (minimum room side is ${MIN_ROOM_SIDE_M} m)`,
          meta: { floor: floorIndex, bandHeightM: band.height, minSideM: MIN_ROOM_SIDE_M },
        },
      ],
    };
  }

  if (!gte(band.width, rooms.length * MIN_PACK_SIDE_M)) {
    return {
      ok: false,
      issues: [
        {
          code: 'TOO_MANY_ROOMS_PER_FLOOR',
          message: `Floor ${floorIndex}: ${rooms.length} rooms do not fit in a ${band.width} m wide band at the ${MIN_ROOM_SIDE_M} m minimum side`,
          meta: { floor: floorIndex, rooms: rooms.length, bandWidthM: band.width },
        },
      ],
    };
  }

  const count = rooms.length;
  const widths = new Array<number>(count).fill(0);
  const fixed = new Array<boolean>(count).fill(false);
  let freeWidth = band.width;

  for (let pass = 0; pass <= count; pass++) {
    const pool: number[] = [];
    for (let i = 0; i < count; i++) if (!fixed[i]) pool.push(i);
    if (pool.length === 0) break;

    let poolTarget = 0;
    for (const i of pool) {
      const room = rooms[i];
      poolTarget += room ? areaOf(room) : 0;
    }

    for (const i of pool) {
      const room = rooms[i];
      const share = poolTarget > 0 && room ? areaOf(room) / poolTarget : 1 / pool.length;
      widths[i] = freeWidth * share;
    }

    // Clamp the smallest offender, then redistribute (deterministic tie-break by index).
    let offender = -1;
    for (const i of pool) {
      const w = widths[i] ?? 0;
      if (w >= MIN_PACK_SIDE_M) continue;
      if (offender === -1 || w < (widths[offender] ?? 0)) offender = i;
    }
    if (offender === -1) break;

    fixed[offender] = true;
    widths[offender] = MIN_PACK_SIDE_M;
    freeWidth = freeWidth - MIN_PACK_SIDE_M;
  }

  const placed: PackedRoom[] = [];
  let cursor = band.x;
  let accumulated = 0;
  for (let i = 0; i < count; i++) {
    const room = rooms[i];
    if (!room) continue;
    accumulated += widths[i] ?? 0;
    const edge = i === count - 1 ? right(band) : snap(band.x + accumulated);
    const width = snap(edge - cursor);
    if (!gte(width, MIN_ROOM_SIDE_M)) {
      return {
        ok: false,
        issues: [
          {
            code: 'ROOM_AREA_UNSATISFIABLE',
            message: `Floor ${floorIndex}: room "${room.key}" would only be ${width} m wide (minimum room side is ${MIN_ROOM_SIDE_M} m)`,
            meta: {
              floor: floorIndex,
              roomKey: room.key,
              widthM: width,
              minSideM: MIN_ROOM_SIDE_M,
            },
          },
        ],
      };
    }
    placed.push({ room, rect: rect(cursor, band.y, width, band.height) });
    cursor = edge;
  }

  return { ok: true, placed };
}

function toPlacedRoom(packed: PackedRoom): PlacedRoom {
  return {
    key: packed.room.key,
    type: packed.room.type,
    label: packed.room.label,
    rect: packed.rect,
    areaM2: round1(rectArea(packed.rect)),
    requestedAreaM2: packed.room.requestedAreaM2,
  };
}

export interface LayoutFloorParams {
  floorIndex: number;
  floorCount: number;
  outline: Rect;
  /** Rooms of this floor, in input order. */
  rooms: PreparedRoom[];
}

/**
 * Lays out one floor.
 *
 * Regions (all axis-aligned, tiling the outline exactly whenever the floor has
 * enough rooms to fill every band):
 *
 *   ┌──────────────────────────┬────────┐
 *   │ stair strip (h = 1.5)    │ stairs │   only when floorCount > 1
 *   ├──────────────────────────┴────────┤
 *   │ upper band                        │
 *   ├───────────────────────────────────┤
 *   │ corridor (h = 1.3)                │   only when the floor has ≥ 4 rooms
 *   ├───────────────────────────────────┤
 *   │ lower band                        │
 *   └───────────────────────────────────┘
 */
export function layoutFloor(params: LayoutFloorParams): LayoutResult {
  const { floorIndex, floorCount, outline, rooms } = params;
  const hasStairs = floorCount > 1;

  const stairs: Stair | null = hasStairs
    ? {
        rect: rect(right(outline) - STAIR_WIDTH_M, outline.y, STAIR_WIDTH_M, STAIR_DEPTH_M),
        direction: stairDirection(floorIndex, floorCount),
      }
    : null;

  const roomCount = rooms.length;
  if (roomCount === 0) {
    return {
      ok: true,
      layout: { outline, stairs, corridor: null, rooms: [], bands: [], placementOrder: [] },
    };
  }

  const mainRegion = stairs
    ? rect(
        outline.x,
        snap(outline.y + STAIR_DEPTH_M),
        outline.width,
        snap(outline.height - STAIR_DEPTH_M),
      )
    : outline;

  // Every room lives in the main region. The strip beside the stair core is
  // 1.5 m deep — deep enough for a landing, not for a room: a room forced into
  // it came out as a slab (a 5 m² bathroom was drawn 7.6 × 1.5 m). It is now
  // left as circulation, which is what the space beside a stair actually is.
  const bandWidth = mainRegion.width;

  // ≥ 4 rooms get a corridor; a floor too shallow for a corridor plus two bands
  // falls back to a single band (rooms then connect directly) rather than failing.
  const useCorridor =
    roomCount >= CORRIDOR_MIN_ROOMS &&
    gte(mainRegion.height, CORRIDOR_WIDTH_M + 2 * MIN_PACK_SIDE_M);

  const bandCount = useCorridor ? 2 : 1;
  const capacityPerBand = bandCapacity(bandWidth);
  const roomCapacity = capacityPerBand * bandCount;

  if (roomCount > roomCapacity) {
    return {
      ok: false,
      issues: [
        {
          code: 'TOO_MANY_ROOMS_PER_FLOOR',
          message: `Floor ${floorIndex}: ${roomCount} rooms exceed the ${roomCapacity} that fit at the ${MIN_ROOM_SIDE_M} m minimum side`,
          meta: {
            floor: floorIndex,
            rooms: roomCount,
            capacity: roomCapacity,
            minSideM: MIN_ROOM_SIDE_M,
          },
        },
      ],
    };
  }

  // ── Area allocation ─────────────────────────────────────────────────────
  // The depth rooms may occupy, once circulation has taken its minimum.
  const roomDepthBudget = snap(mainRegion.height - (useCorridor ? CORRIDOR_WIDTH_M : 0));
  const areaBudget = bandWidth * roomDepthBudget;
  const minTotal = rooms.reduce((sum, room) => sum + room.minAreaM2, 0);

  if (minTotal > areaBudget + EPSILON_M) {
    return {
      ok: false,
      issues: [
        {
          code: 'ROOM_AREA_UNSATISFIABLE',
          message: `Floor ${floorIndex}: rooms need at least ${round1(minTotal)} m² but only ${round1(areaBudget)} m² is available`,
          meta: {
            floor: floorIndex,
            requiredAreaM2: round1(minTotal),
            availableAreaM2: round1(areaBudget),
          },
        },
      ],
    };
  }

  const areas = allocateAreas(rooms, areaBudget);
  const areaOf = (room: PreparedRoom): number => areas.get(room.key) ?? room.targetAreaM2;

  // ── Bands ───────────────────────────────────────────────────────────────
  // A band's height is its rooms' allocated area divided by the band width, so
  // widths proportional to area land every room on exactly what it was
  // allocated. The allocation always sums to the budget, so the bands and the
  // corridor tile the main region exactly.
  const bands: { rect: Rect; rooms: PreparedRoom[] }[] = [];
  let corridor: Rect | null = null;

  const bandHeightFor = (group: PreparedRoom[]): number =>
    snap(group.reduce((sum, room) => sum + areaOf(room), 0) / bandWidth);

  if (useCorridor) {
    const count = rooms.length;
    const minSplit = Math.max(1, count - capacityPerBand);
    const maxSplit = Math.min(count - 1, capacityPerBand);

    if (minSplit > maxSplit) {
      return {
        ok: false,
        issues: [
          {
            code: 'TOO_MANY_ROOMS_PER_FLOOR',
            message: `Floor ${floorIndex}: ${count} rooms cannot be split across two ${bandWidth} m wide bands`,
            meta: { floor: floorIndex, rooms: count, bandWidthM: bandWidth },
          },
        ],
      };
    }

    // Split where the two bands' allocated areas balance, so neither band ends
    // up so shallow that its rooms breach the minimum side.
    const allocated = rooms.map(areaOf);
    const total = allocated.reduce((sum, value) => sum + value, 0);
    let bestSplit = minSplit;
    let bestImbalance = Number.POSITIVE_INFINITY;
    let running = 0;
    for (let split = 1; split <= count - 1; split++) {
      running += allocated[split - 1] ?? 0;
      if (split < minSplit || split > maxSplit) continue;
      const imbalance = Math.abs(running - (total - running));
      if (imbalance < bestImbalance) {
        bestImbalance = imbalance;
        bestSplit = split;
      }
    }

    const upperRooms = rooms.slice(0, bestSplit);
    const lowerRooms = rooms.slice(bestSplit);
    // The lower band takes the remainder rather than its own quotient, so the
    // two snapped heights plus the corridor tile the main region exactly
    // instead of drifting apart by a grid step.
    const upperHeight = bandHeightFor(upperRooms);
    const lowerHeight = snap(roomDepthBudget - upperHeight);
    const corridorHeight = CORRIDOR_WIDTH_M;

    if (!gte(upperHeight, MIN_PACK_SIDE_M) || !gte(lowerHeight, MIN_PACK_SIDE_M)) {
      return {
        ok: false,
        issues: [
          {
            code: 'ROOM_AREA_UNSATISFIABLE',
            message: `Floor ${floorIndex}: a layout band would be shallower than the ${MIN_ROOM_SIDE_M} m minimum room side`,
            meta: { floor: floorIndex, upperHeightM: upperHeight, lowerHeightM: lowerHeight },
          },
        ],
      };
    }

    const upperBand = rect(mainRegion.x, mainRegion.y, bandWidth, upperHeight);
    corridor = rect(mainRegion.x, bottom(upperBand), bandWidth, corridorHeight);
    const lowerBand = rect(mainRegion.x, bottom(corridor), bandWidth, lowerHeight);

    bands.push({ rect: upperBand, rooms: upperRooms });
    bands.push({ rect: lowerBand, rooms: lowerRooms });
  } else {
    // One band, no corridor: the rooms were allocated the whole budget, so the
    // band is the main region. Taking its height directly rather than dividing
    // the allocation back out keeps the fill exact.
    if (!gte(mainRegion.height, MIN_PACK_SIDE_M)) {
      return {
        ok: false,
        issues: [
          {
            code: 'ROOM_AREA_UNSATISFIABLE',
            message: `Floor ${floorIndex}: the room band would be ${mainRegion.height} m deep, below the ${MIN_ROOM_SIDE_M} m minimum room side`,
            meta: { floor: floorIndex, bandHeightM: mainRegion.height, minSideM: MIN_ROOM_SIDE_M },
          },
        ],
      };
    }
    bands.push({ rect: mainRegion, rooms });
  }

  // ── Pack ────────────────────────────────────────────────────────────────
  const issues: EngineIssue[] = [];
  const packedBands: LayoutBand[] = [];
  const placedByKey = new Map<string, PlacedRoom>();
  const placementOrder: string[] = [];

  for (const band of bands) {
    const result = packBand(band.rect, band.rooms, floorIndex, areaOf);
    if (!result.ok) {
      issues.push(...result.issues);
      continue;
    }
    const keys: string[] = [];
    for (const packed of result.placed) {
      placedByKey.set(packed.room.key, toPlacedRoom(packed));
      keys.push(packed.room.key);
      placementOrder.push(packed.room.key);
    }
    packedBands.push({ rect: band.rect, roomKeys: keys });
  }

  if (issues.length > 0) return { ok: false, issues };

  // Emit rooms in input order — the placement order is kept separately.
  const placedRooms: PlacedRoom[] = [];
  for (const room of rooms) {
    const placed = placedByKey.get(room.key);
    if (placed) placedRooms.push(placed);
  }

  return {
    ok: true,
    layout: {
      outline,
      stairs,
      corridor,
      rooms: placedRooms,
      bands: packedBands,
      placementOrder,
    },
  };
}
