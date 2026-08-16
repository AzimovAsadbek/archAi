import type { FloorGeometry, FloorPlan } from '@archai/floor-plan-engine';
import { cn } from '@/lib/cn';

/**
 * A compact, static rendering of one floor of a real `FloorPlan`.
 *
 * The landing page uses it to show the product's actual output rather than a
 * mock-up: the plan it draws comes from `generateFloorPlan` at render time, so
 * what a visitor sees is exactly what the engine produces. Like the PDF
 * renderer, it is a *view* of the canonical plan and derives no geometry of its
 * own — it reads rects and segments and draws them.
 *
 * Ink-first on purpose (design direction §07): walls are the heaviest mark,
 * rooms carry no type colour, and annotation sits at the lightest weight.
 */
export function PlanSpecimen({
  plan,
  floorIndex = 0,
  className,
  label,
}: {
  plan: FloorPlan;
  floorIndex?: number;
  className?: string;
  label: string;
}) {
  const floor: FloorGeometry | undefined = plan.floors[floorIndex];
  if (!floor) return null;

  const { widthM, lengthM } = plan.house;
  const margin = 1.1;
  const viewBox = `${-margin} ${-margin} ${widthM + margin * 2} ${lengthM + margin * 2}`;

  return (
    <svg
      viewBox={viewBox}
      role="img"
      aria-label={label}
      className={cn('block h-full w-full', className)}
      style={{ background: 'var(--color-surface)' }}
    >
      {/* Slab: the sheet the drawing sits on. */}
      <rect x={0} y={0} width={widthM} height={lengthM} fill="var(--color-surface)" />

      {/* Circulation reads as a faint wash, never as a coloured room. */}
      {floor.corridor ? (
        <rect
          x={floor.corridor.x}
          y={floor.corridor.y}
          width={floor.corridor.width}
          height={floor.corridor.height}
          fill="var(--color-paper)"
        />
      ) : null}

      {/* Rooms: outline only. Colour is reserved for selection in the real
          viewer, so the specimen shows the drawing as an architect would. */}
      {floor.rooms.map((room) => (
        <rect
          key={room.key}
          x={room.rect.x}
          y={room.rect.y}
          width={room.rect.width}
          height={room.rect.height}
          fill="none"
          stroke="var(--color-line-strong)"
          strokeWidth={0.03}
        />
      ))}

      {/* Stairs: tread lines plus the core outline. */}
      {floor.stairs ? (
        <g stroke="var(--color-ink-soft)" strokeWidth={0.035} fill="none">
          <rect
            x={floor.stairs.rect.x}
            y={floor.stairs.rect.y}
            width={floor.stairs.rect.width}
            height={floor.stairs.rect.height}
          />
          {Array.from({ length: 7 }, (_, i) => {
            const step = floor.stairs!.rect.width / 8;
            const x = floor.stairs!.rect.x + step * (i + 1);
            return (
              <line
                key={i}
                x1={x}
                y1={floor.stairs!.rect.y}
                x2={x}
                y2={floor.stairs!.rect.y + floor.stairs!.rect.height}
              />
            );
          })}
        </g>
      ) : null}

      {/* Walls: poché — the heaviest, most legible mark on the sheet. */}
      {floor.walls.map((wall) => (
        <line
          key={wall.id}
          x1={wall.segment.x1}
          y1={wall.segment.y1}
          x2={wall.segment.x2}
          y2={wall.segment.y2}
          stroke="var(--color-ink)"
          strokeWidth={wall.thickness}
          strokeLinecap="square"
        />
      ))}

      {/* Openings erase their span from the wall, then windows get a glazing
          line — the standard way a plan shows a hole in a wall. */}
      {floor.doors.map((door) => (
        <circle
          key={door.id}
          cx={door.center.x}
          cy={door.center.y}
          r={door.width / 2}
          fill="var(--color-surface)"
        />
      ))}
      {floor.windows.map((win) => (
        <g key={win.id}>
          <circle cx={win.center.x} cy={win.center.y} r={win.length / 2} fill="var(--color-surface)" />
          <circle
            cx={win.center.x}
            cy={win.center.y}
            r={win.length / 2}
            fill="none"
            stroke="var(--color-ink-soft)"
            strokeWidth={0.03}
          />
        </g>
      ))}

      {/* Overall dimension, bottom edge — one measurement, lightly drawn. */}
      <g stroke="var(--color-ink-faint)" strokeWidth={0.02} fill="var(--color-ink-faint)">
        <line x1={0} y1={lengthM + 0.55} x2={widthM} y2={lengthM + 0.55} />
        <line x1={0} y1={lengthM + 0.35} x2={0} y2={lengthM + 0.75} />
        <line x1={widthM} y1={lengthM + 0.35} x2={widthM} y2={lengthM + 0.75} />
        <text
          x={widthM / 2}
          y={lengthM + 0.42}
          textAnchor="middle"
          fontSize={0.42}
          stroke="none"
          fill="var(--color-ink-faint)"
        >
          {widthM} m
        </text>
      </g>
    </svg>
  );
}
