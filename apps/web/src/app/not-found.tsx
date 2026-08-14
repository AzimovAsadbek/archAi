import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { buttonClasses } from '@/components/ui/button';
import { Logo } from '@/components/layout/logo';

export default async function NotFound() {
  const t = await getTranslations('errors.notFound');

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <Logo href="/" />
      <p className="numeric mt-10 text-sm font-bold tracking-widest text-ink-faint">404</p>
      <h1 className="mt-2 text-2xl font-extrabold text-ink sm:text-3xl">{t('title')}</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-soft">{t('body')}</p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className={buttonClasses('primary', 'md')}>
          {t('home')}
        </Link>
        <Link href="/dashboard" className={buttonClasses('outline', 'md')}>
          {t('dashboard')}
        </Link>
      </div>
    </div>
  );
}
