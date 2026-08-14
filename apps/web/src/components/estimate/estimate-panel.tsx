'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Scan, TriangleAlert } from 'lucide-react';
import { type FinishLevel } from '@archai/shared';
import { Alert } from '@/components/ui/alert';
import { Button, buttonClasses } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, isApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { getProjectEstimate } from '@/lib/endpoints';
import { queryKeys } from '@/lib/query-keys';
import { useApiErrorMessage } from '@/lib/use-api-error';
import { EstimateBreakdown } from './estimate-breakdown';
import { EstimateSummary } from './estimate-summary';
import { FinishLevelControl, useFinishLevelCopy } from './finish-level-control';

/**
 * The Smeta tab. The API computes the estimate on demand from the saved
 * configuration, so this panel owns exactly one piece of state — the finish
 * level — and everything else is the server's answer for it.
 */

function PanelSkeleton({ className }: { className?: string }) {
  return (
    <div className={className}>
      <Skeleton className="h-3.5 w-32" />
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-[74px] rounded-md" />
        ))}
      </div>
      <Skeleton className="mt-6 h-44 w-full rounded-md" />
      <Skeleton className="mt-6 h-72 w-full rounded-md" />
    </div>
  );
}

export interface EstimatePanelProps {
  projectId: string;
  /** The estimate follows the configuration — a new value refetches it. */
  projectUpdatedAt: string;
  className?: string;
}

export function EstimatePanel({ projectId, projectUpdatedAt, className }: EstimatePanelProps) {
  const t = useTranslations('estimate');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();
  const levelCopy = useFinishLevelCopy();

  const [finishLevel, setFinishLevel] = useState<FinishLevel>('STANDARD');

  const query = useQuery({
    queryKey: queryKeys.estimate(projectId, finishLevel),
    queryFn: ({ signal }) => getProjectEstimate(projectId, finishLevel, signal),
    // Switching level swaps the query key: keep the previous numbers on screen
    // until the new ones land instead of dropping back to a skeleton.
    placeholderData: keepPreviousData,
    // 401 is handled by the API client; the rest of the 4xx family is a stable
    // answer about the configuration, so retrying only delays the message.
    retry: (failureCount, error) =>
      failureCount < 1 &&
      (!(error instanceof ApiError) || error.statusCode === 0 || error.statusCode >= 500),
  });

  // The configurator writes the saved project straight into the cache, so a
  // changed `updatedAt` is what tells us the numbers behind every level moved.
  const seenUpdatedAt = useRef<string | null>(null);
  useEffect(() => {
    if (seenUpdatedAt.current !== null && seenUpdatedAt.current !== projectUpdatedAt) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.estimates(projectId) });
    }
    seenUpdatedAt.current = projectUpdatedAt;
  }, [projectUpdatedAt, projectId, queryClient]);

  if (query.isPending) return <PanelSkeleton className={className} />;

  if (query.isError) {
    if (isApiError(query.error) && query.error.code === 'PROJECT_NOT_CONFIGURED') {
      return (
        <EmptyState
          className={className}
          icon={<Scan className="size-5" />}
          title={t('notConfigured.title')}
          description={t('notConfigured.body')}
          action={
            <Link href={`/projects/${projectId}/edit`} className={buttonClasses('accent', 'md')}>
              {t('notConfigured.cta')}
            </Link>
          }
        />
      );
    }

    return (
      <EmptyState
        className={className}
        tone="danger"
        icon={<TriangleAlert className="size-5" />}
        title={t('loadError')}
        description={apiErrorMessage(query.error)}
        action={
          <Button variant="outline" onClick={() => void query.refetch()}>
            {tCommon('retry')}
          </Button>
        }
      />
    );
  }

  const { estimate } = query.data;
  const pendingLevel = query.isPlaceholderData;

  return (
    <div className={className}>
      <FinishLevelControl value={finishLevel} onChange={setFinishLevel} />

      <div
        aria-busy={pendingLevel || undefined}
        className={cn('transition-opacity duration-150', pendingLevel && 'opacity-55')}
      >
        <EstimateSummary className="mt-6" estimate={estimate} />

        <EstimateBreakdown
          className="mt-6"
          estimate={estimate}
          finishLevelLabel={levelCopy[estimate.finishLevel].label}
        />

        <Alert tone="warning" title={t('disclaimer.title')} className="mt-6">
          {t('disclaimer.body')}
        </Alert>

        <p className="mt-3 text-xs leading-relaxed text-ink-faint">
          {t('footnote', {
            version: estimate.rulesVersion,
            level: levelCopy[estimate.finishLevel].label,
          })}
        </p>
      </div>
    </div>
  );
}
