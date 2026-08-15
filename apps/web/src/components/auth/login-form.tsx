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
import { login } from '@/lib/endpoints';
import { queryKeys } from '@/lib/query-keys';
import { useApiErrorMessage } from '@/lib/use-api-error';
import { useFieldError } from '@/lib/zod-errors';

const DEMO_EMAIL = 'demo@archai.uz';
const DEMO_PASSWORD = 'Demo1234!';
// The seeded demo credentials are a dev/demo convenience only; never surface them
// in a production build. Set NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS=true to opt in.
const SHOW_DEMO_CREDENTIALS =
  process.env.NODE_ENV !== 'production' ||
  process.env.NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS === 'true';

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
            <Input
              {...control}
              {...registerField('password')}
              type="password"
              autoComplete="current-password"
              placeholder={t('fields.passwordPlaceholder')}
            />
          )}
        </Field>

        <Button type="submit" variant="accent" fullWidth loading={mutation.isPending}>
          {t('login.submit')}
        </Button>
      </form>

      {SHOW_DEMO_CREDENTIALS ? (
        <div className="mt-6 flex gap-3 rounded-md border border-line bg-paper px-4 py-3">
          <Info className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-semibold text-ink">{t('login.demoTitle')}</p>
            <p className="numeric mt-0.5 text-ink-soft">
              {t('login.demoBody', { email: DEMO_EMAIL, password: DEMO_PASSWORD })}
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
