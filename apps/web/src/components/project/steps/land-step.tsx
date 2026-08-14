'use client';

import { useTranslations } from 'next-intl';
import { LIMITS, SOTIX_IN_M2 } from '@archai/shared';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { convertLandArea, draftLandAreaM2, type LandUnit } from '@/lib/draft-project';
import { m2ToSotix } from '@/lib/format';
import { StepShell, type StepProps } from './step-shell';

const UNITS: LandUnit[] = ['sotix', 'm2'];

export function LandStep({ draft, update, errors, disabled }: StepProps) {
  const t = useTranslations('wizard.land');
  const areaM2 = draftLandAreaM2(draft);

  const switchUnit = (unit: LandUnit) => {
    if (unit === draft.landUnit) return;
    update({ landUnit: unit, landArea: convertLandArea(draft.landArea, draft.landUnit, unit) });
  };

  return (
    <StepShell title={t('title')} subtitle={t('subtitle')}>
      <div className="flex flex-col gap-6">
        <Field
          label={t('area')}
          required
          error={errors['areaM2']}
          hint={t('areaHint', { min: LIMITS.land.minAreaM2, max: LIMITS.land.maxAreaM2 })}
          labelSuffix={
            <div
              role="group"
              aria-label={t('unitLabel')}
              className="inline-flex items-center gap-0.5 rounded-md border border-line bg-surface p-0.5"
            >
              {UNITS.map((unit) => (
                <button
                  key={unit}
                  type="button"
                  disabled={disabled}
                  onClick={() => switchUnit(unit)}
                  aria-pressed={draft.landUnit === unit}
                  className={cn(
                    'rounded-sm px-2.5 py-1 text-xs font-bold transition-colors',
                    draft.landUnit === unit
                      ? 'bg-ink text-paper'
                      : 'text-ink-faint hover:bg-paper hover:text-ink',
                  )}
                >
                  {unit === 'sotix' ? t('unitSotix') : t('unitM2')}
                </button>
              ))}
            </div>
          }
        >
          {(control) => (
            <Input
              {...control}
              type="number"
              inputMode="decimal"
              step={draft.landUnit === 'sotix' ? '0.5' : '1'}
              min={0}
              disabled={disabled}
              value={draft.landArea}
              onChange={(event) => update({ landArea: event.target.value })}
              placeholder={draft.landUnit === 'sotix' ? '6' : '600'}
            />
          )}
        </Field>

        {areaM2 !== null ? (
          <p className="numeric -mt-3 rounded-md border border-line bg-paper px-4 py-3 text-sm font-semibold text-ink-soft">
            {t('conversion', {
              sotix: m2ToSotix(areaM2),
              m2: areaM2,
              factor: SOTIX_IN_M2,
            })}
          </p>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t('width')} error={errors['widthM']}>
            {(control) => (
              <Input
                {...control}
                type="number"
                inputMode="decimal"
                step="0.5"
                min={LIMITS.land.minSideM}
                max={LIMITS.land.maxSideM}
                disabled={disabled}
                value={draft.landWidth}
                onChange={(event) => update({ landWidth: event.target.value })}
              />
            )}
          </Field>
          <Field label={t('length')} error={errors['lengthM']}>
            {(control) => (
              <Input
                {...control}
                type="number"
                inputMode="decimal"
                step="0.5"
                min={LIMITS.land.minSideM}
                max={LIMITS.land.maxSideM}
                disabled={disabled}
                value={draft.landLength}
                onChange={(event) => update({ landLength: event.target.value })}
              />
            )}
          </Field>
        </div>
        <p className="-mt-2 text-xs leading-relaxed text-ink-faint">{t('dimsHint')}</p>
      </div>
    </StepShell>
  );
}
