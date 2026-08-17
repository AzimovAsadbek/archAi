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
  tone = 'paper',
}: {
  className?: string;
  /**
   * `true` drops the language name entirely; `'sm'` keeps it but hides it below
   * the `sm` breakpoint, for chrome that is crowded on a phone and roomy above
   * it. A full-screen mobile menu wants the name, so it stays `false` there.
   */
  compact?: boolean | 'sm';
  /** Surface the trigger sits on. The dropdown itself stays a light popover. */
  tone?: 'paper' | 'shell';
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
            'flex h-9 items-center gap-2 rounded-tool border pr-2 pl-2.5 transition-colors',
            'focus-visible:ring-2 focus-visible:outline-none',
            tone === 'shell'
              ? 'border-shell-line bg-shell-raised hover:border-shell-ink-faint focus-visible:ring-accent-on-shell'
              : 'border-line bg-surface hover:border-line-strong focus-visible:ring-accent',
            open && (tone === 'shell' ? 'border-shell-ink-faint' : 'border-line-strong'),
          )}
        >
          <Flag locale={active} />
          {compact !== true ? (
            <span
              className={cn(
                'text-sm font-semibold',
                // The accessible name on the button always carries the language,
                // so hiding the word never leaves a bare two-letter code.
                compact === 'sm' ? 'hidden sm:inline' : 'inline',
                tone === 'shell' ? 'text-shell-ink' : 'text-ink',
              )}
            >
              {t(`${active}Full`)}
            </span>
          ) : null}
          <ChevronDown
            className={cn(
              'size-3.5 transition-transform',
              tone === 'shell' ? 'text-shell-ink-faint' : 'text-ink-faint',
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
