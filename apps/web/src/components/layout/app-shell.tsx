'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useApiErrorMessage } from '@/lib/use-api-error';
import { useRequireAuth } from '@/lib/use-auth';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { LocaleSwitcher } from './locale-switcher';
import { Logo } from './logo';
import { SkipLink } from './skip-link';
import { UserMenu } from './user-menu';

function AppShellSkeleton() {
  return (
    <div className="min-h-dvh bg-paper">
      <div className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-8 w-36" />
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-5 py-10">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-3 h-4 w-72" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <Skeleton key={index} className="h-36 rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations('nav');
  const tErrors = useTranslations('errors.appError');
  const tCommon = useTranslations('common');
  const pathname = usePathname();
  const apiErrorMessage = useApiErrorMessage();
  const { user, isLoading, isUnauthenticated, error, retry } = useRequireAuth();

  // A 401 redirects to /login, so only "server unreachable" style failures land here.
  if (!user && !isLoading && !isUnauthenticated && error) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper px-5">
        <EmptyState
          tone="danger"
          className="w-full max-w-lg"
          icon={<TriangleAlert className="size-5" />}
          title={tErrors('title')}
          description={apiErrorMessage(error)}
          action={
            <Button variant="outline" onClick={() => void retry()}>
              {tCommon('retry')}
            </Button>
          }
        />
      </div>
    );
  }

  if (!user) return <AppShellSkeleton />;

  const projectsActive = pathname === '/dashboard' || pathname.startsWith('/projects');

  return (
    <div className="min-h-dvh bg-paper">
      <SkipLink />
      <header className="sticky top-0 z-30 border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
          <div className="flex items-center gap-7">
            <Logo href="/dashboard" size="sm" />
            <nav aria-label={t('primary')} className="hidden sm:block">
              <Link
                href="/dashboard"
                aria-current={projectsActive ? 'page' : undefined}
                className={cn(
                  'rounded-sm text-sm font-semibold transition-colors',
                  projectsActive ? 'text-ink' : 'text-ink-faint hover:text-ink',
                )}
              >
                {t('projects')}
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <LocaleSwitcher className="inline-flex" />
            <UserMenu user={user} />
          </div>
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-6xl px-5 py-8 outline-none sm:py-10"
      >
        {children}
      </main>
    </div>
  );
}
