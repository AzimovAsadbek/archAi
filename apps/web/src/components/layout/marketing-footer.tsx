import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { LocaleSwitcher } from './locale-switcher';
import { Logo } from './logo';

const FOOTER_LINKS = [
  { key: 'pricing', href: '/pricing' },
  { key: 'blog', href: '/blog' },
  { key: 'faq', href: '/faq' },
  { key: 'help', href: '/help' },
  { key: 'about', href: '/about' },
] as const;

export async function MarketingFooter() {
  const t = await getTranslations('marketing.footer');
  const tNav = await getTranslations('nav');

  const label = (key: (typeof FOOTER_LINKS)[number]['key']): string => {
    // Literal keys so the i18n checker can verify each one.
    switch (key) {
      case 'pricing':
        return tNav('pricing');
      case 'blog':
        return tNav('blog');
      case 'faq':
        return tNav('faq');
      case 'help':
        return tNav('help');
      case 'about':
        return tNav('about');
    }
  };

  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-10 sm:flex-row sm:justify-between">
        <div className="max-w-xs">
          <Logo href="/" size="sm" />
          <p className="mt-1.5 text-sm leading-relaxed text-ink-faint">{t('tagline')}</p>
        </div>

        <nav aria-label={t('navLabel')} className="flex flex-col items-start gap-2.5 sm:items-end">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.key}
              href={link.href}
              className="text-sm font-medium text-ink-soft transition-colors hover:text-ink"
            >
              {label(link.key)}
            </Link>
          ))}
        </nav>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col-reverse gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-faint">{t('rights')}</p>
          <LocaleSwitcher />
        </div>
      </div>
    </footer>
  );
}
