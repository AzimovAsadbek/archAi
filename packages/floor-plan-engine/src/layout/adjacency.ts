import type { RoomType } from '@archai/shared';
import type { PlacedRoom, Rect } from '../types';

/**
 * Room-type adjacency preferences (§9/§10). Positive weight = the pair should
 * share a wall; negative = it should not. Weights are heuristics, documented and
 * centralised so they are tunable — this is preliminary space planning, not
 * architectural certification (§32).
 */
export interface AdjacencyPreference {
  a: RoomType;
  b: RoomType;
  weight: number;
}

export const DEFAULT_ADJACENCY: readonly AdjacencyPreference[] = [
  { a: 'KITCHEN', b: 'DINING_ROOM', weight: 1 },
  { a: 'DINING_ROOM', b: 'LIVING_ROOM', weight: 0.8 },
  { a: 'KITCHEN', b: 'LIVING_ROOM', weight: 0.5 },
  { a: 'KITCHEN', b: 'LAUNDRY', weight: 0.5 },
  { a: 'BEDROOM', b: 'BATHROOM', weight: 0.7 },
  { a: 'STORAGE', b: 'KITCHEN', weight: 0.3 },
  // Privacy/noise separations (§32): sleeping away from the social hub.
  { a: 'BEDROOM', b: 'LIVING_ROOM', weight: -0.4 },
  { a: 'BEDROOM', b: 'KITCHEN', weight: -0.3 },
  { a: 'OFFICE', b: 'LIVING_ROOM', weight: -0.2 },
];

/** Minimum shared edge for two rooms to count as adjacent — a door must fit. */
const MIN_SHARED_EDGE_M = 0.9;
const TOUCH_EPS = 0.06;

/** Overlap length of two 1-D intervals. */
function overlap(a1: number, a2: number, b1: number, b2: number): number {
  return Math.min(a2, b2) - Math.max(a1, b1);
}

/**
 * True when two placed rects share a wall long enough for a doorway: they touch
 * on one axis (within the wall-thickness tolerance) and overlap on the other.
 */
export function rectsAdjacent(a: Rect, b: Rect): boolean {
  const touchX =
    Math.abs(a.x + a.width - b.x) <= TOUCH_EPS || Math.abs(b.x + b.width - a.x) <= TOUCH_EPS;
  if (touchX && overlap(a.y, a.y + a.height, b.y, b.y + b.height) >= MIN_SHARED_EDGE_M) return true;

  const touchY =
    Math.abs(a.y + a.height - b.y) <= TOUCH_EPS || Math.abs(b.y + b.height - a.y) <= TOUCH_EPS;
  return touchY && overlap(a.x, a.x + a.width, b.x, b.x + b.width) >= MIN_SHARED_EDGE_M;
}

/**
 * Adjacency score of one floor's placed rooms against the type preferences,
 * normalized to 0..1. Every applicable pair (both types present on the floor)
 * contributes its |weight|; satisfied positive and avoided negative preferences
 * earn it. Floors with no applicable pairs are a neutral 1.
 */
export function adjacencyScore(rooms: readonly PlacedRoom[]): number {
  let earned = 0;
  let possible = 0;

  for (const pref of DEFAULT_ADJACENCY) {
    const as = rooms.filter((room) => room.type === pref.a);
    const bs = rooms.filter((room) => room.type === pref.b);
    for (const roomA of as) {
      for (const roomB of bs) {
        if (roomA.key === roomB.key) continue;
        const adjacent = rectsAdjacent(roomA.rect, roomB.rect);
        possible += Math.abs(pref.weight);
        if (pref.weight > 0 ? adjacent : !adjacent) earned += Math.abs(pref.weight);
      }
    }
  }

  return possible === 0 ? 1 : earned / possible;
}
