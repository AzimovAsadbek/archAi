import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { buttonClasses } from '@/components/ui/button';
import { LocaleSwitcher } from './locale-switcher';
import { Logo } from './logo';

export async function MarketingHeader() {
  const t = await getTranslations('nav');

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
        <Logo href="/" />

        <nav aria-label={t('primary')} className="hidden items-center gap-6 md:flex lg:gap-7">
          <Link
            href="/#features"
            className="text-sm font-medium text-ink-soft transition-colors hover:text-ink"
          >
            {t('features')}
          </Link>
          <Link
            href="/pricing"
            className="text-sm font-medium text-ink-soft transition-colors hover:text-ink"
          >
            {t('pricing')}
          </Link>
          <Link
            href="/blog"
            className="text-sm font-medium text-ink-soft transition-colors hover:text-ink"
          >
            {t('blog')}
          </Link>
          <Link
            href="/faq"
            className="text-sm font-medium text-ink-soft transition-colors hover:text-ink"
          >
            {t('faq')}
          </Link>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <LocaleSwitcher className="hidden sm:inline-flex" />
          <Link
            href="/login"
            className="hidden text-sm font-semibold text-ink-soft transition-colors hover:text-ink sm:inline"
          >
            {t('login')}
          </Link>
          <Link href="/register" className={buttonClasses('accent', 'sm')}>
            {t('getStarted')}
          </Link>
        </div>
      </div>
    </header>
  );
}
