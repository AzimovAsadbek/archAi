'use client';

import { useTranslations } from 'next-intl';
import { LIMITS } from '@archai/shared';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { draftLandAreaM2 } from '@/lib/draft-project';
import { coveragePercent, parseNumberInput, round } from '@/lib/format';
import { StepShell, type StepProps } from './step-shell';

const FLOOR_OPTIONS = [1, 2, 3];

export function HouseStep({ draft, update, errors, disabled }: StepProps) {
  const t = useTranslations('wizard.house');

  const width = parseNumberInput(draft.houseWidth);
  const length = parseNumberInput(draft.houseLength);
  const footprint = width !== null && length !== null ? round(width * length, 1) : null;
  const landAreaM2 = draftLandAreaM2(draft);
  const coverage =
    footprint !== null && landAreaM2 !== null ? coveragePercent(footprint, landAreaM2) : null;
  const totalArea = footprint !== null ? round(footprint * draft.floorCount, 1) : null;

  return (
    <StepShell title={t('title')} subtitle={t('subtitle')}>
      <div className="flex flex-col gap-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t('width')} required error={errors['widthM']}>
            {(control) => (
              <Input
                {...control}
                type="number"
                inputMode="decimal"
                step="0.5"
                min={LIMITS.house.minSideM}
                max={LIMITS.house.maxSideM}
                disabled={disabled}
                value={draft.houseWidth}
                onChange={(event) => update({ houseWidth: event.target.value })}
                placeholder="12"
              />
            )}
          </Field>
          <Field label={t('length')} required error={errors['lengthM']}>
            {(control) => (
              <Input
                {...control}
                type="number"
                inputMode="decimal"
                step="0.5"
                min={LIMITS.house.minSideM}
                max={LIMITS.house.maxSideM}
                disabled={disabled}
                value={draft.houseLength}
                onChange={(event) => update({ houseLength: event.target.value })}
                placeholder="10"
              />
            )}
          </Field>
        </div>

        <fieldset>
          <legend className="text-sm font-semibold text-ink">{t('floors')}</legend>
          <div className="mt-2 inline-flex rounded-md border border-line bg-surface p-0.5">
            {FLOOR_OPTIONS.map((count) => (
              <button
                key={count}
                type="button"
                disabled={disabled}
                onClick={() => update({ floorCount: count })}
                aria-pressed={draft.floorCount === count}
                className={cn(
                  'numeric min-w-24 rounded-sm px-4 py-2 text-sm font-bold transition-colors',
                  draft.floorCount === count
                    ? 'bg-ink text-paper'
                    : 'text-ink-faint hover:bg-paper hover:text-ink',
                )}
              >
                {t('floorOption', { count })}
              </button>
            ))}
          </div>
          {errors['floorCount'] ? (
            <p role="alert" className="mt-2 text-xs font-medium text-danger">
              {errors['floorCount']}
            </p>
          ) : null}
        </fieldset>

        <dl className="grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-3">
          <div className="bg-surface px-4 py-3">
            <dt className="text-xs font-semibold tracking-wide text-ink-faint uppercase">
              {t('footprint')}
            </dt>
            <dd className="numeric mt-1 text-lg font-extrabold text-ink">
              {footprint === null ? '—' : t('areaValue', { area: footprint })}
            </dd>
          </div>
          <div className="bg-surface px-4 py-3">
            <dt className="text-xs font-semibold tracking-wide text-ink-faint uppercase">
              {t('totalArea')}
            </dt>
            <dd className="numeric mt-1 text-lg font-extrabold text-ink">
              {totalArea === null ? '—' : t('areaValue', { area: totalArea })}
            </dd>
          </div>
          <div className="bg-surface px-4 py-3">
            <dt className="text-xs font-semibold tracking-wide text-ink-faint uppercase">
              {t('coverage')}
            </dt>
            <dd
              className={cn(
                'numeric mt-1 text-lg font-extrabold',
                coverage !== null && coverage > 70 ? 'text-warning' : 'text-ink',
              )}
            >
              {coverage === null ? '—' : t('coverageValue', { percent: coverage })}
            </dd>
          </div>
        </dl>

        {landAreaM2 === null ? (
          <p className="text-xs font-medium text-warning">{t('needLand')}</p>
        ) : null}
      </div>
    </StepShell>
  );
}
