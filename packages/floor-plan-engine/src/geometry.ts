import { EPSILON_M } from './constants';
import type { Point, Rect, Segment } from './types';

// ── Numeric hygiene ───────────────────────────────────────────────────────

/**
 * Snap to the 0.01 m grid. A tiny signed nudge keeps binary-representation
 * artefacts (e.g. 2.675 * 100 === 267.49999999999997) from flipping the
 * rounding — the engine must be bit-stable across runs.
 */
export function snap(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const nudge = value >= 0 ? 1e-9 : -1e-9;
  const rounded = Math.round(value * 100 + nudge) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/** Round an area to 0.1 m² (used for every `areaM2` field). */
export function round1(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const nudge = value >= 0 ? 1e-9 : -1e-9;
  const rounded = Math.round(value * 10 + nudge) / 10;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function isPositiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

// ── Epsilon comparisons ───────────────────────────────────────────────────

export function eq(a: number, b: number, eps: number = EPSILON_M): boolean {
  return Math.abs(a - b) <= eps;
}

/** a >= b within tolerance. */
export function gte(a: number, b: number, eps: number = EPSILON_M): boolean {
  return a >= b - eps;
}

/** a <= b within tolerance. */
export function lte(a: number, b: number, eps: number = EPSILON_M): boolean {
  return a <= b + eps;
}

export function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

// ── Rect helpers ──────────────────────────────────────────────────────────

export function rect(x: number, y: number, width: number, height: number): Rect {
  return { x: snap(x), y: snap(y), width: snap(width), height: snap(height) };
}

export function snapRect(r: Rect): Rect {
  return rect(r.x, r.y, r.width, r.height);
}

export function right(r: Rect): number {
  return snap(r.x + r.width);
}

export function bottom(r: Rect): number {
  return snap(r.y + r.height);
}

export function rectArea(r: Rect): number {
  return r.width * r.height;
}

/** Area of the overlap between two rects (0 when they only touch). */
export function intersectionArea(a: Rect, b: Rect): number {
  const overlapX = Math.min(right(a), right(b)) - Math.max(a.x, b.x);
  const overlapY = Math.min(bottom(a), bottom(b)) - Math.max(a.y, b.y);
  if (overlapX <= 0 || overlapY <= 0) return 0;
  return overlapX * overlapY;
}

/** True when `inner` lies inside `outer` (tolerant by `eps`). */
export function rectContains(outer: Rect, inner: Rect, eps: number = EPSILON_M): boolean {
  return (
    gte(inner.x, outer.x, eps) &&
    gte(inner.y, outer.y, eps) &&
    lte(right(inner), right(outer), eps) &&
    lte(bottom(inner), bottom(outer), eps)
  );
}

// ── Shared edges ──────────────────────────────────────────────────────────

export type EdgeOrientation = 'vertical' | 'horizontal';

export interface SharedEdge {
  orientation: EdgeOrientation;
  /** x for a vertical edge, y for a horizontal edge. */
  at: number;
  /** Start of the overlap along the edge (y for vertical, x for horizontal). */
  from: number;
  to: number;
  length: number;
}

/**
 * The edge two rects share, or null when they do not touch along a segment.
 * Corner-only contact returns null (overlap must exceed the epsilon).
 */
export function sharedEdge(a: Rect, b: Rect): SharedEdge | null {
  const aRight = right(a);
  const bRight = right(b);
  const aBottom = bottom(a);
  const bBottom = bottom(b);

  if (eq(aRight, b.x) || eq(bRight, a.x)) {
    const at = eq(aRight, b.x) ? aRight : a.x;
    const from = Math.max(a.y, b.y);
    const to = Math.min(aBottom, bBottom);
    if (to - from > EPSILON_M) {
      return {
        orientation: 'vertical',
        at: snap(at),
        from: snap(from),
        to: snap(to),
        length: snap(to - from),
      };
    }
  }

  if (eq(aBottom, b.y) || eq(bBottom, a.y)) {
    const at = eq(aBottom, b.y) ? aBottom : a.y;
    const from = Math.max(a.x, b.x);
    const to = Math.min(aRight, bRight);
    if (to - from > EPSILON_M) {
      return {
        orientation: 'horizontal',
        at: snap(at),
        from: snap(from),
        to: snap(to),
        length: snap(to - from),
      };
    }
  }

  return null;
}

/** Canonical key for an edge — used to deduplicate walls. */
export function edgeKey(edge: SharedEdge): string {
  return `${edge.orientation}|${edge.at.toFixed(2)}|${edge.from.toFixed(2)}|${edge.to.toFixed(2)}`;
}

export function edgeToSegment(edge: SharedEdge): Segment {
  return edge.orientation === 'vertical'
    ? { x1: edge.at, y1: edge.from, x2: edge.at, y2: edge.to }
    : { x1: edge.from, y1: edge.at, x2: edge.to, y2: edge.at };
}

export function edgeMidpoint(edge: SharedEdge): Point {
  const mid = snap((edge.from + edge.to) / 2);
  return edge.orientation === 'vertical' ? { x: edge.at, y: mid } : { x: mid, y: edge.at };
}

// ── Segment helpers ───────────────────────────────────────────────────────

export function segment(x1: number, y1: number, x2: number, y2: number): Segment {
  return { x1: snap(x1), y1: snap(y1), x2: snap(x2), y2: snap(y2) };
}

export function segmentOrientation(s: Segment): EdgeOrientation | null {
  if (eq(s.x1, s.x2)) return 'vertical';
  if (eq(s.y1, s.y2)) return 'horizontal';
  return null;
}

export function segmentLength(s: Segment): number {
  return Math.abs(s.x2 - s.x1) + Math.abs(s.y2 - s.y1);
}

/** True when `p` lies on the axis-aligned segment `s` (tolerant by `eps`). */
export function pointOnSegment(p: Point, s: Segment, eps: number = EPSILON_M): boolean {
  const orientation = segmentOrientation(s);
  if (orientation === 'vertical') {
    const lo = Math.min(s.y1, s.y2);
    const hi = Math.max(s.y1, s.y2);
    return eq(p.x, s.x1, eps) && gte(p.y, lo, eps) && lte(p.y, hi, eps);
  }
  if (orientation === 'horizontal') {
    const lo = Math.min(s.x1, s.x2);
    const hi = Math.max(s.x1, s.x2);
    return eq(p.y, s.y1, eps) && gte(p.x, lo, eps) && lte(p.x, hi, eps);
  }
  return false;
}

// ── 1-D interval helpers (opening placement along a wall run) ─────────────

export interface Interval {
  from: number;
  to: number;
}

export function intervalLength(i: Interval): number {
  return snap(i.to - i.from);
}

export function intervalsOverlap(a: Interval, b: Interval, eps: number = EPSILON_M): boolean {
  return Math.min(a.to, b.to) - Math.max(a.from, b.from) > eps;
}

/**
 * `span` minus every interval in `blockers`, in ascending order.
 * Used to keep windows off door spans on the same wall.
 */
export function subtractIntervals(span: Interval, blockers: Interval[]): Interval[] {
  const sorted = blockers
    .filter((b) => intervalsOverlap(span, b, 0))
    .slice()
    .sort((a, b) => a.from - b.from || a.to - b.to);

  const free: Interval[] = [];
  let cursor = span.from;
  for (const blocker of sorted) {
    const start = Math.max(blocker.from, span.from);
    const end = Math.min(blocker.to, span.to);
    if (start - cursor > EPSILON_M) free.push({ from: snap(cursor), to: snap(start) });
    cursor = Math.max(cursor, end);
  }
  if (span.to - cursor > EPSILON_M) free.push({ from: snap(cursor), to: snap(span.to) });
  return free;
}
