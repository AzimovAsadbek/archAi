import { type ReactNode } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { Logo } from '@/components/layout/logo';

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('auth');

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo href="/" />
          <LocaleSwitcher />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-10 sm:py-16">
        <div className="w-full max-w-md">
          {children}
          <div className="mt-6 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-ink-faint transition-colors hover:text-ink"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              {t('backToHome')}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
