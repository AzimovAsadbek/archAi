import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { buttonClasses } from '@/components/ui/button';
import { LocaleSwitcher } from './locale-switcher';
import { MarketingNav } from './marketing-nav';
import { Logo } from './logo';
import { MarketingMobileMenu } from './marketing-mobile-menu';

export async function MarketingHeader() {
  const t = await getTranslations('nav');

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper">
      <div className="page-container flex h-16 items-center justify-between gap-4">
        <Logo href="/" />

        <MarketingNav className="hidden md:flex" />

        <div className="flex items-center gap-2 sm:gap-3">
          <LocaleSwitcher className="hidden md:block" />
          <Link
            href="/login"
            className="hidden text-sm font-semibold text-ink-soft transition-colors hover:text-ink md:inline"
          >
            {t('login')}
          </Link>
          <Link href="/register" className={buttonClasses('accent', 'sm')}>
            {t('getStarted')}
          </Link>
          <MarketingMobileMenu />
        </div>
      </div>
    </header>
  );
}
