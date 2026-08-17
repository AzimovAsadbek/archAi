import { type RoomType } from '@archai/shared';

/**
 * Every colour the floor plan draws with, in one place.
 *
 * Structure colours reference the design tokens directly (Tailwind v4 `@theme`
 * emits them as real CSS custom properties, so `var(--color-ink)` resolves
 * inside SVG paint attributes). Room tints are light washes hand-derived from
 * the same palette — accent terracotta, info blue, success green, warning
 * amber — kept pale enough that the ink linework stays dominant.
 */
export const PLAN_COLORS = {
  /** Vellum sheet under the whole footprint. */
  slab: '#FBFBFA',
  /** Usable area that no room claims (also the ground of an empty floor). */
  ground: '#F4F4F0',
  /** Poché — structural walls are solid obsidian, the heaviest mark on the sheet. */
  wall: '#1A1A18',
  /** Hatch strokes drawn inside the poché at drafting density. */
  wallHatch: 'rgb(251 251 250 / 0.22)',
  /** Property boundary: dash-dot, the surveyor's line. */
  boundary: '#999990',
  /** Door swing arcs, window ticks, stair treads. */
  detail: 'var(--color-ink-soft)',
  /** Dimension lines, extension lines, annotation text. */
  annotation: '#666660',
  label: '#1A1A18',
  /** Circulation reads as a hatch wash, never as a coloured room. */
  corridor: 'transparent',
  corridorHatch: 'rgb(26 26 24 / 0.07)',
  stair: 'rgb(26 26 24 / 0.04)',
  /** Selected-room ring and its dimension lines — accent-strong (AA on paper). */
  selection: 'var(--color-draw-accent-strong)',
  /** The only room fill in the drawing: hover and active selection. */
  roomHover: 'rgb(200 90 50 / 0.05)',
  roomActive: 'rgb(200 90 50 / 0.08)',
} as const;

/**
 * Room fills are transparent by default.
 *
 * The drawing is ink on vellum: a plan whose every room is a pastel rectangle
 * reads as an infographic, not as architecture. Colour now carries exactly one
 * meaning — this room is hovered or selected — so a coloured shape on the sheet
 * is always the answer to "which room am I looking at", never decoration.
 *
 * The per-type washes are kept below rather than deleted: they remain useful
 * for a first-time reader scanning for bedrooms, and become an opt-in layer.
 */
export const ROOM_TINTS: Record<RoomType, string> = {
  LIVING_ROOM: 'transparent',
  BEDROOM: 'transparent',
  KITCHEN: 'transparent',
  DINING_ROOM: 'transparent',
  OFFICE: 'transparent',
  BATHROOM: 'transparent',
  LAUNDRY: 'transparent',
  STORAGE: 'transparent',
  HALLWAY: 'transparent',
  OTHER: 'transparent',
};

/** The former defaults, available as the opt-in "room types" layer. */
export const ROOM_TYPE_TINTS: Record<RoomType, string> = {
  LIVING_ROOM: '#f8e7db',
  BEDROOM: '#e8eef8',
  KITCHEN: '#faf1dd',
  DINING_ROOM: '#eef3e1',
  OFFICE: '#ebe9f6',
  BATHROOM: '#e1eff2',
  LAUNDRY: '#e6f1ea',
  STORAGE: '#f0ece4',
  HALLWAY: '#f1f0ea',
  OTHER: '#f1f0ea',
};

/** Stable legend / chip order — most-used living spaces first. */
export const ROOM_TYPE_ORDER: readonly RoomType[] = [
  'LIVING_ROOM',
  'BEDROOM',
  'KITCHEN',
  'DINING_ROOM',
  'OFFICE',
  'BATHROOM',
  'LAUNDRY',
  'STORAGE',
  'HALLWAY',
  'OTHER',
];
