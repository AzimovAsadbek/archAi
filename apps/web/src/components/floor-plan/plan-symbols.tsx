import { type ReactNode } from 'react';
import {
  type Door,
  type FloorPlanWindow,
  type Stair,
  type Wall,
} from '@archai/floor-plan-engine';
import { PLAN_COLORS } from './plan-palette';

/** Wall segments are axis-aligned centre lines, so orientation is a comparison. */
export function isHorizontalWall(wall: Wall): boolean {
  return Math.abs(wall.segment.y2 - wall.segment.y1) < 1e-6;
}

/** Hairlines keep a constant on-screen weight at every zoom level. */
const HAIRLINE = { vectorEffect: 'non-scaling-stroke' } as const;

/**
 * Erases the wall band across an opening so the plan reads as a real gap.
 * The extra 0.02 m hides anti-aliasing seams against the wall stroke.
 */
function OpeningGap({
  wall,
  x1,
  y1,
  x2,
  y2,
}: {
  wall: Wall;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}) {
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={PLAN_COLORS.slab}
      strokeWidth={wall.thickness + 0.02}
      strokeLinecap="butt"
    />
  );
}

export interface DoorSymbolProps {
  door: Door;
  wall: Wall;
  /** Direction the leaf swings, along the wall normal: +1 or -1. */
  swing: 1 | -1;
  title?: ReactNode;
}

/** Opening gap + hinge leaf + quarter-circle swing arc. */
export function DoorSymbol({ door, wall, swing, title }: DoorSymbolProps) {
  const horizontal = isHorizontalWall(wall);
  const half = door.width / 2;
  const { x, y } = door.center;

  const hinge = horizontal ? { x: x - half, y } : { x, y: y - half };
  const jamb = horizontal ? { x: x + half, y } : { x, y: y + half };
  const tip = horizontal
    ? { x: hinge.x, y: hinge.y + swing * door.width }
    : { x: hinge.x + swing * door.width, y: hinge.y };

  // The arc always spans exactly a quarter turn; its direction decides the flag.
  const fromAngle = Math.atan2(jamb.y - hinge.y, jamb.x - hinge.x);
  const toAngle = Math.atan2(tip.y - hinge.y, tip.x - hinge.x);
  let delta = toAngle - fromAngle;
  while (delta <= -Math.PI) delta += Math.PI * 2;
  while (delta > Math.PI) delta -= Math.PI * 2;
  const sweep = delta > 0 ? 1 : 0;

  return (
    <g>
      {title}
      <OpeningGap wall={wall} x1={hinge.x} y1={hinge.y} x2={jamb.x} y2={jamb.y} />
      <path
        d={`M ${jamb.x} ${jamb.y} A ${door.width} ${door.width} 0 0 ${sweep} ${tip.x} ${tip.y}`}
        fill="none"
        stroke={PLAN_COLORS.annotation}
        strokeWidth={1}
        {...HAIRLINE}
      />
      <line
        x1={hinge.x}
        y1={hinge.y}
        x2={tip.x}
        y2={tip.y}
        stroke={PLAN_COLORS.detail}
        strokeWidth={1.5}
        {...HAIRLINE}
      />
    </g>
  );
}

export interface WindowSymbolProps {
  window: FloorPlanWindow;
  wall: Wall;
  title?: ReactNode;
}

/** Opening gap + the two wall-face lines + end ticks across the wall. */
export function WindowSymbol({ window: opening, wall, title }: WindowSymbolProps) {
  const horizontal = isHorizontalWall(wall);
  const half = opening.length / 2;
  const face = wall.thickness / 2;
  const { x, y } = opening.center;

  const start = horizontal ? { x: x - half, y } : { x, y: y - half };
  const end = horizontal ? { x: x + half, y } : { x, y: y + half };
  const offset = horizontal ? { x: 0, y: face } : { x: face, y: 0 };

  return (
    <g>
      {title}
      <OpeningGap wall={wall} x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
      {[1, -1].map((side) => (
        <line
          key={side}
          x1={start.x + offset.x * side}
          y1={start.y + offset.y * side}
          x2={end.x + offset.x * side}
          y2={end.y + offset.y * side}
          stroke={PLAN_COLORS.detail}
          strokeWidth={1}
          {...HAIRLINE}
        />
      ))}
      {[start, end].map((point, index) => (
        <line
          key={index}
          x1={point.x - offset.x}
          y1={point.y - offset.y}
          x2={point.x + offset.x}
          y2={point.y + offset.y}
          stroke={PLAN_COLORS.detail}
          strokeWidth={1}
          {...HAIRLINE}
        />
      ))}
    </g>
  );
}

/** Triangle pointing along the unit vector (dx, dy). */
export function arrowHead(x: number, y: number, dx: number, dy: number, size: number): string {
  const wingX = -dy * size * 0.4;
  const wingY = dx * size * 0.4;
  const baseX = x - dx * size;
  const baseY = y - dy * size;
  return `M ${x} ${y} L ${baseX + wingX} ${baseY + wingY} L ${baseX - wingX} ${baseY - wingY} Z`;
}

export interface StairsSymbolProps {
  stairs: Stair;
  title?: ReactNode;
}

/** Stair core: treads across the run plus a direction arrow along it. */
export function StairsSymbol({ stairs, title }: StairsSymbolProps) {
  const { rect, direction } = stairs;
  const alongX = rect.width >= rect.height;
  const runLength = alongX ? rect.width : rect.height;
  const treads = Math.max(3, Math.min(12, Math.round(runLength / 0.32)));
  const step = runLength / treads;

  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  const inset = Math.min(runLength * 0.14, 0.35);
  const arrowSize = Math.min(0.3, runLength * 0.12);

  const startPoint = alongX
    ? { x: rect.x + inset, y: centerY }
    : { x: centerX, y: rect.y + inset };
  const endPoint = alongX
    ? { x: rect.x + rect.width - inset, y: centerY }
    : { x: centerX, y: rect.y + rect.height - inset };

  const heads: string[] = [];
  const forward = alongX ? { dx: 1, dy: 0 } : { dx: 0, dy: 1 };
  if (direction === 'up' || direction === 'both') {
    heads.push(arrowHead(endPoint.x, endPoint.y, forward.dx, forward.dy, arrowSize));
  }
  if (direction === 'down' || direction === 'both') {
    heads.push(arrowHead(startPoint.x, startPoint.y, -forward.dx, -forward.dy, arrowSize));
  }

  return (
    <g>
      {title}
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        fill={PLAN_COLORS.stair}
      />
      {Array.from({ length: treads - 1 }, (_, index) => {
        const at = (index + 1) * step;
        return alongX ? (
          <line
            key={index}
            x1={rect.x + at}
            y1={rect.y}
            x2={rect.x + at}
            y2={rect.y + rect.height}
            stroke={PLAN_COLORS.detail}
            strokeWidth={1}
            {...HAIRLINE}
          />
        ) : (
          <line
            key={index}
            x1={rect.x}
            y1={rect.y + at}
            x2={rect.x + rect.width}
            y2={rect.y + at}
            stroke={PLAN_COLORS.detail}
            strokeWidth={1}
            {...HAIRLINE}
          />
        );
      })}
      <line
        x1={startPoint.x}
        y1={startPoint.y}
        x2={endPoint.x}
        y2={endPoint.y}
        stroke={PLAN_COLORS.wall}
        strokeWidth={1.5}
        {...HAIRLINE}
      />
      {heads.map((path, index) => (
        <path key={index} d={path} fill={PLAN_COLORS.wall} />
      ))}
    </g>
  );
}

export interface DimensionProps {
  orientation: 'horizontal' | 'vertical';
  /** Along-axis extent being measured. */
  from: number;
  to: number;
  /** Footprint edge the extension lines start from. */
  edge: number;
  /** Signed distance from `edge` to the dimension line. */
  offset: number;
  label: string;
  /** Arrow size and font size, in metres, pre-scaled for constant screen size. */
  arrow: number;
  font: number;
}

/** Architectural dimension: extension lines, arrowed line, centred label. */
export function Dimension({
  orientation,
  from,
  to,
  edge,
  offset,
  label,
  arrow,
  font,
}: DimensionProps) {
  const horizontal = orientation === 'horizontal';
  const line = edge + offset;
  const overshoot = Math.sign(offset) * arrow * 0.9;
  const middle = (from + to) / 2;

  const point = (along: number, across: number) =>
    horizontal ? { x: along, y: across } : { x: across, y: along };

  const lineStart = point(from, line);
  const lineEnd = point(to, line);
  const forward = horizontal ? { dx: 1, dy: 0 } : { dx: 0, dy: 1 };
  // Glyphs grow away from the baseline in −y, which rotate(-90) turns into −x,
  // so the same offset lifts a horizontal label and left-shifts a vertical one.
  const labelAnchor = point(middle, line - font * 0.45);

  return (
    <g>
      {[from, to].map((along) => {
        const a = point(along, edge);
        const b = point(along, line + overshoot);
        return (
          <line
            key={along}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={PLAN_COLORS.annotation}
            strokeWidth={1}
            strokeDasharray="3 3"
            {...HAIRLINE}
          />
        );
      })}
      <line
        x1={lineStart.x}
        y1={lineStart.y}
        x2={lineEnd.x}
        y2={lineEnd.y}
        stroke={PLAN_COLORS.annotation}
        strokeWidth={1}
        {...HAIRLINE}
      />
      <path
        d={arrowHead(lineEnd.x, lineEnd.y, forward.dx, forward.dy, arrow)}
        fill={PLAN_COLORS.annotation}
      />
      <path
        d={arrowHead(lineStart.x, lineStart.y, -forward.dx, -forward.dy, arrow)}
        fill={PLAN_COLORS.annotation}
      />
      <text
        className="numeric"
        x={labelAnchor.x}
        y={labelAnchor.y}
        fill={PLAN_COLORS.annotation}
        fontSize={font}
        fontWeight={600}
        textAnchor="middle"
        transform={horizontal ? undefined : `rotate(-90 ${labelAnchor.x} ${labelAnchor.y})`}
      >
        {label}
      </text>
    </g>
  );
}
