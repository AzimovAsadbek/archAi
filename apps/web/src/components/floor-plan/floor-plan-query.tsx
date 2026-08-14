'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { Scan, TriangleAlert, XCircle } from 'lucide-react';
import { ENGINE_ISSUE_CODES, type EngineIssue } from '@archai/floor-plan-engine';
import { Button, buttonClasses } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ApiError, isApiError } from '@/lib/api';
import { getFloorPlan, type FloorPlanResponse } from '@/lib/endpoints';
import { queryKeys } from '@/lib/query-keys';
import { useApiErrorMessage } from '@/lib/use-api-error';

/**
 * The persisted floor plan and everything that can go wrong fetching it.
 *
 * The 2D and 3D tabs are two renderings of one drawing, so they share this
 * query (one cache entry, one request) and one set of failure states — the
 * copy lives in the `floorPlan` namespace for both.
 */

const KNOWN_ISSUE_CODES = new Set<string>(ENGINE_ISSUE_CODES);

type IssueValues = Record<string, string | number>;

function num(meta: EngineIssue['meta'], key: string): number {
  const value = meta?.[key];
  return typeof value === 'number' ? value : 0;
}

/**
 * A code can be raised from several places with different meta, so each message
 * only interpolates the keys every variant of that code is guaranteed to carry.
 */
function issueValues(issue: EngineIssue): IssueValues {
  switch (issue.code) {
    case 'ROOM_AREA_UNSATISFIABLE':
      return { floorNumber: num(issue.meta, 'floor') + 1, minSideM: num(issue.meta, 'minSideM') };
    case 'TOO_MANY_ROOMS_PER_FLOOR':
      return { floorNumber: num(issue.meta, 'floor') + 1, rooms: num(issue.meta, 'rooms') };
    case 'ROOM_ON_MISSING_FLOOR':
      return {
        roomNumber: num(issue.meta, 'roomIndex') + 1,
        floorNumber: num(issue.meta, 'floor') + 1,
        floorCount: num(issue.meta, 'floorCount'),
      };
    default:
      return {};
  }
}

/** Localizes an engine issue by code; unknown codes degrade to a generic line. */
function useEngineIssueText(): (issue: EngineIssue) => string {
  const tIssues = useTranslations('floorPlan.issues');
  return (issue) =>
    tIssues(KNOWN_ISSUE_CODES.has(issue.code) ? issue.code : 'unknown', issueValues(issue));
}

/** Contract (docs/api.md): 422 details = { issues: EngineIssue[] }. */
function engineIssuesFrom(error: unknown): EngineIssue[] {
  if (!isApiError(error) || error.code !== 'FLOOR_PLAN_UNAVAILABLE') return [];
  const details = error.details as { issues?: EngineIssue[] } | EngineIssue[] | undefined;
  const issues = Array.isArray(details) ? details : (details?.issues ?? []);
  return issues.filter((issue) => typeof issue?.code === 'string');
}

/**
 * Fetches the plan for a project and refetches it whenever the project itself
 * changes — the API regenerates on demand, so a new `updatedAt` means new
 * geometry.
 */
export function useFloorPlanQuery(
  projectId: string,
  projectUpdatedAt: string,
): UseQueryResult<FloorPlanResponse, Error> {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.floorPlan(projectId),
    queryFn: ({ signal }) => getFloorPlan(projectId, signal),
    // 401 is handled by the API client; the rest of the 4xx family is a stable
    // answer about the configuration, so retrying only delays the message.
    retry: (failureCount, error) =>
      failureCount < 1 &&
      (!(error instanceof ApiError) || error.statusCode === 0 || error.statusCode >= 500),
  });

  const seenUpdatedAt = useRef<string | null>(null);
  useEffect(() => {
    if (seenUpdatedAt.current !== null && seenUpdatedAt.current !== projectUpdatedAt) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.floorPlan(projectId) });
    }
    seenUpdatedAt.current = projectUpdatedAt;
  }, [projectUpdatedAt, projectId, queryClient]);

  return query;
}

export interface FloorPlanErrorStateProps {
  projectId: string;
  error: unknown;
  onRetry: () => void;
  className?: string;
}

/** Not-configured, engine-issue and generic-failure states, in that order. */
export function FloorPlanErrorState({
  projectId,
  error,
  onRetry,
  className,
}: FloorPlanErrorStateProps) {
  const t = useTranslations('floorPlan');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const issueText = useEngineIssueText();

  if (isApiError(error) && error.code === 'PROJECT_NOT_CONFIGURED') {
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

  const issues = engineIssuesFrom(error);
  if (issues.length > 0) {
    return (
      <section aria-label={t('unavailable.title')} className={className}>
        <div className="rounded-md border border-danger/25 bg-danger-soft px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-danger">
            <XCircle className="size-4" aria-hidden="true" />
            {t('unavailable.title')}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">{t('unavailable.body')}</p>
          <ul className="mt-2.5 flex flex-col gap-1.5">
            {issues.map((issue, index) => (
              <li key={`${issue.code}-${index}`} className="flex gap-2 text-sm leading-relaxed text-ink">
                <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-danger" />
                {issueText(issue)}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/projects/${projectId}/edit`} className={buttonClasses('accent', 'md')}>
            {t('unavailable.cta')}
          </Link>
          <Button variant="outline" onClick={onRetry}>
            {tCommon('retry')}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <EmptyState
      className={className}
      tone="danger"
      icon={<TriangleAlert className="size-5" />}
      title={t('loadError')}
      description={apiErrorMessage(error)}
      action={
        <Button variant="outline" onClick={onRetry}>
          {tCommon('retry')}
        </Button>
      }
    />
  );
}
