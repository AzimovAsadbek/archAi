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
import { AppHeader } from './app-header';
import { SkipLink } from './skip-link';

function AppShellSkeleton() {
  return (
    <div className="min-h-dvh bg-paper">
      {/* Matches the real bar's height and obsidian, so authenticating does not
          flash a light header and then swap it for a dark one. */}
      <div className="flex h-[var(--size-app-header)] items-center justify-between border-b border-shell-line bg-shell px-3 sm:px-4">
        <Skeleton className="h-5 w-20 bg-shell-raised" />
        <Skeleton className="h-8 w-36 bg-shell-raised" />
      </div>
      <div className="page-container py-10">
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
      <AppHeader
        position="sticky"
        context={
          <nav aria-label={t('primary')} className="hidden sm:block">
            <Link
              href="/dashboard"
              aria-current={projectsActive ? 'page' : undefined}
              className={cn(
                'rounded-sm text-sm font-semibold transition-colors',
                projectsActive
                  ? 'text-shell-ink'
                  : 'text-shell-ink-faint hover:text-shell-ink',
              )}
            >
              {t('projects')}
            </Link>
          </nav>
        }
      />

      <main
        id="main-content"
        tabIndex={-1}
        className="page-container py-8 outline-none sm:py-10"
      >
        {children}
      </main>
    </div>
  );
}
