'use client';

import { type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { type FloorPlanResponse } from '@/lib/endpoints';
import { cn } from '@/lib/cn';

/** Components at/above this read as strengths; at/below the floor, warnings. */
const STRENGTH_MIN = 0.85;
const WARNING_MAX = 0.5;
const MAX_INSIGHTS = 2;

export interface LayoutQualityProps {
  layout: FloorPlanResponse['layout'];
  /** Optional trailing control (the strategy selector), kept on the same row. */
  action?: ReactNode;
  className?: string;
}

/**
 * Compact §46 presentation of the engine's explainable score: the 0–100 total
 * plus at most two strengths and two warnings, localized by component code.
 * Raw engine internals (weights, every component) stay out of the default UI.
 */
export function LayoutQuality({ layout, action, className }: LayoutQualityProps) {
  const t = useTranslations('floorPlan.quality');
  const { total, components } = layout.score;

  const strengths = components
    .filter((component) => component.score >= STRENGTH_MIN)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_INSIGHTS);
  const warnings = components
    .filter((component) => component.score <= WARNING_MAX)
    .sort((a, b) => a.score - b.score)
    .slice(0, MAX_INSIGHTS);

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-2 rounded-panel border border-line bg-surface px-4 py-2.5',
        className,
      )}
    >
      <span className="text-xs font-bold tracking-wide text-ink uppercase">{t('title')}</span>
      <span className="numeric text-sm font-bold text-ink">
        {t('scoreValue', { score: Math.round(total) })}
      </span>

      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {strengths.map((component) => (
          <span
            key={component.code}
            className="inline-flex items-center gap-1 text-xs font-semibold text-success"
          >
            <CircleCheck className="size-3.5" aria-hidden="true" />
            {t(`components.${component.code}`)}
          </span>
        ))}
        {warnings.map((component) => (
          <span
            key={component.code}
            className="inline-flex items-center gap-1 text-xs font-semibold text-warning"
          >
            <CircleAlert className="size-3.5" aria-hidden="true" />
            {t(`components.${component.code}`)}
          </span>
        ))}
      </span>

      {action ? <span className="ml-auto">{action}</span> : null}
    </div>
  );
}
