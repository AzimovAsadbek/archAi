import { ROOM_TYPES, type RoomType } from '@archai/shared';
import {
  DEFAULT_ROOM_AREAS,
  EXTERIOR_WALL_M,
  FLOOR_PLAN_ENGINE_VERSION,
  MIN_ROOM_SIDE_M,
  STAIR_DEPTH_M,
  STAIR_WIDTH_M,
} from './constants';
import { gte, isPositiveFinite, rect, round1, snap } from './geometry';
import { layoutFloor, type PreparedRoom } from './layout';
import { buildOpenings } from './openings';
import { buildWalls } from './walls';
import type {
  EngineIssue,
  FloorGeometry,
  FloorPlanInput,
  FloorPlanResult,
  RoomSpec,
} from './types';

function defaultAreaFor(type: RoomType): number {
  return (ROOM_TYPES as readonly string[]).includes(type)
    ? DEFAULT_ROOM_AREAS[type]
    : DEFAULT_ROOM_AREAS.OTHER;
}

/**
 * Stable room key: the caller's id when given, else `f{floor}-{TYPE}-{ordinal}`
 * where the ordinal counts same-type rooms on that floor in input order.
 * Collisions (duplicate ids, or an id shaped like a generated key) get a
 * deterministic numeric suffix so keys stay unique.
 */
function uniqueKey(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  const key = `${base}-${suffix}`;
  used.add(key);
  return key;
}

function prepareRooms(specs: RoomSpec[], floorCount: number): PreparedRoom[][] {
  const perFloor: PreparedRoom[][] = [];
  for (let floor = 0; floor < floorCount; floor++) perFloor.push([]);

  const usedKeys = new Set<string>();
  const ordinals = new Map<string, number>();

  specs.forEach((spec, index) => {
    const floor = spec.floor;
    const bucket = perFloor[floor];
    if (!bucket) return;

    const ordinalKey = `${floor}|${spec.type}`;
    const ordinal = (ordinals.get(ordinalKey) ?? 0) + 1;
    ordinals.set(ordinalKey, ordinal);

    const providedId = typeof spec.id === 'string' ? spec.id.trim() : '';
    const base = providedId.length > 0 ? providedId : `f${floor}-${spec.type}-${ordinal}`;

    const declaredWidth = spec.widthM;
    const declaredLength = spec.lengthM;
    const hasDims = isPositiveFinite(declaredWidth) && isPositiveFinite(declaredLength);
    const declaredArea = hasDims ? declaredWidth * declaredLength : 0;

    bucket.push({
      key: uniqueKey(base, usedKeys),
      type: spec.type,
      label: typeof spec.label === 'string' && spec.label.length > 0 ? spec.label : null,
      targetAreaM2: hasDims ? declaredArea : defaultAreaFor(spec.type),
      requestedAreaM2: hasDims ? round1(declaredArea) : null,
      inputIndex: index,
    });
  });

  return perFloor;
}

/**
 * Deterministic floor-plan geometry. Identical input ⇒ deep-equal output.
 * Never throws: unusable inputs come back as `{ ok: false, issues }`.
 */
export function generateFloorPlan(input: FloorPlanInput): FloorPlanResult {
  try {
    return generate(input);
  } catch (error) {
    return {
      ok: false,
      issues: [
        {
          code: 'INTERNAL_ERROR',
          message: `Floor-plan engine failed: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
}

function generate(input: FloorPlanInput): FloorPlanResult {
  const issues: EngineIssue[] = [];
  const house = input?.house;

  if (
    !house ||
    !isPositiveFinite(house.widthM) ||
    !isPositiveFinite(house.lengthM) ||
    !Number.isInteger(house.floorCount) ||
    house.floorCount < 1
  ) {
    return {
      ok: false,
      issues: [
        {
          code: 'INVALID_INPUT',
          message: 'House width, length and floor count must be positive finite numbers',
        },
      ],
    };
  }

  const widthM = snap(house.widthM);
  const lengthM = snap(house.lengthM);
  const floorCount = house.floorCount;
  const specs = Array.isArray(input.rooms) ? input.rooms : [];

  specs.forEach((spec, index) => {
    if (!spec || !Number.isInteger(spec.floor) || spec.floor < 0 || spec.floor >= floorCount) {
      issues.push({
        code: 'ROOM_ON_MISSING_FLOOR',
        message: `Room #${index + 1} sits on floor ${String(spec?.floor)} but the house has ${floorCount} floor(s)`,
        meta: { roomIndex: index, floor: Number(spec?.floor ?? -1), floorCount },
      });
    }
  });

  const outline = rect(
    EXTERIOR_WALL_M,
    EXTERIOR_WALL_M,
    snap(widthM - 2 * EXTERIOR_WALL_M),
    snap(lengthM - 2 * EXTERIOR_WALL_M),
  );

  if (!gte(outline.width, MIN_ROOM_SIDE_M) || !gte(outline.height, MIN_ROOM_SIDE_M)) {
    issues.push({
      code: 'FOOTPRINT_TOO_SMALL',
      message: `Usable area ${outline.width}×${outline.height} m is below the ${MIN_ROOM_SIDE_M} m minimum room side`,
      meta: {
        usableWidthM: outline.width,
        usableLengthM: outline.height,
        minSideM: MIN_ROOM_SIDE_M,
      },
    });
  } else if (floorCount > 1) {
    if (!gte(outline.width, STAIR_WIDTH_M)) {
      issues.push({
        code: 'FOOTPRINT_TOO_SMALL',
        message: `Usable width ${outline.width} m cannot host the ${STAIR_WIDTH_M} m stair core`,
        meta: { usableWidthM: outline.width, stairWidthM: STAIR_WIDTH_M },
      });
    }
    if (!gte(outline.height, STAIR_DEPTH_M + MIN_ROOM_SIDE_M)) {
      issues.push({
        code: 'FOOTPRINT_TOO_SMALL',
        message: `Usable length ${outline.height} m cannot host the stair core plus a room`,
        meta: { usableLengthM: outline.height, stairDepthM: STAIR_DEPTH_M },
      });
    }
  }

  if (issues.length > 0) return { ok: false, issues };

  const roomsByFloor = prepareRooms(specs, floorCount);
  const floors: FloorGeometry[] = [];

  for (let index = 0; index < floorCount; index++) {
    const floorRooms = roomsByFloor[index] ?? [];
    const layout = layoutFloor({
      floorIndex: index,
      floorCount,
      outline,
      rooms: floorRooms,
    });

    if (!layout.ok) {
      issues.push(...layout.issues);
      continue;
    }

    const placementOrder = layout.layout.placementOrder;
    const orderedRooms = placementOrder
      .map((key) => layout.layout.rooms.find((room) => room.key === key))
      .filter((room): room is NonNullable<typeof room> => room !== undefined);

    const walls = buildWalls({
      floorIndex: index,
      widthM,
      lengthM,
      rooms: orderedRooms,
      corridor: layout.layout.corridor,
      stairs: layout.layout.stairs,
    });

    const openings = buildOpenings({
      floorIndex: index,
      widthM,
      lengthM,
      outline,
      rooms: layout.layout.rooms,
      placementOrder,
      bands: layout.layout.bands,
      corridor: layout.layout.corridor,
      stairs: layout.layout.stairs,
      walls,
    });

    floors.push({
      index,
      outline,
      rooms: layout.layout.rooms,
      walls: walls.walls,
      doors: openings.doors,
      windows: openings.windows,
      stairs: layout.layout.stairs,
      corridor: layout.layout.corridor,
    });
  }

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    plan: {
      engineVersion: FLOOR_PLAN_ENGINE_VERSION,
      house: { widthM, lengthM, floorCount },
      floors,
    },
  };
}
