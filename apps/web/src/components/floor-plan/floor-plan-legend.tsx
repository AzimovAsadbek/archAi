'use client';

import { useId, useMemo, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { type FloorGeometry } from '@archai/floor-plan-engine';
import { type RoomType } from '@archai/shared';
import { cn } from '@/lib/cn';
import { PLAN_COLORS, ROOM_TINTS, ROOM_TYPE_ORDER } from './plan-palette';

const SYMBOL_STROKE = { vectorEffect: 'non-scaling-stroke' } as const;

function Chip({ swatch, label }: { swatch: ReactNode; label: string }) {
  return (
    <li className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
      {swatch}
      {label}
    </li>
  );
}

function ColorSwatch({ fill }: { fill: string }) {
  return (
    <span
      aria-hidden="true"
      className="size-3.5 shrink-0 rounded-[3px] border border-line-strong"
      style={{ backgroundColor: fill }}
    />
  );
}

/** 20×14 mini-drawings that mirror the symbols used on the plan itself. */
function SymbolSwatch({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 20 14"
      aria-hidden="true"
      className="h-3.5 w-5 shrink-0 overflow-visible"
      fill="none"
    >
      {children}
    </svg>
  );
}

export interface FloorPlanLegendProps {
  floor: FloorGeometry;
  hasStairs: boolean;
  className?: string;
}

export function FloorPlanLegend({ floor, hasStairs, className }: FloorPlanLegendProps) {
  const t = useTranslations('floorPlan.legend');
  const tRoomTypes = useTranslations('roomTypes');
  const [open, setOpen] = useState(false);
  const bodyId = `${useId()}-legend`;

  const types = useMemo<RoomType[]>(() => {
    const present = new Set(floor.rooms.map((room) => room.type));
    return ROOM_TYPE_ORDER.filter((type) => present.has(type));
  }, [floor.rooms]);

  return (
    <div className={cn('rounded-panel border border-line bg-paper px-4 py-3', className)}>
      {/* Collapsible on mobile, always-open heading from `sm` upwards. */}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 rounded-sm text-left text-xs font-bold tracking-wide text-ink-soft uppercase sm:hidden"
      >
        {t('title')}
        <ChevronDown
          aria-hidden="true"
          className={cn('size-4 transition-transform', open && 'rotate-180')}
        />
      </button>
      <p className="hidden text-xs font-bold tracking-wide text-ink-soft uppercase sm:block">
        {t('title')}
      </p>

      <div id={bodyId} className={cn('mt-3', open ? 'block' : 'hidden sm:block')}>
        {types.length > 0 || floor.corridor ? (
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {types.map((type) => (
              <Chip
                key={type}
                swatch={<ColorSwatch fill={ROOM_TINTS[type]} />}
                label={tRoomTypes(type)}
              />
            ))}
            {floor.corridor ? (
              <Chip swatch={<ColorSwatch fill={PLAN_COLORS.corridor} />} label={t('corridor')} />
            ) : null}
          </ul>
        ) : null}

        <ul
          className={cn(
            'flex flex-wrap items-center gap-x-4 gap-y-2',
            (types.length > 0 || floor.corridor) && 'mt-2.5 border-t border-line pt-2.5',
          )}
        >
          {floor.doors.length > 0 ? (
            <Chip
              label={t('door')}
              swatch={
                <SymbolSwatch>
                  <path
                    d="M2 12 H8"
                    stroke={PLAN_COLORS.wall}
                    strokeWidth={2.5}
                    {...SYMBOL_STROKE}
                  />
                  <path
                    d="M14 12 H18"
                    stroke={PLAN_COLORS.wall}
                    strokeWidth={2.5}
                    {...SYMBOL_STROKE}
                  />
                  <path
                    d="M8 12 V4"
                    stroke={PLAN_COLORS.detail}
                    strokeWidth={1.4}
                    {...SYMBOL_STROKE}
                  />
                  <path
                    d="M14 12 A6 6 0 0 0 8 4"
                    stroke={PLAN_COLORS.annotation}
                    strokeWidth={1}
                    {...SYMBOL_STROKE}
                  />
                </SymbolSwatch>
              }
            />
          ) : null}
          {floor.windows.length > 0 ? (
            <Chip
              label={t('window')}
              swatch={
                <SymbolSwatch>
                  <path d="M1 8 H5" stroke={PLAN_COLORS.wall} strokeWidth={3} {...SYMBOL_STROKE} />
                  <path d="M15 8 H19" stroke={PLAN_COLORS.wall} strokeWidth={3} {...SYMBOL_STROKE} />
                  <path
                    d="M5 6.5 H15 M5 9.5 H15 M5 6.5 V9.5 M15 6.5 V9.5"
                    stroke={PLAN_COLORS.detail}
                    strokeWidth={1}
                    {...SYMBOL_STROKE}
                  />
                </SymbolSwatch>
              }
            />
          ) : null}
          {hasStairs ? (
            <Chip
              label={t('stairs')}
              swatch={
                <SymbolSwatch>
                  <rect x={1} y={2} width={18} height={10} fill={PLAN_COLORS.stair} />
                  <path
                    d="M5 2 V12 M9 2 V12 M13 2 V12"
                    stroke={PLAN_COLORS.detail}
                    strokeWidth={1}
                    {...SYMBOL_STROKE}
                  />
                  <path
                    d="M3 7 H16"
                    stroke={PLAN_COLORS.wall}
                    strokeWidth={1.4}
                    {...SYMBOL_STROKE}
                  />
                  <path d="M19 7 L15 5 L15 9 Z" fill={PLAN_COLORS.wall} />
                </SymbolSwatch>
              }
            />
          ) : null}
        </ul>
      </div>
    </div>
  );
}
