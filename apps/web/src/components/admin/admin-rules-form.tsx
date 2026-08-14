'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, RotateCcw, TriangleAlert } from 'lucide-react';
import { estimateRulesSchema, type EstimateRules } from '@archai/shared';
import { useFinishLevelCopy } from '@/components/estimate/finish-level-control';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { createAdminEstimateRules, type AdminEstimateRuleRow } from '@/lib/endpoints';
import { formatUZS, numberToInput, parseNumberInput, round } from '@/lib/format';
import { useApiErrorMessage } from '@/lib/use-api-error';
import { useFieldError } from '@/lib/zod-errors';

/**
 * Pricing rules are data, so this is a data form, not a wizard: every number the
 * estimate engine reads (docs/estimate.md §Rule model) gets one labelled input,
 * grouped the way the money is spent. Saving never edits a version in place — it
 * activates a new one, so every estimate ever produced stays explainable.
 *
 * Shares are stored 0..1 but typed as percentages: nobody thinks in "0.35".
 */

interface RulesFormState {
  version: string;
  structureCostPerM2: string;
  extraFloorFactor: string;
  finishSTANDARD: string;
  finishCOMFORT: string;
  finishPREMIUM: string;
  garage: string;
  terrace: string;
  balcony: string;
  pool: string;
  garden: string;
  laborPercent: string;
  contingencyPercent: string;
  rangePercent: string;
}

/** Form field → dotted schema path, so zod issues land on the right input. */
const NUMERIC_PATHS: Record<Exclude<keyof RulesFormState, 'version'>, string> = {
  structureCostPerM2: 'structureCostPerM2',
  extraFloorFactor: 'extraFloorFactor',
  finishSTANDARD: 'finishCostPerM2.STANDARD',
  finishCOMFORT: 'finishCostPerM2.COMFORT',
  finishPREMIUM: 'finishCostPerM2.PREMIUM',
  garage: 'features.garage',
  terrace: 'features.terrace',
  balcony: 'features.balcony',
  pool: 'features.pool',
  garden: 'features.garden',
  laborPercent: 'laborShare',
  contingencyPercent: 'contingencyShare',
  rangePercent: 'rangeShare',
};

type FieldErrors = Partial<Record<string, string>>;

const EMPTY_FORM: RulesFormState = {
  version: '',
  structureCostPerM2: '',
  extraFloorFactor: '',
  finishSTANDARD: '',
  finishCOMFORT: '',
  finishPREMIUM: '',
  garage: '',
  terrace: '',
  balcony: '',
  pool: '',
  garden: '',
  laborPercent: '',
  contingencyPercent: '',
  rangePercent: '',
};

function shareToPercent(share: number): string {
  return numberToInput(round(share * 100, 4));
}

function percentToShare(percent: number): number {
  return round(percent / 100, 6);
}

function formFromRules(rules: EstimateRules): RulesFormState {
  return {
    // A new ruleset always needs a new version string — never prefilled.
    version: '',
    structureCostPerM2: numberToInput(rules.structureCostPerM2),
    extraFloorFactor: numberToInput(rules.extraFloorFactor),
    finishSTANDARD: numberToInput(rules.finishCostPerM2.STANDARD),
    finishCOMFORT: numberToInput(rules.finishCostPerM2.COMFORT),
    finishPREMIUM: numberToInput(rules.finishCostPerM2.PREMIUM),
    garage: numberToInput(rules.features.garage),
    terrace: numberToInput(rules.features.terrace),
    balcony: numberToInput(rules.features.balcony),
    pool: numberToInput(rules.features.pool),
    garden: numberToInput(rules.features.garden),
    laborPercent: shareToPercent(rules.laborShare),
    contingencyPercent: shareToPercent(rules.contingencyShare),
    rangePercent: shareToPercent(rules.rangeShare),
  };
}

/** Resolved with literal keys so the i18n checker can verify every one of them. */
function useFeatureLabels(): Record<'garage' | 'terrace' | 'balcony' | 'pool' | 'garden', string> {
  const tFeatures = useTranslations('features');

  return {
    garage: tFeatures('garage.label'),
    terrace: tFeatures('terrace.label'),
    balcony: tFeatures('balcony.label'),
    pool: tFeatures('pool.label'),
    garden: tFeatures('garden.label'),
  };
}

function FormCard({
  title,
  description,
  columns = 2,
  children,
}: {
  title: string;
  description?: string;
  columns?: 2 | 3;
  children: ReactNode;
}) {
  return (
    <section className="rounded-md border border-line bg-surface p-5 sm:p-6">
      <h2 className="text-sm font-bold tracking-wide text-ink uppercase">{title}</h2>
      {description ? (
        <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">{description}</p>
      ) : null}
      <div
        className={cn(
          'mt-5 grid gap-5',
          columns === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2',
        )}
      >
        {children}
      </div>
    </section>
  );
}

function MoneyField({
  label,
  value,
  error,
  disabled,
  suffixHint,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  disabled?: boolean;
  /** Extra sentence appended to the thousand hint, e.g. "per 100 m² of land". */
  suffixHint?: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations('admin.rules');
  const parsed = parseNumberInput(value);
  const amountHint =
    parsed === null ? t('uzsHintEmpty') : t('uzsHint', { amount: formatUZS(parsed) });

  return (
    <Field
      label={label}
      error={error}
      hint={suffixHint ? `${amountHint} · ${suffixHint}` : amountHint}
      required
    >
      {(control) => (
        <Input
          {...control}
          type="number"
          inputMode="numeric"
          step="100000"
          min={0}
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}

function PercentField({
  label,
  value,
  error,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const t = useTranslations('admin.rules');
  const parsed = parseNumberInput(value);

  return (
    <Field
      label={label}
      error={error}
      required
      hint={
        parsed === null
          ? t('percentHintEmpty')
          : t('percentHint', { share: percentToShare(parsed) })
      }
      labelSuffix={
        <span className="text-xs font-bold text-ink-faint" aria-hidden="true">
          %
        </span>
      }
    >
      {(control) => (
        <Input
          {...control}
          type="number"
          inputMode="decimal"
          step="0.5"
          min={0}
          max={100}
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}

export function AdminRulesForm({ active }: { active: AdminEstimateRuleRow | undefined }) {
  const t = useTranslations('admin.rules');
  const fieldError = useFieldError();
  const apiErrorMessage = useApiErrorMessage();
  const featureLabels = useFeatureLabels();
  const finishCopy = useFinishLevelCopy();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<RulesFormState>(() =>
    active ? formFromRules(active.data) : EMPTY_FORM,
  );
  const [initializedFor, setInitializedFor] = useState<string | null>(active?.id ?? null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saved, setSaved] = useState(false);

  // A successful save activates a new version: re-prefill from whatever is active now.
  useEffect(() => {
    if (!active || initializedFor === active.id) return;
    setForm(formFromRules(active.data));
    setInitializedFor(active.id);
    setErrors({});
  }, [active, initializedFor]);

  const update = (patch: Partial<RulesFormState>) => {
    setForm((current) => ({ ...current, ...patch }));
    setSaved(false);
  };

  const mutation = useMutation({
    mutationFn: (rules: EstimateRules) => createAdminEstimateRules(rules),
    onSuccess: () => {
      setSaved(true);
      setErrors({});
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (error: unknown) => {
      // The one failure that belongs on a field rather than in the banner.
      if (error instanceof ApiError && error.code === 'VERSION_EXISTS') {
        setErrors({ version: t('versionExists') });
      }
    },
  });

  const versionTaken =
    mutation.error instanceof ApiError && mutation.error.code === 'VERSION_EXISTS';

  const submit = () => {
    setSaved(false);
    mutation.reset();

    const nextErrors: FieldErrors = {};
    const numbers: Partial<Record<keyof RulesFormState, number>> = {};

    if (form.version.trim() === '') nextErrors['version'] = fieldError('required');

    for (const key of Object.keys(NUMERIC_PATHS) as (keyof typeof NUMERIC_PATHS)[]) {
      const parsed = parseNumberInput(form[key]);
      if (parsed === null) {
        nextErrors[NUMERIC_PATHS[key]] = fieldError('number_required');
        continue;
      }
      numbers[key] = parsed;
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const candidate = {
      version: form.version.trim(),
      currency: 'UZS',
      structureCostPerM2: numbers.structureCostPerM2,
      finishCostPerM2: {
        STANDARD: numbers.finishSTANDARD,
        COMFORT: numbers.finishCOMFORT,
        PREMIUM: numbers.finishPREMIUM,
      },
      extraFloorFactor: numbers.extraFloorFactor,
      features: {
        garage: numbers.garage,
        terrace: numbers.terrace,
        balcony: numbers.balcony,
        pool: numbers.pool,
        garden: numbers.garden,
      },
      // NaN rather than a default: an unparsed share must fail validation, not
      // quietly price at zero (the early return above already covers it).
      laborShare: percentToShare(numbers.laborPercent ?? Number.NaN),
      contingencyShare: percentToShare(numbers.contingencyPercent ?? Number.NaN),
      rangeShare: percentToShare(numbers.rangePercent ?? Number.NaN),
    };

    const parsed = estimateRulesSchema.safeParse(candidate);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        nextErrors[issue.path.map((part) => String(part)).join('.')] = fieldError(issue.message);
      }
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    mutation.mutate(parsed.data);
  };

  const reset = () => {
    setForm(active ? formFromRules(active.data) : EMPTY_FORM);
    setErrors({});
    setSaved(false);
    mutation.reset();
  };

  const disabled = mutation.isPending;

  return (
    <form
      noValidate
      className="mt-6 flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {mutation.isError && !versionTaken ? (
        <Alert tone="danger" live>
          {apiErrorMessage(mutation.error)}
        </Alert>
      ) : null}

      {!active ? (
        <Alert tone="warning" title={t('noActive.title')}>
          {t('noActive.body')}
        </Alert>
      ) : null}

      <FormCard title={t('groups.version')} description={t('groups.versionHint')}>
        <Field
          label={t('fields.version')}
          error={errors['version']}
          hint={active ? t('currentVersion', { version: active.version }) : undefined}
          required
        >
          {(control) => (
            <Input
              {...control}
              value={form.version}
              disabled={disabled}
              placeholder={t('versionPlaceholder')}
              onChange={(event) => update({ version: event.target.value })}
            />
          )}
        </Field>
        <Field label={t('fields.currency')} hint={t('currencyHint')}>
          {(control) => <Input {...control} value="UZS" readOnly disabled />}
        </Field>
      </FormCard>

      <FormCard title={t('groups.structure')} description={t('groups.structureHint')}>
        <MoneyField
          label={t('fields.structureCostPerM2')}
          value={form.structureCostPerM2}
          error={errors['structureCostPerM2']}
          disabled={disabled}
          suffixHint={t('fields.perM2')}
          onChange={(value) => update({ structureCostPerM2: value })}
        />
        <Field
          label={t('fields.extraFloorFactor')}
          error={errors['extraFloorFactor']}
          hint={t('fields.extraFloorFactorHint')}
          required
        >
          {(control) => (
            <Input
              {...control}
              type="number"
              inputMode="decimal"
              step="0.01"
              min={1}
              max={3}
              disabled={disabled}
              value={form.extraFloorFactor}
              onChange={(event) => update({ extraFloorFactor: event.target.value })}
            />
          )}
        </Field>
      </FormCard>

      <FormCard title={t('groups.finish')} description={t('groups.finishHint')} columns={3}>
        <MoneyField
          label={finishCopy.STANDARD.label}
          value={form.finishSTANDARD}
          error={errors['finishCostPerM2.STANDARD']}
          disabled={disabled}
          suffixHint={t('fields.perM2')}
          onChange={(value) => update({ finishSTANDARD: value })}
        />
        <MoneyField
          label={finishCopy.COMFORT.label}
          value={form.finishCOMFORT}
          error={errors['finishCostPerM2.COMFORT']}
          disabled={disabled}
          suffixHint={t('fields.perM2')}
          onChange={(value) => update({ finishCOMFORT: value })}
        />
        <MoneyField
          label={finishCopy.PREMIUM.label}
          value={form.finishPREMIUM}
          error={errors['finishCostPerM2.PREMIUM']}
          disabled={disabled}
          suffixHint={t('fields.perM2')}
          onChange={(value) => update({ finishPREMIUM: value })}
        />
      </FormCard>

      <FormCard title={t('groups.features')} description={t('groups.featuresHint')} columns={3}>
        <MoneyField
          label={featureLabels.garage}
          value={form.garage}
          error={errors['features.garage']}
          disabled={disabled}
          onChange={(value) => update({ garage: value })}
        />
        <MoneyField
          label={featureLabels.terrace}
          value={form.terrace}
          error={errors['features.terrace']}
          disabled={disabled}
          onChange={(value) => update({ terrace: value })}
        />
        <MoneyField
          label={featureLabels.balcony}
          value={form.balcony}
          error={errors['features.balcony']}
          disabled={disabled}
          onChange={(value) => update({ balcony: value })}
        />
        <MoneyField
          label={featureLabels.pool}
          value={form.pool}
          error={errors['features.pool']}
          disabled={disabled}
          onChange={(value) => update({ pool: value })}
        />
        <MoneyField
          label={featureLabels.garden}
          value={form.garden}
          error={errors['features.garden']}
          disabled={disabled}
          suffixHint={t('fields.perSotix')}
          onChange={(value) => update({ garden: value })}
        />
      </FormCard>

      <FormCard title={t('groups.shares')} description={t('groups.sharesHint')} columns={3}>
        <PercentField
          label={t('fields.laborShare')}
          value={form.laborPercent}
          error={errors['laborShare']}
          disabled={disabled}
          onChange={(value) => update({ laborPercent: value })}
        />
        <PercentField
          label={t('fields.contingencyShare')}
          value={form.contingencyPercent}
          error={errors['contingencyShare']}
          disabled={disabled}
          onChange={(value) => update({ contingencyPercent: value })}
        />
        <PercentField
          label={t('fields.rangeShare')}
          value={form.rangePercent}
          error={errors['rangeShare']}
          disabled={disabled}
          onChange={(value) => update({ rangePercent: value })}
        />
      </FormCard>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-5">
        <span aria-live="polite" className="mr-auto text-sm">
          {saved ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-success">
              <Check className="size-4" aria-hidden="true" />
              {t('saved')}
            </span>
          ) : Object.keys(errors).length > 0 ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-danger">
              <TriangleAlert className="size-4" aria-hidden="true" />
              {t('hasErrors')}
            </span>
          ) : null}
        </span>

        <Button variant="ghost" onClick={reset} disabled={disabled}>
          <RotateCcw className="size-4" aria-hidden="true" />
          {t('reset')}
        </Button>
        <Button type="submit" variant="accent" loading={mutation.isPending}>
          {t('submit')}
        </Button>
      </div>
    </form>
  );
}
