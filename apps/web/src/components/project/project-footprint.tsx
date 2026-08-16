import { type HouseStyle } from '@archai/shared';
import { cn } from '@/lib/cn';

/**
 * The plot-and-footprint diagram every project card leads with.
 *
 * It draws only what the project's *configuration* states — the plot, the
 * building outline on it, and one storey line per floor. It deliberately lays
 * out no rooms, so it is not a second geometry system competing with the
 * canonical `FloorPlan`; room geometry stays the engine's exclusive output and
 * is only ever shown by the 2D viewer, the 3D scene and the PDF.
 *
 * Pure and server-renderable: no hooks, no measurement, no data fetching. A
 * card renders it from the list payload it already has, so a twenty-project
 * dashboard costs zero extra requests.
 */

export interface ProjectFootprintProps {
  landAreaM2: number | null;
  houseWidthM: number | null;
  houseLengthM: number | null;
  floorCount: number | null;
  style?: HouseStyle | null;
  className?: string;
  /** Accessible description; cards pass the project name for context. */
  label: string;
}

/** Viewport of the diagram, in abstract units. */
const VIEW_W = 320;
const VIEW_H = 180;
const PAD = 16;

export function ProjectFootprint({
  landAreaM2,
  houseWidthM,
  houseLengthM,
  floorCount,
  className,
  label,
}: ProjectFootprintProps) {
  const hasHouse =
    typeof houseWidthM === 'number' &&
    typeof houseLengthM === 'number' &&
    houseWidthM > 0 &&
    houseLengthM > 0;

  // The plot is drawn square-ish because only its area is known — the API does
  // not carry plot proportions. Showing an invented rectangle would imply a
  // shape the user never entered, so a square reads as "area, not shape".
  const plotSide = typeof landAreaM2 === 'number' && landAreaM2 > 0 ? Math.sqrt(landAreaM2) : null;

  const plotW = VIEW_W - PAD * 2;
  const plotH = VIEW_H - PAD * 2;

  // Scale the house into the plot by real area ratio when both are known, so a
  // large house on a small plot genuinely looks tight.
  let houseRect: { x: number; y: number; w: number; h: number } | null = null;
  if (hasHouse) {
    const ratio = houseWidthM / houseLengthM;
    const coverage =
      plotSide !== null ? Math.min(0.86, Math.sqrt((houseWidthM * houseLengthM) / (plotSide * plotSide))) : 0.62;
    const maxW = plotW * coverage;
    const maxH = plotH * coverage;
    // Fit the real aspect ratio inside that budget.
    let w = maxW;
    let h = w / ratio;
    if (h > maxH) {
      h = maxH;
      w = h * ratio;
    }
    houseRect = { x: PAD + (plotW - w) / 2, y: PAD + (plotH - h) / 2, w, h };
  }

  const storeys = Math.max(0, Math.min(3, floorCount ?? 0));

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      role="img"
      aria-label={label}
      preserveAspectRatio="xMidYMid slice"
      className={cn('block h-full w-full bg-paper', className)}
    >
      <defs>
        <pattern id="fp-grid" width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M16 0H0V16" fill="none" stroke="var(--color-line)" strokeWidth="0.5" />
        </pattern>
      </defs>

      {/* Site grid — the drafting-paper ground the plot sits on. */}
      <rect width={VIEW_W} height={VIEW_H} fill="url(#fp-grid)" />

      {/* Plot boundary: dashed, the surveyor's convention for a property line. */}
      <rect
        x={PAD}
        y={PAD}
        width={plotW}
        height={plotH}
        fill="none"
        stroke="var(--color-line-strong)"
        strokeWidth="1.25"
        strokeDasharray="7 4"
      />

      {houseRect ? (
        <g>
          {/* Storey lines, offset up-left, read as floors stacked behind. */}
          {Array.from({ length: Math.max(0, storeys - 1) }, (_, i) => (
            <rect
              key={i}
              x={houseRect.x - (i + 1) * 4}
              y={houseRect.y - (i + 1) * 4}
              width={houseRect.w}
              height={houseRect.h}
              fill="none"
              stroke="var(--color-line-strong)"
              strokeWidth="1"
            />
          ))}
          {/* The building itself: solid ink, the heaviest mark in the diagram. */}
          <rect
            x={houseRect.x}
            y={houseRect.y}
            width={houseRect.w}
            height={houseRect.h}
            fill="var(--color-surface)"
            stroke="var(--color-ink)"
            strokeWidth="2.25"
          />
          {/* Entrance notch on the lower edge — orients the building. */}
          <line
            x1={houseRect.x + houseRect.w / 2 - 11}
            y1={houseRect.y + houseRect.h}
            x2={houseRect.x + houseRect.w / 2 + 11}
            y2={houseRect.y + houseRect.h}
            stroke="var(--color-accent)"
            strokeWidth="3"
          />
        </g>
      ) : (
        // A draft with no footprint yet: the plot alone, and an honest empty
        // centre rather than a placeholder house the project does not have.
        <text
          x={VIEW_W / 2}
          y={VIEW_H / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--color-ink-faint)"
          fontSize="12"
        >
          —
        </text>
      )}
    </svg>
  );
}
