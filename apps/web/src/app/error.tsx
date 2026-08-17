'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Home, RefreshCw } from 'lucide-react';
import { Button, buttonClasses } from '@/components/ui/button';
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
      {/* Retry first, but always offer a way out: when the failure is in the
          route itself, resetting lands the user on the same broken page. */}
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset}>
          <RefreshCw className="size-4" aria-hidden="true" />
          {t('retry')}
        </Button>
        <Link href="/" className={buttonClasses('outline', 'md')}>
          <Home className="size-4" aria-hidden="true" />
          {t('home')}
        </Link>
      </div>
    </div>
  );
}
