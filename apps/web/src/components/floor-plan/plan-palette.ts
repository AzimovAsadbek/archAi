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
  /** Slab under the whole footprint, and the fill that erases wall bands. */
  slab: 'var(--color-surface)',
  /** Usable area that no room claims (also the ground of an empty floor). */
  ground: 'var(--color-paper)',
  wall: 'var(--color-ink)',
  /** Door swing arcs, window ticks, stair treads. */
  detail: 'var(--color-ink-soft)',
  /** Dimension lines, extension lines, annotation text. */
  annotation: 'var(--color-ink-faint)',
  label: 'var(--color-ink)',
  corridor: '#f1f0ea',
  corridorHatch: 'rgb(25 26 30 / 0.06)',
  stair: '#eae7e0',
  /** Selected-room ring and its dimension lines — accent-strong (AA on paper). */
  selection: 'var(--color-accent-strong)',
} as const;

/** Soft per-type washes. HALLWAY and OTHER stay deliberately neutral. */
export const ROOM_TINTS: Record<RoomType, string> = {
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
