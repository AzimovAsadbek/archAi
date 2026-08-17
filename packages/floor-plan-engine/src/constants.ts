import type { RoomType } from '@archai/shared';

/**
 * Engine version — bump on ANY algorithm change. Persisted plans cite it for
 * provenance; consumers recompute when the stored version differs.
 */
export const FLOOR_PLAN_ENGINE_VERSION = '1.3.0';

// ── Construction constants (metres) ───────────────────────────────────────

export const EXTERIOR_WALL_M = 0.3;
export const INTERIOR_WALL_M = 0.15;
export const CORRIDOR_WIDTH_M = 1.3;
export const DOOR_WIDTH_M = 0.9;
/** Bathroom / storage doors. */
export const DOOR_WIDTH_NARROW_M = 0.8;
export const WINDOW_WALL_RATIO = 0.4;
export const WINDOW_MIN_LENGTH_M = 0.8;
export const WINDOW_MAX_LENGTH_M = 2.4;
export const STAIR_WIDTH_M = 2.8;
export const STAIR_DEPTH_M = 1.5;
export const MIN_ROOM_SIDE_M = 1.5;

// ── Numeric hygiene ───────────────────────────────────────────────────────

/** Every emitted coordinate / size is snapped to this grid. */
export const SNAP_M = 0.01;
/** Tolerance for geometric comparisons (half a snap step). */
export const EPSILON_M = 0.005;

// ── Layout rules ──────────────────────────────────────────────────────────

/** A floor gets a corridor band from this many rooms upwards. */
export const CORRIDOR_MIN_ROOMS = 4;

// ── Room area bounds ──────────────────────────────────────────────────────
//
// These order the competition for floor area: `allocateAreas` grows the rooms
// with the most headroom first, so a room left unsized absorbs spare floor
// before a declared one is touched.
//
// They are a priority, not a guarantee. Rooms tile a fixed rectangle, so a
// program that does not add up to its envelope still has to be scaled to fill
// it — a 24 m² program in a 79 m² floor ends up at roughly 3× whatever these
// say. What the bounds do buy is that the scaling is *uniform*: no single room
// is picked to absorb the slack, which is the defect they were added for (a
// declared 5 m² bathroom drawn at 11.4 m² beside rooms that kept their sizes).

/**
 * A declared width×length is a requirement, so it is the last thing to give:
 * these keep a declared room within a few percent of its size for as long as
 * any other room still has room to grow. The tolerance covers 0.01 m grid
 * snapping and the minimum-side clamp — never a re-plan of the room.
 */
export const DECLARED_AREA_MIN_RATIO = 0.92;
export const DECLARED_AREA_MAX_RATIO = 1.08;

/**
 * A room the user left unsized has no requirement to honour, so the engine may
 * size it anywhere inside its type profile. These mirror the ratios
 * `ROOM_PROFILES` uses for the feasibility gate.
 */
export const PROFILE_AREA_MIN_RATIO = 0.6;
export const PROFILE_AREA_MAX_RATIO = 1.8;

// ── Site (metres) ─────────────────────────────────────────────────────────
//
// What surrounds the building. These are ordinary residential dimensions, not
// regulation: the site layer exists to draw a plausible property, and a plot
// that cannot honour them is shrunk to fit rather than rejected.

/** Street frontage: room for a car to stand clear of the pavement. */
export const SETBACK_FRONT_M = 5;
export const SETBACK_SIDE_M = 2;
export const SETBACK_REAR_M = 4;

/** Depth ÷ width used when a plot is known only by its area. */
export const PLOT_DEPTH_TO_WIDTH = 1.5;

/** Single garage, internal dimensions rounded up to a structure. */
export const GARAGE_WIDTH_M = 3.6;
export const GARAGE_DEPTH_M = 6;
export const DRIVEWAY_MIN_WIDTH_M = 3;
/** Footpath to the front door when there is no drive. */
export const PATH_WIDTH_M = 1.5;

export const TERRACE_DEPTH_M = 3;
export const POOL_WIDTH_M = 4;
export const POOL_LENGTH_M = 8;
export const BALCONY_DEPTH_M = 1.2;

/** Breathing room between two site elements, and between one and the house. */
export const SITE_GAP_M = 1;

export const NARROW_DOOR_ROOM_TYPES = [
  'BATHROOM',
  'STORAGE',
] as const satisfies readonly RoomType[];

export const WINDOWLESS_ROOM_TYPES = [
  'BATHROOM',
  'STORAGE',
  'LAUNDRY',
  'HALLWAY',
] as const satisfies readonly RoomType[];

/** Target area (m²) used when a room has no declared width×length. */
export const DEFAULT_ROOM_AREAS: Record<RoomType, number> = {
  LIVING_ROOM: 22,
  BEDROOM: 14,
  KITCHEN: 12,
  DINING_ROOM: 12,
  OFFICE: 10,
  BATHROOM: 5,
  LAUNDRY: 4,
  STORAGE: 4,
  HALLWAY: 6,
  OTHER: 10,
};
