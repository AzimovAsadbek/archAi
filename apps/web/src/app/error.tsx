'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/layout/logo';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors.appError');

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <Logo href="/" />
      <h1 className="mt-10 text-2xl font-extrabold text-ink sm:text-3xl">{t('title')}</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-soft">{t('body')}</p>
      {error.digest ? (
        <p className="numeric mt-2 text-xs text-ink-faint">{t('reference', { id: error.digest })}</p>
      ) : null}
      <Button className="mt-7" onClick={reset}>
        <RefreshCw className="size-4" aria-hidden="true" />
        {t('retry')}
      </Button>
    </div>
  );
}
