'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { type AdminEstimateRuleRow } from '@/lib/endpoints';
import { formatUZS } from '@/lib/format';

/**
 * Every version ever activated, newest first. Rules are append-only, so this is
 * the paper trail behind any estimate a user ever saw: the version string in a
 * result maps to exactly one row here.
 */
export function AdminRulesHistory({ items }: { items: AdminEstimateRuleRow[] }) {
  const tHistory = useTranslations('admin.rules.history');
  const format = useFormatter();

  return (
    <section className="mt-10">
      <h2 className="text-sm font-bold tracking-wide text-ink uppercase">{tHistory('title')}</h2>
      <p className="mt-1.5 text-sm text-ink-soft">{tHistory('subtitle')}</p>

      {items.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-line-strong bg-surface px-4 py-6 text-center text-sm text-ink-faint">
          {tHistory('empty')}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {items.map((rule) => (
            <li
              key={rule.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-line bg-surface px-4 py-3"
            >
              <span className="numeric text-sm font-bold text-ink">
                {tHistory('version', { version: rule.version })}
              </span>
              {rule.isActive ? (
                <Badge tone="success" size="sm">
                  {tHistory('active')}
                </Badge>
              ) : (
                <Badge tone="faint" size="sm">
                  {tHistory('archived')}
                </Badge>
              )}
              <span className="numeric text-xs text-ink-faint">
                {format.dateTime(new Date(rule.createdAt), {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </span>
              <span className="numeric ml-auto text-xs whitespace-nowrap text-ink-soft">
                {tHistory('summary', {
                  structure: formatUZS(rule.data.structureCostPerM2),
                  finish: formatUZS(rule.data.finishCostPerM2.STANDARD),
                  contingency: Math.round(rule.data.contingencyShare * 100),
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
