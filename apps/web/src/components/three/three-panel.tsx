'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { Info, RotateCcw } from 'lucide-react';
import { type FeaturesConfig, type HouseStyle, type LandConfig } from '@archai/shared';
import { FloorPlanErrorState, useFloorPlanQuery } from '@/components/floor-plan/floor-plan-query';
import { IconButton } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/cn';
import { buildScene } from './scene-builder';
import { CAMERA_PRESETS, type CameraPreset } from './camera-presets';

/**
 * The 3D tab. Mirrors `floor-plan-panel` — same query, same failure states —
 * and differs only in what it draws: a schematic massing model derived from the
 * very same persisted plan the 2D drawing uses.
 *
 * three.js never reaches the main bundle: the canvas is behind `next/dynamic`
 * with `ssr: false`, and the workspace unmounts this panel when the tab loses
 * focus, so the WebGL context is released with it.
 */

function SceneFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-paper">
      <Spinner className="size-6 text-ink-faint" />
    </div>
  );
}

const HouseScene = dynamic(() => import('./house-scene').then((module) => module.HouseScene), {
  ssr: false,
  loading: SceneFallback,
});

function PanelSkeleton() {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-10 w-52" />
        <Skeleton className="h-10 w-10" />
      </div>
      <Skeleton className="mt-3 aspect-[4/3] w-full rounded-md" />
      <Skeleton className="mt-4 h-10 w-full rounded-md" />
    </div>
  );
}

/** `'all'` shows the whole house; any other value is a floor index to cut away at. */
const WHOLE_HOUSE = 'all';

export interface ThreePanelProps {
  projectId: string;
  /** Regenerating the plan follows the project — a new value refetches. */
  projectUpdatedAt: string;
  /** Plot dimensions for the land plate; the model falls back to a margin. */
  land: LandConfig | null;
  /**
   * What the project asked for. These place the garage, terrace, pool and
   * balcony on the plot — before they were passed through, ticking "garage"
   * changed the estimate and the PDF's feature list while the preview kept
   * showing an empty lawn.
   */
  features: FeaturesConfig | null;
  /** Project style — tunes 3D materials only, never geometry. */
  style: HouseStyle | null;
  className?: string;
}

export function ThreePanel({
  projectId,
  projectUpdatedAt,
  land,
  features,
  style,
  className,
}: ThreePanelProps) {
  const t = useTranslations('three');
  const query = useFloorPlanQuery(projectId, projectUpdatedAt);

  const [visibility, setVisibility] = useState<string>(WHOLE_HOUSE);
  const [preset, setPreset] = useState<CameraPreset>('orbit');
  const [resetToken, setResetToken] = useState(0);

  const model = useMemo(
    () => (query.data ? buildScene(query.data.plan, { land, features }) : null),
    [query.data, land, features],
  );

  const floorCount = model?.house.floorCount ?? 1;

  // A regenerated plan can have fewer floors than the cutaway being viewed.
  useEffect(() => {
    setVisibility((current) =>
      current === WHOLE_HOUSE || Number(current) < floorCount ? current : WHOLE_HOUSE,
    );
  }, [floorCount]);

  if (query.isPending) return <PanelSkeleton />;

  if (query.isError) {
    return (
      <FloorPlanErrorState
        className={className}
        projectId={projectId}
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  }

  if (!model) return null;

  const cutawayIndex = visibility === WHOLE_HOUSE ? null : Number(visibility);
  const visibleFloorCount = cutawayIndex === null ? floorCount : cutawayIndex + 1;

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select
          label={t('floors.label')}
          value={visibility}
          onChange={(next) => setVisibility(String(next))}
          className="w-auto min-w-52"
          options={[
            { value: WHOLE_HOUSE, label: t('floors.all') },
            ...model.floors.map((floor) => ({
              value: String(floor.index),
              label: t('floors.cutaway', { floor: floor.index + 1 }),
            })),
          ]}
        />

        <div className="flex flex-wrap items-center gap-1.5">
          <div
            role="group"
            aria-label={t('presets.label')}
            className="inline-flex items-center gap-0.5 rounded-panel border border-line-strong bg-surface p-0.5"
          >
            {CAMERA_PRESETS.map((name) => (
              <button
                key={name}
                type="button"
                aria-pressed={preset === name}
                onClick={() => {
                  setPreset(name);
                  // Re-frame even when the same preset is pressed again.
                  setResetToken((token) => token + 1);
                }}
                className={cn(
                  'rounded-sm px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors',
                  preset === name
                    ? 'bg-ink text-paper'
                    : 'text-ink-soft hover:bg-paper hover:text-ink',
                )}
              >
                {t(`presets.${name}`)}
              </button>
            ))}
          </div>
          <IconButton
            variant="outline"
            aria-label={t('resetView')}
            title={t('resetView')}
            onClick={() => setResetToken((token) => token + 1)}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
          </IconButton>
        </div>
      </div>

      <div className="relative mt-3 overflow-hidden rounded-panel border border-line bg-paper">
        <span
          title={t('disclaimerBody')}
          className="absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 rounded-sm border border-line bg-surface/90 px-2 py-1 text-[11px] font-semibold text-ink-soft"
        >
          <Info className="size-3" aria-hidden="true" />
          {t('disclaimerChip')}
        </span>
        <div className="aspect-[4/3] max-h-[70vh] w-full">
          <HouseScene
            model={model}
            visibleFloorCount={visibleFloorCount}
            showRoof={cutawayIndex === null}
            style={style}
            preset={preset}
            resetToken={resetToken}
            ariaLabel={t('canvasLabel', {
              floors: floorCount,
              width: model.house.widthM,
              length: model.house.lengthM,
            })}
          />
        </div>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-ink-faint">{t('hint')}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">{t('disclaimerBody')}</p>
    </div>
  );
}
