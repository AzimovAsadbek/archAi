import type { RoomType } from '@archai/shared';

/**
 * Engine version — bump on ANY algorithm change. Persisted plans cite it for
 * provenance; consumers recompute when the stored version differs.
 */
export const FLOOR_PLAN_ENGINE_VERSION = '1.1.0';

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
