'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Info, Maximize, X, ZoomIn, ZoomOut } from 'lucide-react';
import { layoutSite, type FloorPlan, type SiteFeatures } from '@archai/floor-plan-engine';
import { type LandConfig } from '@archai/shared';
import { IconButton } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { FloorPlanCanvas } from './floor-plan-canvas';
import { SitePlanCanvas } from './site-plan-canvas';
import { FloorPlanLegend } from './floor-plan-legend';
import { usePanZoom } from './use-pan-zoom';

/** Blank border around the footprint that the dimension annotations live in. */
function marginFor(widthM: number, lengthM: number): number {
  return Math.max(1.4, Math.max(widthM, lengthM) * 0.11);
}

/**
 * The frame follows the drawing's own proportions so a portrait house does not
 * sit in a letterboxed strip, clamped so neither extreme dominates the page.
 */
function frameRatio(widthM: number, lengthM: number, marginM: number): number {
  const ratio = (widthM + marginM * 2) / (lengthM + marginM * 2);
  return Math.min(1.9, Math.max(0.85, ratio));
}

export interface FloorPlanViewerProps {
  plan: FloorPlan;
  /** Plot dimensions; the site sheet derives one from the area when absent. */
  land?: LandConfig | null;
  /** Garage, terrace, pool and the rest — what to draw on the plot. */
  features?: SiteFeatures | null;
  className?: string;
}

export function FloorPlanViewer({ plan, land, features, className }: FloorPlanViewerProps) {
  const t = useTranslations('floorPlan');
  const tRoomTypes = useTranslations('roomTypes');
  const tFloor = useTranslations('workspace.rooms');
  const tSite = useTranslations('sitePlan');

  /** Which sheet is on the board: a floor index, or the site plan. */
  const [sheet, setSheet] = useState<number | 'site'>(0);
  const [selectedRoomKey, setSelectedRoomKey] = useState<string | null>(null);
  const { widthM, lengthM } = plan.house;
  const marginM = marginFor(widthM, lengthM);
  const panZoom = usePanZoom(widthM, lengthM, marginM);

  // The same call the 3D preview and the PDF make, so all three agree about
  // where the garage is.
  const site = useMemo(
    () =>
      layoutSite({
        land,
        house: { widthM, lengthM, floorCount: plan.floors.length },
        features: features ?? null,
      }),
    [land, features, widthM, lengthM, plan.floors.length],
  );

  const isSite = sheet === 'site';
  const floorIndex = typeof sheet === 'number' ? sheet : 0;

  // A regenerated plan can have fewer floors than the one being viewed.
  useEffect(() => {
    setSheet((current) =>
      current === 'site' || current < plan.floors.length ? current : 0,
    );
  }, [plan.floors.length]);

  // Selection is per-floor UI state; switching sheets or plans clears it.
  useEffect(() => {
    setSelectedRoomKey(null);
  }, [sheet, plan]);

  const floor = plan.floors[floorIndex] ?? plan.floors[0];
  if (!floor) return null;

  const selectedRoom = floor.rooms.find((room) => room.key === selectedRoomKey) ?? null;

  const zoomPercent = Math.round(panZoom.zoom * 100);

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Always rendered now: even a single-storey house has two sheets, the
            floor and the site it stands on. */}
        <div
          role="group"
          aria-label={t('floorSwitcherLabel')}
          className="inline-flex items-center gap-0.5 rounded-panel border border-line-strong bg-surface p-0.5"
        >
          {plan.floors.map((item, index) => (
            <button
              key={item.index}
              type="button"
              aria-pressed={!isSite && index === floorIndex}
              onClick={() => setSheet(index)}
              className={cn(
                'rounded-sm px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap transition-colors',
                !isSite && index === floorIndex
                  ? 'bg-ink text-paper'
                  : 'text-ink-soft hover:bg-paper hover:text-ink',
              )}
            >
              {tFloor('floorGroup', { floor: item.index + 1 })}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={isSite}
            onClick={() => setSheet('site')}
            className={cn(
              'rounded-sm px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap transition-colors',
              isSite ? 'bg-ink text-paper' : 'text-ink-soft hover:bg-paper hover:text-ink',
            )}
          >
            {tSite('tab')}
          </button>
        </div>

        {/* Zoom belongs to the floor sheets: the site plan is framed to the
            plot and has nothing to pan around. */}
        <div className={cn('flex items-center gap-1.5', isSite && 'invisible')}>
          <IconButton
            variant="outline"
            size="sm"
            aria-label={t('zoomOut')}
            onClick={panZoom.zoomOut}
          >
            <ZoomOut className="size-4" aria-hidden="true" />
          </IconButton>
          <span
            aria-live="polite"
            className="numeric w-12 text-center text-xs font-semibold text-ink-soft"
          >
            {t('zoomValue', { percent: zoomPercent })}
          </span>
          <IconButton variant="outline" size="sm" aria-label={t('zoomIn')} onClick={panZoom.zoomIn}>
            <ZoomIn className="size-4" aria-hidden="true" />
          </IconButton>
          <IconButton
            variant="outline"
            size="sm"
            aria-label={t('zoomReset')}
            onClick={panZoom.reset}
          >
            <Maximize className="size-4" aria-hidden="true" />
          </IconButton>
        </div>
      </div>

      <div className="relative mt-3 overflow-hidden rounded-panel border border-line bg-surface">
        <span
          title={t('disclaimerBody')}
          className="absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 rounded-sm border border-line bg-paper/90 px-2 py-1 text-[11px] font-semibold text-ink-soft"
        >
          <Info className="size-3" aria-hidden="true" />
          {t('disclaimerChip')}
        </span>
        <div
          className="max-h-[70vh] w-full"
          style={{
            aspectRatio: isSite
              ? Math.min(1.9, Math.max(0.6, site.plot.width / site.plot.height))
              : frameRatio(widthM, lengthM, marginM),
          }}
        >
          {isSite ? (
            <SitePlanCanvas site={site} />
          ) : (
            <FloorPlanCanvas
              house={plan.house}
              floor={floor}
              panZoom={panZoom}
              marginM={marginM}
              selectedRoomKey={selectedRoomKey}
              onSelectRoom={setSelectedRoomKey}
            />
          )}
        </div>
      </div>

      {isSite ? (
        <p className="mt-3 text-xs leading-relaxed text-ink-faint">
          {site.plotDerived ? tSite('derivedNote') : tSite('note')}
        </p>
      ) : null}

      {/* Selected-room details (§23), announced politely for screen readers. */}
      <div aria-live="polite" className={cn(isSite && 'hidden')}>
        {selectedRoom ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-panel border border-line bg-surface px-4 py-2.5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-sm font-bold text-ink">
                {selectedRoom.label?.trim() ? selectedRoom.label : tRoomTypes(selectedRoom.type)}
              </span>
              <span className="text-xs font-semibold text-ink-faint">
                {tRoomTypes(selectedRoom.type)} · {tFloor('floorGroup', { floor: floor.index + 1 })}
              </span>
              <span className="numeric text-xs font-semibold text-ink-soft">
                {t('roomDims', {
                  width: selectedRoom.rect.width,
                  length: selectedRoom.rect.height,
                })}{' '}
                · {t('areaValue', { area: selectedRoom.areaM2 })}
              </span>
            </div>
            <IconButton
              variant="ghost"
              size="sm"
              aria-label={t('clearSelection')}
              onClick={() => setSelectedRoomKey(null)}
            >
              <X className="size-4" aria-hidden="true" />
            </IconButton>
          </div>
        ) : (
          <p className="mt-3 text-xs text-ink-faint">{t('selectHint')}</p>
        )}
      </div>

      {isSite ? null : (
        <FloorPlanLegend className="mt-4" floor={floor} hasStairs={floor.stairs !== null} />
      )}

      <p className="mt-3 text-xs leading-relaxed text-ink-faint">{t('disclaimerBody')}</p>
    </div>
  );
}
