'use client';

import { type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Ruler, Scan } from 'lucide-react';
import { type EstimateResult } from '@archai/shared';
import { formatUZS, round } from '@/lib/format';

/**
 * The headline: one number people quote to each other, the band it really sits
 * in, and the two figures that make it comparable to anything else they hear —
 * cost per m² and the area it was computed on.
 */

function StatChip({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-sm border border-line bg-paper px-3.5 py-2.5">
      <dt className="flex items-center gap-1.5 text-xs font-semibold text-ink-faint">
        <span aria-hidden="true">{icon}</span>
        {label}
      </dt>
      <dd className="numeric mt-1 text-sm font-bold text-ink">{value}</dd>
    </div>
  );
}

export function EstimateSummary({
  estimate,
  className,
}: {
  estimate: EstimateResult;
  className?: string;
}) {
  const t = useTranslations('estimate.summary');

  return (
    <section aria-label={t('title')} className={className}>
      <div className="rounded-md border border-line bg-surface p-5 sm:p-6">
        <p className="text-xs font-semibold tracking-wide text-ink-faint uppercase">
          {t('totalLabel')}
        </p>
        <p className="numeric mt-2 text-3xl leading-none font-extrabold text-ink sm:text-4xl">
          {t('amountValue', { amount: formatUZS(estimate.total) })}
        </p>
        <p className="mt-2.5 text-sm text-ink-soft">
          <span className="font-semibold">{t('rangeLabel')}</span>{' '}
          <span className="numeric">
            {t('rangeValue', {
              min: formatUZS(estimate.rangeMin),
              max: formatUZS(estimate.rangeMax),
            })}
          </span>
        </p>

        <dl className="mt-5 grid gap-2 sm:grid-cols-2">
          <StatChip
            icon={<Ruler className="size-3.5" />}
            label={t('costPerM2')}
            value={t('costPerM2Value', { amount: formatUZS(estimate.costPerM2) })}
          />
          <StatChip
            icon={<Scan className="size-3.5" />}
            label={t('grossArea')}
            value={t('grossAreaValue', { area: round(estimate.grossFloorAreaM2, 1) })}
          />
        </dl>
      </div>
    </section>
  );
}
