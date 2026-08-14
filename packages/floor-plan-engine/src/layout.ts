import type { RoomType } from '@archai/shared';
import {
  CORRIDOR_MIN_ROOMS,
  CORRIDOR_WIDTH_M,
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
 * Strip packing: rooms fill a band left→right as full-height rects with
 * width ∝ target area. Rooms that would fall under the minimum side are
 * clamped (water filling) and the remaining width is redistributed
 * proportionally; the last room absorbs snapping drift so the band is filled
 * exactly.
 */
function packBand(band: Rect, rooms: PreparedRoom[], floorIndex: number): PackResult {
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
    for (const i of pool) poolTarget += rooms[i]?.targetAreaM2 ?? 0;

    for (const i of pool) {
      const share = poolTarget > 0 ? (rooms[i]?.targetAreaM2 ?? 0) / poolTarget : 1 / pool.length;
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

  const stripWidth = stairs ? snap(outline.width - STAIR_WIDTH_M) : 0;

  // The strip beside the stair core can only be tiled by rooms; with a single
  // room on the floor the room takes the main region instead (a rectangle
  // cannot cover an L-shape) and the strip stays empty.
  if (stairs && roomCount >= 2 && !gte(stripWidth, MIN_PACK_SIDE_M)) {
    return {
      ok: false,
      issues: [
        {
          code: 'FOOTPRINT_TOO_SMALL',
          message: `Floor ${floorIndex}: only ${stripWidth} m is left beside the ${STAIR_WIDTH_M} m stair core — not enough for a room`,
          meta: {
            floor: floorIndex,
            stripWidthM: stripWidth,
            stairWidthM: STAIR_WIDTH_M,
            minSideM: MIN_ROOM_SIDE_M,
          },
        },
      ],
    };
  }

  const useStrip = Boolean(stairs) && roomCount >= 2 && gte(stripWidth, MIN_PACK_SIDE_M);
  // ≥ 4 rooms get a corridor; a floor too shallow for a corridor plus two bands
  // falls back to a single strip (rooms then connect directly) rather than failing.
  const useCorridor =
    roomCount >= CORRIDOR_MIN_ROOMS &&
    gte(mainRegion.height, CORRIDOR_WIDTH_M + 2 * MIN_PACK_SIDE_M);

  const stripArea = useStrip ? stripWidth * STAIR_DEPTH_M : 0;
  const corridorArea = useCorridor ? mainRegion.width * CORRIDOR_WIDTH_M : 0;
  const availableArea = stripArea + rectArea(mainRegion) - corridorArea;

  const stripCapacity = useStrip ? bandCapacity(stripWidth) : 0;
  const mainBandCount = useCorridor ? 2 : 1;
  const mainCapacity = bandCapacity(mainRegion.width) * mainBandCount;

  if (roomCount > stripCapacity + mainCapacity) {
    return {
      ok: false,
      issues: [
        {
          code: 'TOO_MANY_ROOMS_PER_FLOOR',
          message: `Floor ${floorIndex}: ${roomCount} rooms exceed the ${stripCapacity + mainCapacity} that fit at the ${MIN_ROOM_SIDE_M} m minimum side`,
          meta: {
            floor: floorIndex,
            rooms: roomCount,
            capacity: stripCapacity + mainCapacity,
            minSideM: MIN_ROOM_SIDE_M,
          },
        },
      ],
    };
  }

  const totalTarget = rooms.reduce((sum, room) => sum + room.targetAreaM2, 0);
  const globalScale = totalTarget > 0 ? availableArea / totalTarget : 0;

  // ── Which rooms go into the shallow stair strip ─────────────────────────
  // The smallest declared rooms distort least in a 1.5 m deep band; ties break
  // on input order, so the choice is stable.
  const stripKeys = new Set<string>();
  if (useStrip) {
    const byArea = rooms
      .map((room, index) => ({ room, index }))
      .sort((a, b) => a.room.targetAreaM2 - b.room.targetAreaM2 || a.index - b.index);

    const maxStripRooms = Math.min(stripCapacity, roomCount - mainBandCount);
    let bestCount = 0;
    let bestDiff = Number.POSITIVE_INFINITY;
    let accumulated = 0;
    for (let take = 1; take <= maxStripRooms; take++) {
      accumulated += byArea[take - 1]?.room.targetAreaM2 ?? 0;
      if (roomCount - take > mainCapacity) continue;
      const diff = Math.abs(accumulated * globalScale - stripArea);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestCount = take;
      }
    }

    if (bestCount === 0) {
      return {
        ok: false,
        issues: [
          {
            code: 'TOO_MANY_ROOMS_PER_FLOOR',
            message: `Floor ${floorIndex}: ${roomCount} rooms cannot be distributed across the available bands`,
            meta: { floor: floorIndex, rooms: roomCount, capacity: stripCapacity + mainCapacity },
          },
        ],
      };
    }

    for (let i = 0; i < bestCount; i++) {
      const entry = byArea[i];
      if (entry) stripKeys.add(entry.room.key);
    }
  }

  const stripRooms = rooms.filter((room) => stripKeys.has(room.key));
  const mainRooms = rooms.filter((room) => !stripKeys.has(room.key));

  // ── Bands ───────────────────────────────────────────────────────────────
  const bands: { rect: Rect; rooms: PreparedRoom[] }[] = [];
  if (useStrip && stripRooms.length > 0) {
    bands.push({
      rect: rect(outline.x, outline.y, stripWidth, STAIR_DEPTH_M),
      rooms: stripRooms,
    });
  }

  let corridor: Rect | null = null;
  if (useCorridor) {
    const usableHeight = snap(mainRegion.height - CORRIDOR_WIDTH_M);
    const capacityPerBand = bandCapacity(mainRegion.width);
    const count = mainRooms.length;
    const minSplit = Math.max(1, count - capacityPerBand);
    const maxSplit = Math.min(count - 1, capacityPerBand);

    if (minSplit > maxSplit) {
      return {
        ok: false,
        issues: [
          {
            code: 'TOO_MANY_ROOMS_PER_FLOOR',
            message: `Floor ${floorIndex}: ${count} rooms cannot be split across two ${mainRegion.width} m wide bands`,
            meta: { floor: floorIndex, rooms: count, bandWidthM: mainRegion.width },
          },
        ],
      };
    }

    const targets = mainRooms.map((room) => room.targetAreaM2);
    const total = targets.reduce((sum, value) => sum + value, 0);
    let bestSplit = minSplit;
    let bestImbalance = Number.POSITIVE_INFINITY;
    let upperTarget = 0;
    let runningTarget = 0;
    for (let split = 1; split <= count - 1; split++) {
      runningTarget += targets[split - 1] ?? 0;
      if (split < minSplit || split > maxSplit) continue;
      const imbalance = Math.abs(runningTarget - (total - runningTarget));
      if (imbalance < bestImbalance) {
        bestImbalance = imbalance;
        bestSplit = split;
        upperTarget = runningTarget;
      }
    }

    // Corridor sits where the two bands' target areas balance.
    const share = total > 0 ? upperTarget / total : 0.5;
    const upperHeight = snap(
      clamp(usableHeight * share, MIN_PACK_SIDE_M, snap(usableHeight - MIN_PACK_SIDE_M)),
    );
    const lowerHeight = snap(usableHeight - upperHeight);

    const upperBand = rect(mainRegion.x, mainRegion.y, mainRegion.width, upperHeight);
    corridor = rect(mainRegion.x, bottom(upperBand), mainRegion.width, CORRIDOR_WIDTH_M);
    const lowerBand = rect(mainRegion.x, bottom(corridor), mainRegion.width, lowerHeight);

    bands.push({ rect: upperBand, rooms: mainRooms.slice(0, bestSplit) });
    bands.push({ rect: lowerBand, rooms: mainRooms.slice(bestSplit) });
  } else {
    bands.push({ rect: mainRegion, rooms: mainRooms });
  }

  // ── Pack ────────────────────────────────────────────────────────────────
  const issues: EngineIssue[] = [];
  const packedBands: LayoutBand[] = [];
  const placedByKey = new Map<string, PlacedRoom>();
  const placementOrder: string[] = [];

  for (const band of bands) {
    const result = packBand(band.rect, band.rooms, floorIndex);
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
