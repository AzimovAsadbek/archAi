import { getTranslations } from 'next-intl/server';
import { LocaleSwitcher } from './locale-switcher';
import { Logo } from './logo';

export async function MarketingFooter() {
  const t = await getTranslations('marketing.footer');

  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Logo href="/" size="sm" />
          <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-ink-faint">{t('tagline')}</p>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          <LocaleSwitcher />
          <p className="text-xs text-ink-faint">{t('rights')}</p>
        </div>
      </div>
    </footer>
  );
}
