'use client';

import { useTranslations } from 'next-intl';
import { Hand, Layers, Maximize2, MousePointer2, Ruler, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Floating CAD viewport toolbar.
 *
 * Sits over the drawing rather than above it, so the canvas keeps the full
 * frame. Only tools that are actually wired appear enabled — `measure` is
 * rendered but marked unavailable until the measurement layer ships, because a
 * toolbar that offers a dead instrument is worse than one that admits the gap.
 */

export type PlanTool = 'select' | 'pan' | 'measure';

export interface ViewportToolbarProps {
  tool: PlanTool;
  onToolChange: (tool: PlanTool) => void;
  /** Tools that exist in the UI but are not implemented yet. */
  unavailableTools?: readonly PlanTool[];
  floors: number[];
  activeFloor: number;
  onFloorChange: (index: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  layersOpen: boolean;
  onLayersToggle: () => void;
  className?: string;
}

const TOOLS: { id: PlanTool; icon: typeof MousePointer2 }[] = [
  { id: 'select', icon: MousePointer2 },
  { id: 'pan', icon: Hand },
  { id: 'measure', icon: Ruler },
];

export function ViewportToolbar({
  tool,
  onToolChange,
  unavailableTools = [],
  floors,
  activeFloor,
  onFloorChange,
  onZoomIn,
  onZoomOut,
  onFit,
  layersOpen,
  onLayersToggle,
  className,
}: ViewportToolbarProps) {
  const t = useTranslations('plan.viewport');

  const group =
    'flex items-center gap-0.5 rounded-panel border border-line bg-surface/95 p-1 shadow-card backdrop-blur';
  const btn =
    'flex size-8 items-center justify-center rounded-tool text-ink-soft transition-colors hover:bg-paper hover:text-ink disabled:opacity-35 disabled:hover:bg-transparent';
  const btnActive = 'bg-accent text-white hover:bg-accent hover:text-white';

  return (
    <div
      className={cn('flex flex-wrap items-center justify-center gap-2', className)}
      style={{ zIndex: 'var(--z-canvas-ui)' }}
    >
      {/* Tools */}
      <div className={group} role="group" aria-label={t('tools')}>
        {TOOLS.map(({ id, icon: Icon }) => {
          const unavailable = unavailableTools.includes(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => onToolChange(id)}
              disabled={unavailable}
              aria-pressed={tool === id}
              title={unavailable ? `${t(id)} — ${t('soon')}` : t(id)}
              className={cn(btn, tool === id && !unavailable && btnActive)}
            >
              <Icon className="size-4" aria-hidden="true" />
              <span className="sr-only">{t(id)}</span>
            </button>
          );
        })}
      </div>

      {/* Zoom */}
      <div className={group} role="group" aria-label={t('zoom')}>
        <button type="button" onClick={onZoomOut} className={btn} title={t('zoomOut')}>
          <ZoomOut className="size-4" aria-hidden="true" />
          <span className="sr-only">{t('zoomOut')}</span>
        </button>
        <button type="button" onClick={onZoomIn} className={btn} title={t('zoomIn')}>
          <ZoomIn className="size-4" aria-hidden="true" />
          <span className="sr-only">{t('zoomIn')}</span>
        </button>
        <button type="button" onClick={onFit} className={btn} title={t('fit')}>
          <Maximize2 className="size-4" aria-hidden="true" />
          <span className="sr-only">{t('fit')}</span>
        </button>
      </div>

      {/* Floors — only when there is more than one to choose between. */}
      {floors.length > 1 ? (
        <div className={group} role="group" aria-label={t('floor')}>
          {floors.map((index) => (
            <button
              key={index}
              type="button"
              onClick={() => onFloorChange(index)}
              aria-pressed={activeFloor === index}
              className={cn(
                'h-8 min-w-8 rounded-tool px-2 font-mono text-xs font-semibold tabular-nums transition-colors',
                activeFloor === index
                  ? 'bg-accent text-white'
                  : 'text-ink-soft hover:bg-paper hover:text-ink',
              )}
            >
              {index + 1}
            </button>
          ))}
        </div>
      ) : null}

      {/* Layers */}
      <div className={group}>
        <button
          type="button"
          onClick={onLayersToggle}
          aria-pressed={layersOpen}
          title={t('layers')}
          className={cn(btn, layersOpen && btnActive)}
        >
          <Layers className="size-4" aria-hidden="true" />
          <span className="sr-only">{t('layers')}</span>
        </button>
      </div>
    </div>
  );
}

/**
 * Bottom status line: scale, sheet size and live cursor position. Mono and
 * tabular so the numbers do not jitter as the pointer moves.
 */
export function ViewportStatus({
  scaleLabel,
  widthM,
  lengthM,
  zoomPercent,
  cursor,
  className,
}: {
  scaleLabel: string;
  widthM: number;
  lengthM: number;
  zoomPercent: number;
  /** Null when the pointer is outside the sheet. */
  cursor: { x: number; y: number } | null;
  className?: string;
}) {
  const t = useTranslations('plan.viewport');
  return (
    <div
      className={cn(
        'flex h-7 shrink-0 items-center gap-4 overflow-x-auto border-t border-line bg-surface px-3 font-mono text-[11px] tabular-nums text-ink-faint',
        className,
      )}
    >
      <span className="shrink-0">
        {t('scaleLabel')} {scaleLabel}
      </span>
      <span className="shrink-0">
        {widthM} × {lengthM} m
      </span>
      <span className="shrink-0">
        {t('zoomLabel')} {Math.round(zoomPercent)}%
      </span>
      <span className="ml-auto shrink-0 tabular-nums">
        {cursor ? `X ${cursor.x.toFixed(2)}  Y ${cursor.y.toFixed(2)}` : 'X —.——  Y —.——'}
      </span>
    </div>
  );
}
