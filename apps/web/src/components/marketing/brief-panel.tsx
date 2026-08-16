'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Minus, Plus, Sparkles } from 'lucide-react';
import { SOTIX_IN_M2, type HouseStyle, type RoomType } from '@archai/shared';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { saveBrief, type LandingBrief } from '@/lib/landing-brief';

/**
 * The landing brief: the shortest honest path from "I want a house" to a
 * configured project. It collects exactly the fields the configurator's first
 * three steps ask for, hands them to `saveBrief`, and sends the visitor on to
 * register. Nothing is generated here and nothing is promised — the same shared
 * schemas validate the values once they reach the real configurator, so this
 * panel can never create a project the API would reject.
 */

const SOTIX_CHOICES = [4, 5, 6, 8, 10, 12] as const;
const FLOOR_CHOICES = [1, 2, 3] as const;

/** The three counts a visitor actually knows up front. */
const COUNTED_ROOMS = [
  { type: 'BEDROOM' as RoomType, min: 1, max: 8, initial: 4 },
  { type: 'LIVING_ROOM' as RoomType, min: 0, max: 3, initial: 1 },
  { type: 'BATHROOM' as RoomType, min: 1, max: 4, initial: 2 },
];

/** Styles offered on the landing — the four the market asks for by name. */
const OFFERED_STYLES: readonly HouseStyle[] = ['MODERN', 'CLASSIC', 'MINIMALIST', 'NATIONAL'];

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="rounded-sm border border-line bg-paper px-2.5 py-2">
      <div className="flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`${label} −`}
          className="flex size-6 items-center justify-center rounded-sm text-ink-soft transition-colors hover:bg-surface hover:text-ink disabled:opacity-30"
        >
          <Minus className="size-3.5" aria-hidden="true" />
        </button>
        <span className="numeric text-base font-bold text-ink tabular-nums">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`${label} +`}
          className="flex size-6 items-center justify-center rounded-sm text-ink-soft transition-colors hover:bg-surface hover:text-ink disabled:opacity-30"
        >
          <Plus className="size-3.5" aria-hidden="true" />
        </button>
      </div>
      <p className="mt-1 text-center text-[11px] leading-tight text-ink-faint">{label}</p>
    </div>
  );
}

export function BriefPanel({ className }: { className?: string }) {
  const t = useTranslations('marketing.brief');
  const tRoom = useTranslations('roomTypes');
  const tStyle = useTranslations('styles');
  const router = useRouter();

  const [sotix, setSotix] = useState<number>(6);
  const [widthM, setWidthM] = useState('12');
  const [lengthM, setLengthM] = useState('15');
  const [floorCount, setFloorCount] = useState<number>(2);
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(COUNTED_ROOMS.map((r) => [r.type, r.initial])),
  );
  const [style, setStyle] = useState<HouseStyle>('MODERN');

  const landAreaM2 = sotix * SOTIX_IN_M2;
  const footprint = useMemo(() => {
    const w = Number(widthM.replace(',', '.'));
    const l = Number(lengthM.replace(',', '.'));
    return Number.isFinite(w) && Number.isFinite(l) && w > 0 && l > 0 ? w * l : null;
  }, [widthM, lengthM]);

  /** The house must fit the plot — the same rule the domain layer enforces. */
  const tooBig = footprint !== null && footprint > landAreaM2;

  const submit = () => {
    const brief: LandingBrief = {
      landAreaM2,
      widthM: Number(widthM.replace(',', '.')) || null,
      lengthM: Number(lengthM.replace(',', '.')) || null,
      floorCount,
      rooms: COUNTED_ROOMS.flatMap((r) =>
        Array.from({ length: counts[r.type] ?? 0 }, () => ({ type: r.type, floor: 0 })),
      ),
      style,
    };
    saveBrief(brief);
    router.push('/register?next=%2Fprojects%2Fnew');
  };

  return (
    <section
      aria-labelledby="brief-heading"
      className={cn(
        'rounded-lg border border-line bg-surface p-5 shadow-card',
        className,
      )}
    >
      <h2 id="brief-heading" className="flex items-center gap-2 text-base font-bold text-ink">
        <Sparkles className="size-4 text-accent" aria-hidden="true" />
        {t('title')}
      </h2>

      <div className="mt-4 flex flex-col gap-3.5">
        {/* Land */}
        <div>
          <label htmlFor="brief-land" className="text-xs font-semibold text-ink-soft">
            {t('land')}
          </label>
          <select
            id="brief-land"
            value={sotix}
            onChange={(e) => setSotix(Number(e.target.value))}
            className="mt-1 h-10 w-full rounded-sm border border-line bg-paper px-3 text-sm text-ink focus-visible:border-accent"
          >
            {SOTIX_CHOICES.map((s) => (
              <option key={s} value={s}>
                {t('sotix', { count: s })} · {s * SOTIX_IN_M2} m²
              </option>
            ))}
          </select>
        </div>

        {/* House size */}
        <div>
          <span className="text-xs font-semibold text-ink-soft">{t('house')}</span>
          <div className="mt-1 flex items-center gap-2">
            <input
              inputMode="decimal"
              value={widthM}
              onChange={(e) => setWidthM(e.target.value)}
              aria-label={t('widthM')}
              className="numeric h-10 w-full min-w-0 rounded-sm border border-line bg-paper px-3 text-sm text-ink focus-visible:border-accent"
            />
            <span aria-hidden="true" className="text-sm text-ink-faint">
              ×
            </span>
            <input
              inputMode="decimal"
              value={lengthM}
              onChange={(e) => setLengthM(e.target.value)}
              aria-label={t('lengthM')}
              className="numeric h-10 w-full min-w-0 rounded-sm border border-line bg-paper px-3 text-sm text-ink focus-visible:border-accent"
            />
            <span className="shrink-0 rounded-sm border border-line bg-paper px-2 py-2 text-xs text-ink-faint">
              m
            </span>
          </div>
          {tooBig ? (
            <p role="alert" className="mt-1.5 text-xs text-danger">
              {t('tooBig')}
            </p>
          ) : null}
        </div>

        {/* Floors */}
        <div>
          <span className="text-xs font-semibold text-ink-soft">{t('floors')}</span>
          <div role="group" aria-label={t('floors')} className="mt-1 grid grid-cols-3 gap-2">
            {FLOOR_CHOICES.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFloorCount(f)}
                aria-pressed={floorCount === f}
                className={cn(
                  'h-10 rounded-sm border text-sm font-semibold transition-colors',
                  floorCount === f
                    ? 'border-accent bg-accent-soft text-accent-strong'
                    : 'border-line bg-paper text-ink-soft hover:text-ink',
                )}
              >
                {t('floorCount', { count: f })}
              </button>
            ))}
          </div>
        </div>

        {/* Rooms */}
        <div>
          <span className="text-xs font-semibold text-ink-soft">{t('rooms')}</span>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {COUNTED_ROOMS.map((r) => (
              <Stepper
                key={r.type}
                label={tRoom(r.type)}
                value={counts[r.type] ?? r.initial}
                min={r.min}
                max={r.max}
                onChange={(next) => setCounts((c) => ({ ...c, [r.type]: next }))}
              />
            ))}
          </div>
        </div>

        {/* Style */}
        <div>
          <span className="text-xs font-semibold text-ink-soft">{t('style')}</span>
          <div role="group" aria-label={t('style')} className="mt-1 grid grid-cols-4 gap-2">
            {OFFERED_STYLES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStyle(s)}
                aria-pressed={style === s}
                className={cn(
                  'rounded-sm border px-1 py-2 text-[11px] font-semibold leading-tight transition-colors',
                  style === s
                    ? 'border-accent bg-accent-soft text-accent-strong'
                    : 'border-line bg-paper text-ink-soft hover:text-ink',
                )}
              >
                {tStyle(`${s}.label`)}
              </button>
            ))}
          </div>
        </div>

        <Button variant="accent" fullWidth onClick={submit} disabled={tooBig} className="mt-1">
          {t('submit')}
        </Button>
        <p className="text-center text-[11px] leading-snug text-ink-faint">{t('note')}</p>
      </div>
    </section>
  );
}
