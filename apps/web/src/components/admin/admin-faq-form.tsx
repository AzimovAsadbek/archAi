'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  createAdminFaq,
  updateAdminFaq,
  type AdminFaqRow,
  type FaqInput,
} from '@/lib/endpoints';
import { parseNumberInput } from '@/lib/format';
import { useApiErrorMessage } from '@/lib/use-api-error';
import { useFieldError } from '@/lib/zod-errors';

interface FaqFormState {
  question: string;
  answer: string;
  category: string;
  sortOrder: string;
  isPublished: boolean;
}

function initialState(item: AdminFaqRow | null): FaqFormState {
  return {
    question: item?.question ?? '',
    answer: item?.answer ?? '',
    category: item?.category ?? '',
    sortOrder: item ? String(item.sortOrder) : '0',
    isPublished: item?.isPublished ?? true,
  };
}

export function AdminFaqForm({ item, onDone }: { item: AdminFaqRow | null; onDone: () => void }) {
  const t = useTranslations('adminContent.faq');
  const tCommon = useTranslations('common');
  const fieldError = useFieldError();
  const apiErrorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<FaqFormState>(() => initialState(item));
  const [errors, setErrors] = useState<Partial<Record<keyof FaqFormState, string>>>({});

  const mutation = useMutation({
    mutationFn: (body: FaqInput) =>
      item ? updateAdminFaq(item.id, body) : createAdminFaq(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      onDone();
    },
  });

  const update = (patch: Partial<FaqFormState>) => setForm((current) => ({ ...current, ...patch }));

  const submit = () => {
    mutation.reset();
    const nextErrors: Partial<Record<keyof FaqFormState, string>> = {};
    if (form.question.trim() === '') nextErrors.question = fieldError('required');
    if (form.answer.trim() === '') nextErrors.answer = fieldError('required');

    const sortOrder = parseNumberInput(form.sortOrder);
    if (form.sortOrder.trim() !== '' && sortOrder === null) {
      nextErrors.sortOrder = fieldError('number_required');
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    mutation.mutate({
      question: form.question.trim(),
      answer: form.answer.trim(),
      category: form.category.trim() === '' ? null : form.category.trim(),
      sortOrder: sortOrder ?? 0,
      isPublished: form.isPublished,
    });
  };

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

        <Field label={t('form.question')} error={errors.question} required>
          {(control) => (
            <Input
              {...control}
              value={form.question}
              disabled={mutation.isPending}
              onChange={(event) => update({ question: event.target.value })}
            />
          )}
        </Field>

        <Field label={t('form.answer')} error={errors.answer} hint={t('form.answerHint')} required>
          {(control) => (
            <Textarea
              {...control}
              rows={6}
              value={form.answer}
              disabled={mutation.isPending}
              onChange={(event) => update({ answer: event.target.value })}
            />
          )}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t('form.category')} hint={t('form.categoryHint')}>
            {(control) => (
              <Input
                {...control}
                value={form.category}
                disabled={mutation.isPending}
                onChange={(event) => update({ category: event.target.value })}
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
                disabled={mutation.isPending}
                onChange={(event) => update({ sortOrder: event.target.value })}
              />
            )}
          </Field>
        </div>

        <label className="flex items-center gap-3 rounded-md border border-line bg-surface px-4 py-3">
          <input
            type="checkbox"
            checked={form.isPublished}
            disabled={mutation.isPending}
            onChange={(event) => update({ isPublished: event.target.checked })}
            className="size-4 rounded border-line-strong text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
          <span className="text-sm font-semibold text-ink">{t('form.isPublished')}</span>
        </label>

        <div className="flex items-center justify-end gap-3 border-t border-line pt-5">
          <Button variant="ghost" onClick={onDone} disabled={mutation.isPending}>
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
