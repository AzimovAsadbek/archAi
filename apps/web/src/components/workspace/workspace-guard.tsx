'use client';

import { type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiErrorMessage } from '@/lib/use-api-error';
import { useRequireAuth } from '@/lib/use-auth';

/**
 * Authentication gate for the workspace route group.
 *
 * The workspace deliberately does not sit inside `AppShell`: the studio frame
 * owns the whole viewport, and the app chrome would add a second header and a
 * `max-w-6xl` wrapper the canvas cannot live inside. This reproduces the one
 * thing the shell was still providing — the auth guard — and nothing else, so
 * the two paths cannot drift on who is allowed in.
 *
 * Authorization remains server-side, exactly as before; this only decides what
 * to render while the session is being established.
 */
export function WorkspaceGuard({ children }: { children: ReactNode }) {
  const tErrors = useTranslations('errors.appError');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const { user, isLoading, isUnauthenticated, error, retry } = useRequireAuth();

  // A 401 redirects to /login, so only "server unreachable" failures land here.
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

  // Skeleton shaped like the studio frame, so the layout does not jump when the
  // session resolves: dark bar, dark rail, light canvas.
  if (!user) {
    return (
      <div className="flex h-dvh flex-col overflow-hidden bg-shell">
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-shell-line px-3">
          <Skeleton className="h-5 w-40 bg-shell-raised" />
        </div>
        <div className="flex min-h-0 flex-1">
          <div className="w-52 shrink-0 border-r border-shell-line p-2">
            <Skeleton className="h-8 w-full bg-shell-raised" />
          </div>
          <div className="min-h-0 flex-1 bg-paper p-6">
            <Skeleton className="h-full w-full rounded-panel" />
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
