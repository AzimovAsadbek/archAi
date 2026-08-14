'use client';

import { useTranslations } from 'next-intl';
import { Info } from 'lucide-react';
import { type EstimateLineKey, type EstimateResult } from '@archai/shared';
import { formatUZS } from '@/lib/format';
import { FEATURE_ICONS } from '@/lib/project-options';

/**
 * Where the total comes from, in the order the money is spent. Amounts are bare
 * numbers — the currency is named once, in the column header, so the column
 * stays readable.
 *
 * `labor-info` is deliberately not a summed row: it is a slice of structure +
 * finish, so it renders as an info note between them and the rest.
 */

function amountOf(estimate: EstimateResult, key: EstimateLineKey): number | null {
  return estimate.lines.find((line) => line.key === key)?.amount ?? null;
}

const CELL = 'px-5 py-3';

function Row({ label, hint, amount }: { label: string; hint?: string; amount: number | null }) {
  if (amount === null) return null;

  return (
    <tr className="border-t border-line first:border-t-0">
      <th scope="row" className={`${CELL} text-left font-semibold text-ink`}>
        {label}
        {hint ? (
          <span className="mt-0.5 block text-xs font-normal text-ink-faint">{hint}</span>
        ) : null}
      </th>
      <td className={`numeric ${CELL} text-right align-top text-ink`}>{formatUZS(amount)}</td>
    </tr>
  );
}

export function EstimateBreakdown({
  estimate,
  finishLevelLabel,
  className,
}: {
  estimate: EstimateResult;
  finishLevelLabel: string;
  className?: string;
}) {
  const t = useTranslations('estimate.table');
  const tFeatures = useTranslations('features');

  const labor = amountOf(estimate, 'labor-info');
  const featuresTotal = amountOf(estimate, 'features');
  const showFeatures = estimate.featureLines.length > 0 || (featuresTotal ?? 0) > 0;

  return (
    <section className={className}>
      <div className="overflow-hidden rounded-md border border-line bg-surface">
        <header className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-bold tracking-wide text-ink uppercase">{t('title')}</h2>
        </header>

        <div className="overflow-x-auto">
          <table className="w-full min-w-md border-collapse text-sm">
            <caption className="sr-only">{t('caption')}</caption>
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="px-5 py-2.5 text-xs font-bold text-ink-faint uppercase">
                  {t('item')}
                </th>
                <th
                  scope="col"
                  className="px-5 py-2.5 text-right text-xs font-bold text-ink-faint uppercase"
                >
                  {t('amount')}
                </th>
              </tr>
            </thead>

            <tbody>
              <Row
                label={t('structure')}
                hint={t('structureHint')}
                amount={amountOf(estimate, 'structure')}
              />
              <Row
                label={t('finish', { level: finishLevelLabel })}
                amount={amountOf(estimate, 'finish')}
              />

              {/* Informational: already inside the two rows above, never summed. */}
              {labor === null ? null : (
                <tr className="border-t border-line bg-info-soft/50">
                  <th scope="row" className={`${CELL} text-left font-semibold text-ink-soft`}>
                    <span className="flex items-center gap-1.5">
                      <Info className="size-3.5 shrink-0 text-info" aria-hidden="true" />
                      {t('labor')}
                    </span>
                    <span className="mt-0.5 block text-xs font-normal text-ink-soft">
                      {t('laborNote')}
                    </span>
                  </th>
                  <td className={`numeric ${CELL} text-right align-top text-ink-faint`}>
                    {formatUZS(labor)}
                  </td>
                </tr>
              )}

              {showFeatures ? <Row label={t('features')} amount={featuresTotal ?? 0} /> : null}

              {estimate.featureLines.map((line) => {
                const Icon = FEATURE_ICONS[line.key];
                return (
                  <tr key={line.key} className="border-t border-line">
                    <th scope="row" className="py-2 pr-5 pl-10 text-left font-normal text-ink-soft">
                      <span className="flex items-center gap-2">
                        <Icon className="size-3.5 shrink-0 text-ink-faint" aria-hidden="true" />
                        {tFeatures(`${line.key}.label`)}
                      </span>
                    </th>
                    <td className="numeric py-2 pr-5 pl-5 text-right text-ink-soft">
                      {formatUZS(line.amount)}
                    </td>
                  </tr>
                );
              })}

              <Row
                label={t('contingency')}
                hint={t('contingencyHint')}
                amount={amountOf(estimate, 'contingency')}
              />
            </tbody>

            <tfoot>
              <tr className="border-t-2 border-line-strong bg-paper">
                <th scope="row" className={`${CELL} text-left text-sm font-extrabold text-ink`}>
                  {t('total')}
                </th>
                <td className={`numeric ${CELL} text-right text-base font-extrabold text-ink`}>
                  {formatUZS(estimate.total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </section>
  );
}
