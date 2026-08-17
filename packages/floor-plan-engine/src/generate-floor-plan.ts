import { ROOM_TYPES, type RoomType } from '@archai/shared';
import {
  DECLARED_AREA_MAX_RATIO,
  DECLARED_AREA_MIN_RATIO,
  DEFAULT_ROOM_AREAS,
  EXTERIOR_WALL_M,
  FLOOR_PLAN_ENGINE_VERSION,
  MIN_ROOM_SIDE_M,
  PROFILE_AREA_MAX_RATIO,
  PROFILE_AREA_MIN_RATIO,
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
 * How far a placed room may drift from its target area.
 *
 * A declared width×length is a user requirement, so the band is tight — the
 * tolerance exists only to absorb grid snapping and the minimum-side clamp, not
 * to let the engine re-plan the room. A room the user left blank has no such
 * requirement, so the engine may size it anywhere inside its type profile.
 *
 * The profile ratios are the same constants `ROOM_PROFILES` in
 * `layout/requirements.ts` builds its bounds from, so the area a room is placed
 * at and the area the feasibility gate checks it against cannot drift apart.
 */
function areaBoundsFor(
  type: RoomType,
  declared: boolean,
  targetAreaM2: number,
): { min: number; max: number } {
  const base = (ROOM_TYPES as readonly string[]).includes(type)
    ? DEFAULT_ROOM_AREAS[type]
    : DEFAULT_ROOM_AREAS.OTHER;

  if (declared) {
    // The maximum is tight — that is what stops a room absorbing spare floor.
    // The minimum is not: it is the *lower* of the declared tolerance and what
    // the room type actually needs to function. Treating a declared size as a
    // hard floor would make an over-ambitious brief infeasible rather than
    // scaled, so "I want eight 40 m² bedrooms in a 10×10 house" would fail
    // outright instead of coming back proportionally shrunk with an honest
    // deviation the UI can show.
    return {
      min: Math.min(targetAreaM2 * DECLARED_AREA_MIN_RATIO, base * PROFILE_AREA_MIN_RATIO),
      max: targetAreaM2 * DECLARED_AREA_MAX_RATIO,
    };
  }
  return { min: base * PROFILE_AREA_MIN_RATIO, max: base * PROFILE_AREA_MAX_RATIO };
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
    const targetAreaM2 = hasDims ? declaredArea : defaultAreaFor(spec.type);
    const bounds = areaBoundsFor(spec.type, hasDims, targetAreaM2);

    bucket.push({
      key: uniqueKey(base, usedKeys),
      type: spec.type,
      label: typeof spec.label === 'string' && spec.label.length > 0 ? spec.label : null,
      targetAreaM2,
      minAreaM2: bounds.min,
      maxAreaM2: bounds.max,
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
    // The core alone is not enough: the strip beside it is the landing you
    // arrive on, and a landing narrower than the minimum room side is not a
    // space anyone can use. Requiring the core *plus* that clearance is what
    // makes the strip a landing rather than a sliver of unreachable slab.
    if (!gte(outline.width, STAIR_WIDTH_M + MIN_ROOM_SIDE_M)) {
      issues.push({
        code: 'FOOTPRINT_TOO_SMALL',
        message: `Usable width ${outline.width} m cannot host the ${STAIR_WIDTH_M} m stair core plus a ${MIN_ROOM_SIDE_M} m landing`,
        meta: {
          usableWidthM: outline.width,
          stairWidthM: STAIR_WIDTH_M,
          landingWidthM: MIN_ROOM_SIDE_M,
        },
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
