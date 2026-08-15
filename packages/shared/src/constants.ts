/** 1 sotix (сотка) = 100 m². Common land unit in Uzbekistan. */
export const SOTIX_IN_M2 = 100;

export const LIMITS = {
  land: {
    /** m² — 1 sotix minimum */
    minAreaM2: 100,
    /** m² — 100 sotix maximum for residential */
    maxAreaM2: 10_000,
    minSideM: 5,
    maxSideM: 200,
  },
  house: {
    minSideM: 4,
    maxSideM: 60,
    /** Warn when the footprint covers more than this share of the land. */
    warnCoverageRatio: 0.7,
  },
  floors: { min: 1, max: 3 },
  rooms: {
    maxPerProject: 40,
    minSideM: 1,
    maxSideM: 30,
    /** Warn when room area exceeds this share of a floor plate (walls need space). */
    warnFloorFillRatio: 0.85,
  },
  project: {
    nameMin: 2,
    nameMax: 120,
    descriptionMax: 2000,
  },
  auth: {
    passwordMin: 8,
    passwordMax: 128,
    fullNameMin: 2,
    fullNameMax: 100,
  },
} as const;

export const HOUSE_STYLES = [
  'MODERN',
  'MINIMALIST',
  'CLASSIC',
  'TRADITIONAL',
  'EUROPEAN',
  'NATIONAL',
] as const;
export type HouseStyle = (typeof HOUSE_STYLES)[number];

/**
 * Layout optimization policies (docs/decisions/adr-008). Declared here — the
 * contract layer — because the floor-plan engine optimizes with them, the AI
 * proposes them and the web displays them. The engine re-exports this union.
 */
export const LAYOUT_STRATEGIES = ['BALANCED', 'COMPACT', 'OPEN', 'PRIVACY', 'FAMILY'] as const;
export type LayoutStrategy = (typeof LAYOUT_STRATEGIES)[number];

export const ROOM_TYPES = [
  'BEDROOM',
  'LIVING_ROOM',
  'KITCHEN',
  'BATHROOM',
  'DINING_ROOM',
  'OFFICE',
  'STORAGE',
  'LAUNDRY',
  'HALLWAY',
  'OTHER',
] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

export const PROJECT_STATUSES = [
  'DRAFT',
  'CONFIGURED',
  'GENERATING',
  'READY',
  'ARCHIVED',
  'FAILED',
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const USER_ROLES = ['USER', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];
