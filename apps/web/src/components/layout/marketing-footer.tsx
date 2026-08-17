import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Logo } from './logo';

/**
 * Four-column footer: identity, navigation, help, contact.
 *
 * No language selector here. It lives in the header, and a second copy at the
 * bottom of every page is a second source of truth for the same state — the
 * kind of duplication that eventually disagrees with itself.
 *
 * Link groups are literal rather than generated so the i18n checker can verify
 * every label statically.
 */

const NAV_LINKS = [
  { key: 'projects', href: '/register' },
  { key: 'pricing', href: '/pricing' },
  { key: 'blog', href: '/blog' },
  { key: 'help', href: '/help' },
  { key: 'about', href: '/about' },
] as const;

const HELP_LINKS = [
  { key: 'guide', href: '/help' },
  { key: 'faq', href: '/faq' },
  { key: 'contact', href: '/help#contact' },
] as const;

export async function MarketingFooter() {
  const t = await getTranslations('marketing.footer');
  const tNav = await getTranslations('nav');

  const navLabel = (key: (typeof NAV_LINKS)[number]['key']): string => {
    switch (key) {
      case 'projects':
        return tNav('projects');
      case 'pricing':
        return tNav('pricing');
      case 'blog':
        return tNav('blog');
      case 'help':
        return tNav('help');
      case 'about':
        return tNav('about');
    }
  };

  const helpLabel = (key: (typeof HELP_LINKS)[number]['key']): string => {
    switch (key) {
      case 'guide':
        return t('links.guide');
      case 'faq':
        return tNav('faq');
      case 'contact':
        return t('links.contact');
    }
  };

  const columnHeading = 'text-caption font-bold tracking-wider text-ink uppercase';
  // Footer links were 18px tall — fine for a mouse, too small for a thumb. The
  // inline-flex + min-height gives a 40px target on touch without changing how
  // the column reads on desktop, where the extra height collapses back.
  const columnLink =
    'inline-flex min-h-10 items-center rounded-sm text-sm text-ink-soft transition-colors hover:text-accent-strong sm:min-h-0 sm:py-0.5';

  return (
    <footer className="border-t border-line bg-paper">
      <div className="page-container py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))] lg:gap-8">
          {/* Identity */}
          <div className="max-w-sm">
            <Logo href="/" size="sm" />
            <p className="mt-3 text-sm leading-relaxed text-ink-faint">{t('tagline')}</p>
          </div>

          {/* Navigation */}
          <nav aria-labelledby="footer-nav-heading">
            <h2 id="footer-nav-heading" className={columnHeading}>
              {t('columns.navigation')}
            </h2>
            <ul className="mt-2 flex flex-col sm:mt-4 sm:gap-2.5">
              {NAV_LINKS.map((link) => (
                <li key={link.key}>
                  <Link href={link.href} className={columnLink}>
                    {navLabel(link.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Help */}
          <nav aria-labelledby="footer-help-heading">
            <h2 id="footer-help-heading" className={columnHeading}>
              {t('columns.help')}
            </h2>
            <ul className="mt-2 flex flex-col sm:mt-4 sm:gap-2.5">
              {HELP_LINKS.map((link) => (
                <li key={link.key}>
                  <Link href={link.href} className={columnLink}>
                    {helpLabel(link.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Contact. The reference puts social icons here; archAI has no
              accounts to link to, so this states how to actually reach the
              product rather than linking to profiles that do not exist. */}
          <div>
            <h2 className={columnHeading}>{t('columns.contact')}</h2>
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">{t('contactBody')}</p>
            <Link
              href="/help#contact"
              className="mt-3 inline-flex text-sm font-semibold text-accent-strong hover:underline"
            >
              {t('links.contact')}
            </Link>
          </div>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="page-container flex flex-col-reverse gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-caption text-ink-faint">{t('rights')}</p>
          <p className="text-caption text-ink-faint">{t('disclaimerShort')}</p>
        </div>
      </div>
    </footer>
  );
}
