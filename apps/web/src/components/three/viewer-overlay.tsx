'use client';

import { useTranslations } from 'next-intl';
import { Box, Layers3, Maximize2, Scissors } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Overlay chrome for the 3D visualizer: camera presets, floor/section mode and
 * the facade material matrix. Purely presentational — every control reports a
 * choice upward and none of them touch geometry, which is what keeps the scene
 * derived from the canonical `FloorPlan`.
 *
 * The material matrix changes *finish only*. It cannot move a wall, resize an
 * opening or alter the footprint, so 2D, 3D and the PDF continue to describe
 * the same building no matter which facade is selected.
 */

export const CAMERA_PRESETS = ['orbit', 'top', 'front', 'side', 'iso'] as const;
export type CameraPreset = (typeof CAMERA_PRESETS)[number];

export const VIEW_MODES = ['whole', 'floor', 'section'] as const;
export type ViewMode = (typeof VIEW_MODES)[number];

/**
 * Facade finishes. Each maps to a material preset in the presentation layer;
 * they are finishes a builder would recognise, not arbitrary colour swatches.
 */
export const FACADES = ['concrete', 'stucco', 'brick', 'glass'] as const;
export type Facade = (typeof FACADES)[number];

/** Swatch colours mirror the material presets so the matrix previews truthfully. */
const FACADE_SWATCH: Record<Facade, string> = {
  concrete: '#b9b7ae',
  stucco: '#efece4',
  brick: '#a85436',
  glass: '#8fb0c6',
};

export interface ViewerOverlayProps {
  camera: CameraPreset;
  onCameraChange: (preset: CameraPreset) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  floors: number[];
  activeFloor: number;
  onFloorChange: (index: number) => void;
  facade: Facade;
  onFacadeChange: (facade: Facade) => void;
  onFit: () => void;
  className?: string;
}

const panel =
  'rounded-panel border border-line bg-surface/95 p-1 shadow-card backdrop-blur';
const chip =
  'flex h-8 items-center rounded-tool px-2.5 text-xs font-semibold transition-colors';

export function ViewerOverlay({
  camera,
  onCameraChange,
  viewMode,
  onViewModeChange,
  floors,
  activeFloor,
  onFloorChange,
  facade,
  onFacadeChange,
  onFit,
  className,
}: ViewerOverlayProps) {
  const t = useTranslations('three.overlay');

  return (
    <div
      className={cn('pointer-events-none absolute inset-0 flex flex-col justify-between p-3', className)}
      style={{ zIndex: 'var(--z-canvas-ui)' }}
    >
      {/* ── Top-right: view mode + floor ─────────────────────────────── */}
      <div className="pointer-events-auto flex flex-wrap items-start justify-end gap-2">
        <div className={cn(panel, 'flex items-center gap-0.5')} role="group" aria-label={t('mode')}>
          {VIEW_MODES.map((mode) => {
            const Icon = mode === 'whole' ? Box : mode === 'floor' ? Layers3 : Scissors;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => onViewModeChange(mode)}
                aria-pressed={viewMode === mode}
                title={t(`modes.${mode}`)}
                className={cn(
                  chip,
                  'gap-1.5',
                  viewMode === mode
                    ? 'bg-accent text-white'
                    : 'text-ink-soft hover:bg-paper hover:text-ink',
                )}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">{t(`modes.${mode}`)}</span>
              </button>
            );
          })}
        </div>

        {viewMode !== 'whole' && floors.length > 1 ? (
          <div className={cn(panel, 'flex items-center gap-0.5')} role="group" aria-label={t('floor')}>
            {floors.map((index) => (
              <button
                key={index}
                type="button"
                onClick={() => onFloorChange(index)}
                aria-pressed={activeFloor === index}
                className={cn(
                  chip,
                  'font-mono tabular-nums',
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
      </div>

      {/* ── Bottom: camera presets + facade matrix ───────────────────── */}
      <div className="pointer-events-auto flex flex-wrap items-end justify-between gap-2">
        <div className={cn(panel, 'flex items-center gap-0.5')} role="group" aria-label={t('camera')}>
          {CAMERA_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onCameraChange(preset)}
              aria-pressed={camera === preset}
              className={cn(
                chip,
                camera === preset
                  ? 'bg-accent text-white'
                  : 'text-ink-soft hover:bg-paper hover:text-ink',
              )}
            >
              {t(`cameras.${preset}`)}
            </button>
          ))}
          <button
            type="button"
            onClick={onFit}
            title={t('fit')}
            className="flex size-8 items-center justify-center rounded-tool text-ink-soft transition-colors hover:bg-paper hover:text-ink"
          >
            <Maximize2 className="size-4" aria-hidden="true" />
            <span className="sr-only">{t('fit')}</span>
          </button>
        </div>

        <div className={cn(panel, 'flex items-center gap-1')} role="group" aria-label={t('facade')}>
          {FACADES.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => onFacadeChange(f)}
              aria-pressed={facade === f}
              title={t(`facades.${f}`)}
              className={cn(
                'flex items-center gap-2 rounded-tool py-1 pr-2.5 pl-1 text-xs font-semibold transition-colors',
                facade === f ? 'bg-paper text-ink ring-1 ring-accent' : 'text-ink-soft hover:bg-paper',
              )}
            >
              <span
                aria-hidden="true"
                className="size-5 rounded-[3px] border border-line-strong"
                style={{ background: FACADE_SWATCH[f] }}
              />
              <span className="hidden md:inline">{t(`facades.${f}`)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
