'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Menu as MenuIcon, X } from 'lucide-react';
import { LocaleSwitcher } from './locale-switcher';

/** Marketing nav links surfaced in the hamburger below the `md` breakpoint. */
const LINKS = [
  { href: '/#features', key: 'features' },
  { href: '/pricing', key: 'pricing' },
  { href: '/blog', key: 'blog' },
  { href: '/faq', key: 'faq' },
] as const;

const PANEL_ID = 'marketing-mobile-menu';

/**
 * Accessible disclosure for small screens: exposes the primary nav, the login
 * link and the locale switcher (all hidden from the header below `md`). Closes on
 * Escape or outside click and returns focus to the toggle.
 */
export function MarketingMobileMenu() {
  const t = useTranslations('nav');
  const tLocale = useTranslations('locale');
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const closeAndFocus = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAndFocus();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  // Move focus into the panel when it opens.
  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLElement>('a, button')?.focus();
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={PANEL_ID}
        aria-label={open ? t('closeMenu') : t('openMenu')}
        onClick={() => setOpen((value) => !value)}
        className="flex size-10 items-center justify-center rounded-md border border-line bg-surface text-ink-soft transition-colors hover:bg-paper"
      >
        {open ? (
          <X className="size-5" aria-hidden="true" />
        ) : (
          <MenuIcon className="size-5" aria-hidden="true" />
        )}
      </button>

      {open ? (
        <div
          id={PANEL_ID}
          ref={panelRef}
          className="absolute inset-x-0 top-16 z-40 border-b border-line bg-paper shadow-card"
        >
          <nav
            aria-label={t('primary')}
            className="page-container flex flex-col gap-0.5 py-4"
          >
            {LINKS.map((link) => (
              <Link
                key={link.key}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-sm px-2 py-2.5 text-sm font-semibold text-ink-soft transition-colors hover:bg-surface hover:text-ink"
              >
                {t(link.key)}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="rounded-sm px-2 py-2.5 text-sm font-semibold text-ink-soft transition-colors hover:bg-surface hover:text-ink"
            >
              {t('login')}
            </Link>
            <div className="mt-2 flex items-center justify-between gap-3 border-t border-line px-2 pt-3">
              <span className="text-xs font-semibold text-ink-faint">{tLocale('label')}</span>
              <LocaleSwitcher />
            </div>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
