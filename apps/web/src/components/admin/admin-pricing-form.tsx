'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { PRICING_PLAN_KEYS, type PricingLimits } from '@archai/shared';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ApiError } from '@/lib/api';
import {
  createAdminPricing,
  updateAdminPricing,
  type AdminPricingRow,
  type CreatePricingInput,
  type UpdatePricingInput,
} from '@/lib/endpoints';
import { formatUZS } from '@/lib/format';
import { useApiErrorMessage } from '@/lib/use-api-error';
import { useFieldError } from '@/lib/zod-errors';

const LIMIT_FIELDS = ['projects', 'aiParsesPerMonth', 'pdfExportsPerMonth', 'storageMb'] as const;
type LimitField = (typeof LIMIT_FIELDS)[number];

interface PricingFormState {
  key: string;
  name: string;
  tagline: string;
  priceMonthly: string;
  features: string;
  sortOrder: string;
  isActive: boolean;
  limits: Record<LimitField, string>;
}

function limitToInput(value: number | null): string {
  return value === null ? '' : String(value);
}

function initialState(item: AdminPricingRow | null): PricingFormState {
  return {
    key: item?.key ?? 'FREE',
    name: item?.name ?? '',
    tagline: item?.tagline ?? '',
    priceMonthly: item ? String(item.priceMonthly) : '0',
    features: item?.features.join(', ') ?? '',
    sortOrder: item ? String(item.sortOrder) : '0',
    isActive: item?.isActive ?? true,
    limits: {
      projects: limitToInput(item?.limits.projects ?? null),
      aiParsesPerMonth: limitToInput(item?.limits.aiParsesPerMonth ?? null),
      pdfExportsPerMonth: limitToInput(item?.limits.pdfExportsPerMonth ?? null),
      storageMb: limitToInput(item?.limits.storageMb ?? null),
    },
  };
}

function parseIntOrNull(raw: string): number | null | 'invalid' {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  if (!/^\d+$/.test(trimmed)) return 'invalid';
  return Number(trimmed);
}

function parseFeatures(raw: string): string[] {
  return [...new Set(raw.split(',').map((f) => f.trim()).filter(Boolean))].slice(0, 30);
}

export function AdminPricingForm({ item, onDone }: { item: AdminPricingRow | null; onDone: () => void }) {
  const t = useTranslations('adminContent.pricing');
  const tCommon = useTranslations('common');
  const fieldError = useFieldError();
  const apiErrorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<PricingFormState>(() => initialState(item));
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  const mutation = useMutation({
    mutationFn: (body: CreatePricingInput | UpdatePricingInput) =>
      item ? updateAdminPricing(item.id, body as UpdatePricingInput) : createAdminPricing(body as CreatePricingInput),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      onDone();
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError && error.code === 'CONFLICT') {
        setErrors((current) => ({ ...current, key: t('form.keyExists') }));
      }
    },
  });

  const update = (patch: Partial<PricingFormState>) => setForm((current) => ({ ...current, ...patch }));

  const updateLimit = (field: LimitField, value: string) =>
    setForm((current) => ({ ...current, limits: { ...current.limits, [field]: value } }));

  const limitLabel = (field: LimitField): string => {
    switch (field) {
      case 'projects':
        return t('form.limits.projects');
      case 'aiParsesPerMonth':
        return t('form.limits.aiParsesPerMonth');
      case 'pdfExportsPerMonth':
        return t('form.limits.pdfExportsPerMonth');
      case 'storageMb':
        return t('form.limits.storageMb');
    }
  };

  const submit = () => {
    mutation.reset();
    const nextErrors: Partial<Record<string, string>> = {};
    if (!item && form.key.trim() === '') nextErrors.key = fieldError('required');
    if (form.name.trim() === '') nextErrors.name = fieldError('required');
    if (form.tagline.trim() === '') nextErrors.tagline = fieldError('required');

    const price = parseIntOrNull(form.priceMonthly);
    if (price === 'invalid' || price === null) nextErrors.priceMonthly = fieldError('number_required');

    const sortOrder = parseIntOrNull(form.sortOrder);
    if (sortOrder === 'invalid') nextErrors.sortOrder = fieldError('number_required');

    const limits: Partial<PricingLimits> = {};
    for (const field of LIMIT_FIELDS) {
      const parsed = parseIntOrNull(form.limits[field]);
      if (parsed === 'invalid') nextErrors[`limits.${field}`] = fieldError('number_required');
      else limits[field] = parsed;
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    const common = {
      name: form.name.trim(),
      tagline: form.tagline.trim(),
      priceMonthly: price as number,
      limits: limits as PricingLimits,
      features: parseFeatures(form.features),
      sortOrder: (sortOrder as number | null) ?? 0,
      isActive: form.isActive,
    };

    mutation.mutate(item ? common : { key: form.key.trim(), ...common });
  };

  const disabled = mutation.isPending;

  return (
    <div>
      <button
        type="button"
        onClick={onDone}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('backToList')}
      </button>

      <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink">
        {item ? t('form.editTitle') : t('form.createTitle')}
      </h1>

      <form
        noValidate
        className="mt-6 flex max-w-2xl flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {mutation.isError ? (
          <Alert tone="danger" live>
            {apiErrorMessage(mutation.error)}
          </Alert>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t('form.key')} error={errors.key} hint={item ? t('form.keyLocked') : t('form.keyHint')} required>
            {(control) =>
              item ? (
                <Input {...control} value={form.key} readOnly disabled />
              ) : (
                <Select
                  {...control}
                  value={form.key}
                  disabled={disabled}
                  onChange={(event) => {
                    update({ key: event.target.value });
                    setErrors((current) => ({ ...current, key: undefined }));
                  }}
                >
                  {PRICING_PLAN_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {key}
                    </option>
                  ))}
                </Select>
              )
            }
          </Field>

          <Field label={t('form.name')} error={errors.name} required>
            {(control) => (
              <Input
                {...control}
                value={form.name}
                disabled={disabled}
                onChange={(event) => update({ name: event.target.value })}
              />
            )}
          </Field>
        </div>

        <Field label={t('form.tagline')} error={errors.tagline} required>
          {(control) => (
            <Input
              {...control}
              value={form.tagline}
              disabled={disabled}
              onChange={(event) => update({ tagline: event.target.value })}
            />
          )}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label={t('form.priceMonthly')}
            error={errors.priceMonthly}
            hint={
              parseIntOrNull(form.priceMonthly) === 'invalid' || form.priceMonthly.trim() === ''
                ? t('form.priceHintEmpty')
                : t('form.priceHint', { amount: formatUZS(Number(form.priceMonthly)) })
            }
            required
          >
            {(control) => (
              <Input
                {...control}
                type="number"
                inputMode="numeric"
                min={0}
                step={1000}
                value={form.priceMonthly}
                disabled={disabled}
                onChange={(event) => update({ priceMonthly: event.target.value })}
              />
            )}
          </Field>

          <Field label={t('form.sortOrder')} error={errors.sortOrder} hint={t('form.sortOrderHint')}>
            {(control) => (
              <Input
                {...control}
                type="number"
                inputMode="numeric"
                min={0}
                value={form.sortOrder}
                disabled={disabled}
                onChange={(event) => update({ sortOrder: event.target.value })}
              />
            )}
          </Field>
        </div>

        <fieldset className="rounded-md border border-line bg-surface p-5">
          <legend className="px-1 text-sm font-bold tracking-wide text-ink uppercase">
            {t('form.limitsGroup')}
          </legend>
          <p className="mt-1 text-xs leading-relaxed text-ink-faint">{t('form.limitsHint')}</p>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            {LIMIT_FIELDS.map((field) => (
              <Field
                key={field}
                label={limitLabel(field)}
                error={errors[`limits.${field}`]}
                hint={form.limits[field].trim() === '' ? t('form.unlimited') : undefined}
              >
                {(control) => (
                  <Input
                    {...control}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={form.limits[field]}
                    placeholder={t('form.unlimited')}
                    disabled={disabled}
                    onChange={(event) => updateLimit(field, event.target.value)}
                  />
                )}
              </Field>
            ))}
          </div>
        </fieldset>

        <Field label={t('form.features')} hint={t('form.featuresHint')}>
          {(control) => (
            <Input
              {...control}
              value={form.features}
              disabled={disabled}
              placeholder={t('form.featuresPlaceholder')}
              onChange={(event) => update({ features: event.target.value })}
            />
          )}
        </Field>

        {parseFeatures(form.features).length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {parseFeatures(form.features).map((feature) => (
              <Badge key={feature} tone="neutral" size="sm">
                {feature}
              </Badge>
            ))}
          </div>
        ) : null}

        <label className="flex items-center gap-3 rounded-md border border-line bg-surface px-4 py-3">
          <input
            type="checkbox"
            checked={form.isActive}
            disabled={disabled}
            onChange={(event) => update({ isActive: event.target.checked })}
            className="size-4 rounded border-line-strong text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
          <span className="text-sm font-semibold text-ink">{t('form.isActive')}</span>
        </label>

        <div className="flex items-center justify-end gap-3 border-t border-line pt-5">
          <Button variant="ghost" onClick={onDone} disabled={disabled}>
            {tCommon('cancel')}
          </Button>
          <Button type="submit" variant="accent" loading={mutation.isPending}>
            {item ? t('form.save') : t('form.create')}
          </Button>
        </div>
      </form>
    </div>
  );
}
