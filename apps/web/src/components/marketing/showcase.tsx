'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { FloorPlan } from '@archai/floor-plan-engine';
import type { EstimateResult } from '@archai/shared';
import { PlanSpecimen } from './plan-specimen';
import { cn } from '@/lib/cn';
import { formatUZS } from '@/lib/format';

/**
 * "Show the product" section: a real engine plan and a real estimate, side by
 * side with the brief that produced them. Both payloads are computed on the
 * server from the actual `@archai/floor-plan-engine` and `calculateEstimate`,
 * so nothing here is illustrative — a visitor is looking at output, not a
 * marketing rendering of output.
 */

const TABS = ['plan', 'rooms', 'estimate'] as const;
type Tab = (typeof TABS)[number];

export interface ShowcaseProps {
  plan: FloorPlan;
  estimate: EstimateResult;
  /** The brief that produced the plan, echoed so the demo is reproducible. */
  brief: { landAreaM2: number; widthM: number; lengthM: number; floorCount: number };
}

export function Showcase({ plan, estimate, brief }: ShowcaseProps) {
  const t = useTranslations('marketing.showcase');
  const tRoom = useTranslations('roomTypes');
  const [tab, setTab] = useState<Tab>('plan');
  const [floorIndex, setFloorIndex] = useState(0);
  const baseId = useId();

  const rooms = plan.floors.flatMap((f) => f.rooms.map((r) => ({ ...r, floor: f.index })));

  return (
    <section className="border-b border-line">
      <div className="mx-auto max-w-7xl px-5 py-16 lg:py-20">
        <header className="max-w-2xl">
          <h2 className="text-section font-extrabold text-ink">{t('title')}</h2>
          <p className="mt-3 leading-relaxed text-ink-soft">{t('subtitle')}</p>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-8">
          {/* ── Specimen ─────────────────────────────────────────────── */}
          <div className="overflow-hidden rounded-lg border border-line bg-surface">
            <div
              role="tablist"
              aria-label={t('title')}
              className="flex items-center gap-1 overflow-x-auto border-b border-line bg-paper px-2"
            >
              {TABS.map((key) => (
                <button
                  key={key}
                  role="tab"
                  id={`${baseId}-tab-${key}`}
                  aria-selected={tab === key}
                  aria-controls={`${baseId}-panel-${key}`}
                  type="button"
                  onClick={() => setTab(key)}
                  className={cn(
                    'shrink-0 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors',
                    tab === key
                      ? 'border-accent text-ink'
                      : 'border-transparent text-ink-soft hover:text-ink',
                  )}
                >
                  {t(`tabs.${key}`)}
                </button>
              ))}

              {tab === 'plan' && plan.floors.length > 1 ? (
                <div className="ml-auto flex shrink-0 items-center gap-1 py-1.5">
                  {plan.floors.map((f) => (
                    <button
                      key={f.index}
                      type="button"
                      onClick={() => setFloorIndex(f.index)}
                      aria-pressed={floorIndex === f.index}
                      className={cn(
                        'rounded-sm px-2 py-1 text-caption font-semibold transition-colors',
                        floorIndex === f.index
                          ? 'bg-accent-soft text-accent-strong'
                          : 'text-ink-faint hover:text-ink',
                      )}
                    >
                      {t('floor', { n: f.index + 1 })}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div
              role="tabpanel"
              id={`${baseId}-panel-${tab}`}
              aria-labelledby={`${baseId}-tab-${tab}`}
              tabIndex={-1}
              className="p-4"
            >
              {tab === 'plan' ? (
                <div className="aspect-[4/3]">
                  <PlanSpecimen
                    plan={plan}
                    floorIndex={floorIndex}
                    label={t('planAlt', { n: floorIndex + 1 })}
                  />
                </div>
              ) : null}

              {tab === 'rooms' ? (
                <div className="max-h-[26rem] overflow-y-auto">
                  <table className="w-full text-meta">
                    <thead className="sticky top-0 bg-surface">
                      <tr className="border-b border-line text-caption tracking-wide text-ink-faint uppercase">
                        <th className="py-2 pr-3 text-left font-medium">{t('table.room')}</th>
                        <th className="py-2 pr-3 text-left font-medium">{t('table.floor')}</th>
                        <th className="py-2 pr-3 text-right font-medium">{t('table.size')}</th>
                        <th className="py-2 text-right font-medium">{t('table.area')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rooms.map((room) => (
                        <tr key={room.key} className="border-b border-line last:border-0">
                          <td className="py-2 pr-3 text-ink">{tRoom(room.type)}</td>
                          <td className="numeric py-2 pr-3 text-ink-soft">{room.floor + 1}</td>
                          <td className="numeric py-2 pr-3 text-right text-ink-soft">
                            {room.rect.width} × {room.rect.height} m
                          </td>
                          <td className="numeric py-2 text-right font-semibold text-ink">
                            {room.areaM2} m²
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {tab === 'estimate' ? (
                <div className="py-2">
                  <p className="text-caption font-semibold tracking-wide text-ink-faint uppercase">
                    {t('estimateTotal')}
                  </p>
                  <p className="numeric mt-1 text-title font-extrabold text-ink">
                    {formatUZS(estimate.total)} {t('currency')}
                  </p>
                  <p className="numeric mt-1 text-sm text-ink-soft">
                    {formatUZS(estimate.rangeMin)} — {formatUZS(estimate.rangeMax)}
                  </p>
                  <dl className="mt-5 flex flex-col gap-2 border-t border-line pt-4 text-meta">
                    {estimate.lines
                      .filter((line) => line.key !== 'labor-info')
                      .map((line) => (
                        <div key={line.key} className="flex items-baseline justify-between gap-4">
                          <dt className="text-ink-soft">{t(`lines.${line.key}`)}</dt>
                          <dd className="numeric font-semibold text-ink">
                            {formatUZS(line.amount)}
                          </dd>
                        </div>
                      ))}
                  </dl>
                  <p className="mt-4 text-caption leading-relaxed text-ink-faint">
                    {t('estimateNote')}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          {/* ── The brief that produced it ───────────────────────────── */}
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-line bg-surface p-5">
              <p className="text-caption font-semibold tracking-wide text-ink-faint uppercase">
                {t('briefLabel')}
              </p>
              <p className="mt-2 text-panel leading-snug font-bold text-ink">
                &ldquo;{t('briefText')}&rdquo;
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4 text-meta">
                <div>
                  <dt className="text-ink-faint">{t('facts.land')}</dt>
                  <dd className="numeric font-semibold text-ink">{brief.landAreaM2} m²</dd>
                </div>
                <div>
                  <dt className="text-ink-faint">{t('facts.house')}</dt>
                  <dd className="numeric font-semibold text-ink">
                    {brief.widthM} × {brief.lengthM} m
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-faint">{t('facts.floors')}</dt>
                  <dd className="numeric font-semibold text-ink">{brief.floorCount}</dd>
                </div>
                <div>
                  <dt className="text-ink-faint">{t('facts.rooms')}</dt>
                  <dd className="numeric font-semibold text-ink">{rooms.length}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-lg border border-line bg-paper p-5">
              <p className="text-caption font-semibold tracking-wide text-ink-faint uppercase">
                {t('deterministicLabel')}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t('deterministicBody')}</p>
              <p className="numeric mt-3 text-caption text-ink-faint">
                {t('engineVersion', { version: plan.engineVersion })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
