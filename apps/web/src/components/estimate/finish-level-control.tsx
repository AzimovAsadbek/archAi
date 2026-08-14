'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { FINISH_LEVELS, type FinishLevel } from '@archai/shared';
import { cn } from '@/lib/cn';

/**
 * The finish level is the only thing the user steers on this tab, so it sits at
 * the top as three cards rather than a dropdown: the one-line descriptions are
 * what people actually choose by.
 */

/** Resolved with literal keys so the i18n checker can verify every one of them. */
export function useFinishLevelCopy(): Record<FinishLevel, { label: string; hint: string }> {
  const t = useTranslations('estimate.levels');

  return {
    STANDARD: { label: t('STANDARD.label'), hint: t('STANDARD.hint') },
    COMFORT: { label: t('COMFORT.label'), hint: t('COMFORT.hint') },
    PREMIUM: { label: t('PREMIUM.label'), hint: t('PREMIUM.hint') },
  };
}

export interface FinishLevelControlProps {
  value: FinishLevel;
  onChange: (level: FinishLevel) => void;
  disabled?: boolean;
  className?: string;
}

export function FinishLevelControl({
  value,
  onChange,
  disabled,
  className,
}: FinishLevelControlProps) {
  const tLevels = useTranslations('estimate.levels');
  const copy = useFinishLevelCopy();
  const labelId = useId();

  return (
    <div className={className}>
      <p id={labelId} className="text-xs font-semibold tracking-wide text-ink-faint uppercase">
        {tLevels('label')}
      </p>

      <div role="group" aria-labelledby={labelId} className="mt-2 grid gap-2 sm:grid-cols-3">
        {FINISH_LEVELS.map((level) => {
          const selected = level === value;

          return (
            <button
              key={level}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => onChange(level)}
              className={cn(
                'rounded-md border px-3.5 py-3 text-left transition-colors',
                'disabled:pointer-events-none disabled:opacity-50',
                selected ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:bg-paper',
              )}
            >
              <span
                className={cn(
                  'block text-sm font-bold',
                  selected ? 'text-accent-strong' : 'text-ink',
                )}
              >
                {copy[level].label}
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">
                {copy[level].hint}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
