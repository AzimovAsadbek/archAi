'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, PencilLine } from 'lucide-react';
import { createProjectSchema, type CreateProjectInput } from '@archai/shared';
import { Alert } from '@/components/ui/alert';
import { Button, buttonClasses } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { createProject } from '@/lib/endpoints';
import { queryKeys } from '@/lib/query-keys';
import { useApiErrorMessage } from '@/lib/use-api-error';
import { useFieldError } from '@/lib/zod-errors';

export function NewProjectForm() {
  const t = useTranslations('projectNew');
  const router = useRouter();
  const queryClient = useQueryClient();
  const fieldError = useFieldError();
  const apiErrorMessage = useApiErrorMessage();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: { name: '', description: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: CreateProjectInput) =>
      createProject({
        name: values.name,
        description:
          typeof values.description === 'string' && values.description.trim() !== ''
            ? values.description
            : null,
      }),
    onSuccess: (project) => {
      queryClient.setQueryData(queryKeys.project(project.id), project);
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      router.push(`/projects/${project.id}/edit`);
    },
  });

  return (
    <div className="rounded-md border border-line bg-surface p-6 shadow-card sm:p-8">
      <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-ink">
        <PencilLine className="size-5 text-ink-faint" aria-hidden="true" />
        {t('formTitle')}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t('subtitle')}</p>

      <form
        noValidate
        className="mt-7 flex flex-col gap-5"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
      >
        {mutation.isError ? (
          <Alert tone="danger" live>
            {apiErrorMessage(mutation.error)}
          </Alert>
        ) : null}

        <Field label={t('name')} error={fieldError(errors.name?.message)} required>
          {(control) => (
            <Input {...control} {...register('name')} placeholder={t('namePlaceholder')} />
          )}
        </Field>

        <Field
          label={t('description')}
          error={fieldError(errors.description?.message)}
          hint={t('descriptionHint')}
        >
          {(control) => (
            <Textarea
              {...control}
              {...register('description')}
              placeholder={t('descriptionPlaceholder')}
            />
          )}
        </Field>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link href="/dashboard" className={buttonClasses('ghost', 'md')}>
            {t('cancel')}
          </Link>
          <Button type="submit" variant="accent" loading={mutation.isPending}>
            {t('submit')}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </form>
    </div>
  );
}
