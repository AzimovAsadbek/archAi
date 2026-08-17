'use client';

import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown } from 'lucide-react';
import { Flag } from '@/components/ui/flag';
import { Popover, PopoverItem } from '@/components/ui/popover';
import { cn } from '@/lib/cn';
import { LOCALES, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, type AppLocale } from '@/i18n/locales';

/**
 * Language selector.
 *
 * Flag on the left, language name to its right, chevron on the far right —
 * never the bare `UZ` abbreviation, which reads as a debug label rather than a
 * choice a person makes. The compact variant drops the name for narrow chrome
 * but keeps the flag and the accessible name, so the control is still
 * identifiable by more than a two-letter code.
 *
 * Built on the shared `Popover`, so dismissal, focus return and arrow-key
 * navigation are the same here as in every other menu in the product.
 */
export function LocaleSwitcher({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const t = useTranslations('locale');
  const active = useLocale() as AppLocale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const select = (locale: AppLocale) => {
    if (locale === active) return;
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
    startTransition(() => router.refresh());
  };

  return (
    <Popover
      role="listbox"
      label={t('label')}
      align="end"
      className={cn(isPending && 'opacity-60', className)}
      trigger={({ open, triggerProps }) => (
        <button
          type="button"
          {...triggerProps}
          ref={triggerProps.ref as React.Ref<HTMLButtonElement>}
          aria-label={`${t('label')}: ${t(`${active}Full`)}`}
          className={cn(
            'flex h-9 items-center gap-2 rounded-tool border border-line bg-surface pr-2 pl-2.5 transition-colors',
            'hover:border-line-strong focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
            open && 'border-line-strong',
          )}
        >
          <Flag locale={active} />
          {!compact ? (
            <span className="text-sm font-semibold text-ink">{t(`${active}Full`)}</span>
          ) : null}
          <ChevronDown
            className={cn(
              'size-3.5 text-ink-faint transition-transform',
              open && 'rotate-180',
            )}
            aria-hidden="true"
          />
        </button>
      )}
    >
      {(close) => (
        <div className="min-w-[180px]">
          {LOCALES.map((locale) => (
            <PopoverItem
              key={locale}
              selected={locale === active}
              onSelect={() => {
                select(locale);
                close();
              }}
            >
              <Flag locale={locale} />
              <span className="flex-1">{t(`${locale}Full`)}</span>
              {locale === active ? (
                <Check className="size-4 shrink-0" aria-hidden="true" />
              ) : null}
            </PopoverItem>
          ))}
        </div>
      )}
    </Popover>
  );
}
