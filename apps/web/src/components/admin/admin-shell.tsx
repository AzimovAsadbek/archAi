'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ArrowLeft,
  Calculator,
  FolderKanban,
  HelpCircle,
  Newspaper,
  ScrollText,
  TriangleAlert,
  Users,
  Wallet,
} from 'lucide-react';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { Logo } from '@/components/layout/logo';
import { SkipLink } from '@/components/layout/skip-link';
import { UserMenu } from '@/components/layout/user-menu';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { useApiErrorMessage } from '@/lib/use-api-error';
import { useRequireAuth } from '@/lib/use-auth';

/**
 * The admin area is a different room of the same house: same auth session and
 * chrome vocabulary, but its own navigation so nothing here is reachable by
 * accident from the product UI.
 *
 * The role check is a convenience — every `/admin/*` endpoint enforces ADMIN
 * server-side (docs/admin.md §Backend), so a stale client never grants access.
 */

const NAV_ITEMS = [
  { key: 'users', href: '/admin/users', icon: Users },
  { key: 'projects', href: '/admin/projects', icon: FolderKanban },
  { key: 'faq', href: '/admin/faq', icon: HelpCircle },
  { key: 'blog', href: '/admin/blog', icon: Newspaper },
  { key: 'pricing', href: '/admin/pricing', icon: Wallet },
  { key: 'estimateRules', href: '/admin/estimate-rules', icon: Calculator },
  { key: 'audit', href: '/admin/audit', icon: ScrollText },
] as const;

/** Resolved with literal keys so the i18n checker can verify every one of them. */
function useNavLabels(): Record<(typeof NAV_ITEMS)[number]['key'], string> {
  const tNav = useTranslations('admin.nav');

  return {
    users: tNav('users'),
    projects: tNav('projects'),
    faq: tNav('faq'),
    blog: tNav('blog'),
    pricing: tNav('pricing'),
    estimateRules: tNav('estimateRules'),
    audit: tNav('audit'),
  };
}

function AdminShellSkeleton() {
  return (
    <div className="min-h-dvh bg-paper">
      <div className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-8 w-36" />
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-8 lg:flex-row lg:gap-8">
        <Skeleton className="h-10 w-full lg:h-52 lg:w-56 lg:shrink-0" />
        <div className="min-w-0 flex-1">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="mt-3 h-4 w-72" />
          <Skeleton className="mt-7 h-10 w-full" />
          <Skeleton className="mt-4 h-72 w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}

function AdminNav() {
  const tNav = useTranslations('admin.nav');
  const labels = useNavLabels();
  const pathname = usePathname();

  return (
    <nav aria-label={tNav('label')} className="lg:w-56 lg:shrink-0">
      <ul
        className={cn(
          'flex gap-1 overflow-x-auto border-b border-line pb-2',
          'lg:sticky lg:top-24 lg:flex-col lg:overflow-visible lg:border-b-0 lg:pb-0',
        )}
      >
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors',
                  active
                    ? 'bg-accent-soft text-accent-strong'
                    : 'text-ink-soft hover:bg-line/60 hover:text-ink',
                )}
              >
                <Icon
                  className={cn('size-4 shrink-0', active ? 'text-accent' : 'text-ink-faint')}
                  aria-hidden="true"
                />
                {labels[item.key]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const t = useTranslations('admin');
  const tErrors = useTranslations('errors.appError');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const apiErrorMessage = useApiErrorMessage();
  const { user, isLoading, isUnauthenticated, error, retry } = useRequireAuth();

  const forbidden = user !== undefined && user.role !== 'ADMIN';

  useEffect(() => {
    if (!forbidden) return;
    router.replace('/dashboard');
  }, [forbidden, router]);

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

  if (!user) return <AdminShellSkeleton />;

  // Redirecting: never flash admin data at a non-admin.
  if (forbidden) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper px-5">
        <Alert tone="warning" className="w-full max-w-lg" live>
          {t('forbidden')}
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-paper">
      <SkipLink />
      <header className="sticky top-0 z-30 border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5">
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <div className="flex items-center gap-2">
              <Logo href="/admin/users" size="sm" />
              <Badge tone="accent" size="sm">
                {t('badge')}
              </Badge>
            </div>
            {/* Icon-only on phones: the way back must never disappear entirely. */}
            <Link
              href="/dashboard"
              aria-label={t('backToApp')}
              className="inline-flex items-center gap-1.5 rounded-sm text-sm font-semibold text-ink-faint transition-colors hover:text-ink"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{t('backToApp')}</span>
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <LocaleSwitcher className="hidden sm:inline-flex" />
            <UserMenu user={user} />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-6 lg:flex-row lg:gap-8 lg:py-8">
        <AdminNav />
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}
