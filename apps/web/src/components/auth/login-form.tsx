'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import { loginSchema, type LoginInput } from '@archai/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { login } from '@/lib/endpoints';
import { queryKeys } from '@/lib/query-keys';
import { useApiErrorMessage } from '@/lib/use-api-error';
import { useFieldError } from '@/lib/zod-errors';

// The seeded demo credentials are a dev/demo convenience only; never surface them
// in a production build. Set NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS=true to opt in.
const SHOW_DEMO_CREDENTIALS =
  process.env.NODE_ENV !== 'production' ||
  process.env.NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS === 'true';

/**
 * Held inside the flag rather than beside it.
 *
 * Both operands of `SHOW_DEMO_CREDENTIALS` are inlined at build time, so in a
 * production build this whole expression folds to `null` and the strings below
 * are eliminated. As top-level constants they survived instead: the panel was
 * correctly hidden, but `Demo1234!` still shipped in the JavaScript, handing a
 * reader of the bundle the exact password to try against a seeded environment.
 */
const DEMO_CREDENTIALS = SHOW_DEMO_CREDENTIALS
  ? { email: 'demo@archai.uz', password: 'Demo1234!' }
  : null;

export function LoginForm({ next }: { next: string }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const queryClient = useQueryClient();
  const fieldError = useFieldError();
  const apiErrorMessage = useApiErrorMessage();

  const {
    register: registerField,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: LoginInput) => login(values),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.me, data.user);
      router.replace(next);
    },
  });

  return (
    <div className="rounded-md border border-line bg-surface p-6 shadow-card sm:p-8">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">{t('login.title')}</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t('login.subtitle')}</p>

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

        <Field label={t('fields.password')} error={fieldError(errors.password?.message)} required>
          {(control) => (
            <PasswordInput
              {...control}
              {...registerField('password')}
              autoComplete="current-password"
              placeholder={t('fields.passwordPlaceholder')}
            />
          )}
        </Field>

        <Button type="submit" variant="accent" fullWidth loading={mutation.isPending}>
          {t('login.submit')}
        </Button>
      </form>

      {DEMO_CREDENTIALS ? (
        <div className="mt-6 flex gap-3 rounded-md border border-line bg-paper px-4 py-3">
          <Info className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-semibold text-ink">{t('login.demoTitle')}</p>
            <p className="numeric mt-0.5 text-ink-soft">
              {t('login.demoBody', {
                email: DEMO_CREDENTIALS.email,
                password: DEMO_CREDENTIALS.password,
              })}
            </p>
          </div>
        </div>
      ) : null}

      <p className="mt-6 text-center text-sm text-ink-soft">
        {t('login.noAccount')}{' '}
        <Link href="/register" className="rounded-sm font-semibold text-accent-strong hover:underline">
          {t('login.createAccount')}
        </Link>
      </p>
    </div>
  );
}
