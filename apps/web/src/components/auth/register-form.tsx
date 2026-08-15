'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { registerSchema, type RegisterInput } from '@archai/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { register as registerRequest } from '@/lib/endpoints';
import { queryKeys } from '@/lib/query-keys';
import { useApiErrorMessage } from '@/lib/use-api-error';
import { useFieldError } from '@/lib/zod-errors';

export function RegisterForm({ next }: { next: string }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const queryClient = useQueryClient();
  const fieldError = useFieldError();
  const apiErrorMessage = useApiErrorMessage();

  const {
    register: registerField,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', password: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: RegisterInput) => registerRequest(values),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.me, data.user);
      router.replace(next);
    },
  });

  return (
    <div className="rounded-md border border-line bg-surface p-6 shadow-card sm:p-8">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">{t('register.title')}</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t('register.subtitle')}</p>

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

        <Field label={t('fields.fullName')} error={fieldError(errors.fullName?.message)} required>
          {(control) => (
            <Input
              {...control}
              {...registerField('fullName')}
              autoComplete="name"
              placeholder={t('fields.fullNamePlaceholder')}
            />
          )}
        </Field>

        <Field label={t('fields.email')} error={fieldError(errors.email?.message)} required>
          {(control) => (
            <Input
              {...control}
              {...registerField('email')}
              type="email"
              autoComplete="email"
              placeholder={t('fields.emailPlaceholder')}
            />
          )}
        </Field>

        <Field
          label={t('fields.password')}
          error={fieldError(errors.password?.message)}
          hint={t('fields.passwordHint')}
          required
        >
          {(control) => (
            <Input
              {...control}
              {...registerField('password')}
              type="password"
              autoComplete="new-password"
              placeholder={t('fields.passwordPlaceholder')}
            />
          )}
        </Field>

        <Button type="submit" variant="accent" fullWidth loading={mutation.isPending}>
          {t('register.submit')}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-soft">
        {t('register.haveAccount')}{' '}
        <Link href="/login" className="rounded-sm font-semibold text-accent-strong hover:underline">
          {t('register.signIn')}
        </Link>
      </p>
    </div>
  );
}
