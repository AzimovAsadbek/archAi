'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';

/**
 * Primary marketing navigation with a real active state.
 *
 * The header previously had none: no current-page indicator, no `aria-current`,
 * and no link to the home page at all. A visitor could not tell where they
 * were.
 *
 * Matching is prefix-based for sections (so `/blog/some-post` still marks Blog
 * as current) but exact for `/`, which would otherwise match every route.
 */

const LINKS = [
  { key: 'home', href: '/', exact: true },
  { key: 'projects', href: '/register', exact: false },
  { key: 'pricing', href: '/pricing', exact: false },
  { key: 'blog', href: '/blog', exact: false },
  { key: 'help', href: '/help', exact: false },
  { key: 'about', href: '/about', exact: false },
] as const;

export function MarketingNav({ className }: { className?: string }) {
  const t = useTranslations('nav');
  const pathname = usePathname();

  const label = (key: (typeof LINKS)[number]['key']): string => {
    // Literal keys so the i18n checker can verify each one statically.
    switch (key) {
      case 'home':
        return t('home');
      case 'projects':
        return t('projects');
      case 'pricing':
        return t('pricing');
      case 'blog':
        return t('blog');
      case 'help':
        return t('help');
      case 'about':
        return t('about');
    }
  };

  const isActive = (href: string, exact: boolean): boolean =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav aria-label={t('primary')} className={cn('items-center gap-1', className)}>
      {LINKS.map((link) => {
        const active = isActive(link.href, link.exact);
        return (
          <Link
            key={link.key}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative rounded-tool px-3 py-2 text-sm font-semibold transition-colors',
              // The underline is an absolutely positioned rule rather than a
              // border, so an inactive link reserves no space for it and the
              // row never shifts when the active item changes.
              'after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:transition-colors',
              active
                ? 'text-ink after:bg-accent'
                : 'text-ink-soft after:bg-transparent hover:text-ink',
            )}
          >
            {label(link.key)}
          </Link>
        );
      })}
    </nav>
  );
}
