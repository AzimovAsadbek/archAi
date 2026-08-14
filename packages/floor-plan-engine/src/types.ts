import type { RoomType } from '@archai/shared';

// ── Primitive geometry (all values in metres, snapped to 0.01) ─────────────

export interface Point {
  x: number;
  y: number;
}

/** Axis-aligned rectangle. Origin is the footprint top-left, y grows downward. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Axis-aligned segment (wall centre line). */
export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// ── Engine input ──────────────────────────────────────────────────────────

export interface HouseSpec {
  widthM: number;
  lengthM: number;
  floorCount: number;
}

export interface RoomSpec {
  /** Stable id from the caller (DB room id). Used verbatim as the room key. */
  id?: string;
  type: RoomType;
  /** 0-based floor index. */
  floor: number;
  widthM?: number | null;
  lengthM?: number | null;
  label?: string | null;
}

export interface FloorPlanInput {
  house: HouseSpec;
  rooms: RoomSpec[];
}

// ── Engine output ─────────────────────────────────────────────────────────

export interface PlacedRoom {
  /** `roomId` when provided, else `f{floor}-{TYPE}-{ordinal}`. Unique per plan. */
  key: string;
  type: RoomType;
  label: string | null;
  rect: Rect;
  /** Placed area, rounded to 0.1 m². */
  areaM2: number;
  /** Declared width×length when both dims were given, rounded to 0.1 m². */
  requestedAreaM2: number | null;
}

export type WallKind = 'exterior' | 'interior';

export interface Wall {
  id: string;
  kind: WallKind;
  thickness: number;
  segment: Segment;
}

export interface Door {
  id: string;
  wallId: string;
  /** `[room, otherRoom]`; a null second key means the door opens to corridor/stairs/outside. */
  roomKeys: [string, string | null];
  center: Point;
  width: number;
}

export interface Window {
  id: string;
  wallId: string;
  roomKey: string;
  center: Point;
  length: number;
}

/** Alias for consumers where the DOM `Window` type is in scope (apps/web). */
export type FloorPlanWindow = Window;

export type StairDirection = 'up' | 'down' | 'both';

export interface Stair {
  rect: Rect;
  direction: StairDirection;
}

export interface FloorGeometry {
  index: number;
  /** Inner usable area (footprint minus the exterior wall inset). */
  outline: Rect;
  rooms: PlacedRoom[];
  walls: Wall[];
  doors: Door[];
  windows: Window[];
  stairs: Stair | null;
  corridor: Rect | null;
}

export interface FloorPlan {
  engineVersion: string;
  house: HouseSpec;
  floors: FloorGeometry[];
}

// ── Issues / result ───────────────────────────────────────────────────────

export const ENGINE_ISSUE_CODES = [
  /** House footprint (or the area left by the stair core) is too small to lay out. */
  'FOOTPRINT_TOO_SMALL',
  /** A room cannot reach the minimum side length inside its band. */
  'ROOM_AREA_UNSATISFIABLE',
  /** More rooms on a floor than the usable width can host at the minimum side. */
  'TOO_MANY_ROOMS_PER_FLOOR',
  /** A room references a floor the house does not have. */
  'ROOM_ON_MISSING_FLOOR',
  /** Structurally unusable input (non-finite or non-positive dimensions). */
  'INVALID_INPUT',
  /** Guard rail: an unexpected internal error was caught and reported instead of thrown. */
  'INTERNAL_ERROR',
] as const;

export type EngineIssueCode = (typeof ENGINE_ISSUE_CODES)[number];

export interface EngineIssue {
  /** Stable code — consumers localize by code, not by message. */
  code: EngineIssueCode;
  /** Developer-facing message. */
  message: string;
  meta?: Record<string, string | number>;
}

export type FloorPlanResult = { ok: true; plan: FloorPlan } | { ok: false; issues: EngineIssue[] };
