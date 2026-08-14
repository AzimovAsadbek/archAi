'use client';

import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import { LOCALES, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, type AppLocale } from '@/i18n/locales';

export function LocaleSwitcher({ className }: { className?: string }) {
  const t = useTranslations('locale');
  const active = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const select = (locale: AppLocale) => {
    if (locale === active) return;
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
    startTransition(() => router.refresh());
  };

  return (
    <div
      role="group"
      aria-label={t('label')}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md border border-line bg-surface p-0.5',
        isPending && 'opacity-60',
        className,
      )}
    >
      {LOCALES.map((locale) => {
        const isActive = locale === active;
        return (
          <button
            key={locale}
            type="button"
            onClick={() => select(locale)}
            aria-current={isActive ? 'true' : undefined}
            aria-label={t(`${locale}Full`)}
            className={cn(
              'rounded-sm px-2 py-1 text-xs font-bold transition-colors',
              isActive ? 'bg-ink text-paper' : 'text-ink-faint hover:bg-paper hover:text-ink',
            )}
          >
            {t(locale)}
          </button>
        );
      })}
    </div>
  );
}
