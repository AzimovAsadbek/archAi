'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LAYOUT_STRATEGIES, type LayoutStrategy } from '@archai/shared';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { updateProject } from '@/lib/endpoints';
import { queryKeys } from '@/lib/query-keys';
import { useApiErrorMessage } from '@/lib/use-api-error';

export interface StrategySelectProps {
  projectId: string;
  /** The strategy the current plan was generated with (resolved, never null). */
  current: string;
}

/**
 * Manual layout-strategy selector (§45): one compact control where its effect
 * is visible — next to the layout-quality score in the 2D tab. Choosing a
 * strategy PATCHes the project; the strategy is part of the plan cache key, so
 * the invalidated queries come back with freshly optimized geometry and a score
 * computed under the same policy. An explicit choice here always outranks the
 * AI's suggestion (resolveStrategy precedence).
 */
export function StrategySelect({ projectId, current }: StrategySelectProps) {
  const t = useTranslations('floorPlan.quality');
  const tStrategies = useTranslations('strategies');
  const queryClient = useQueryClient();
  const apiErrorMessage = useApiErrorMessage();
  const [error, setError] = useState<string | undefined>();

  const mutation = useMutation({
    mutationFn: (strategy: LayoutStrategy) => updateProject(projectId, { layoutStrategy: strategy }),
    onSuccess: async () => {
      setError(undefined);
      // Prefix invalidation: refetches the project AND its floor-plan query,
      // whose key nests under the project's.
      await queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
    },
    onError: (cause) => setError(apiErrorMessage(cause)),
  });

  const value = (LAYOUT_STRATEGIES as readonly string[]).includes(current)
    ? (current as LayoutStrategy)
    : 'BALANCED';

  return (
    <span className="flex items-center gap-2">
      <label htmlFor={`strategy-${projectId}`} className="text-xs font-semibold text-ink-faint">
        {t('strategyLabel')}
      </label>
      <Select
        id={`strategy-${projectId}`}
        label={t('strategyLabel')}
        value={value}
        disabled={mutation.isPending}
        onChange={(next) => mutation.mutate(next as LayoutStrategy)}
        className="w-auto min-w-40"
        options={LAYOUT_STRATEGIES.map((strategy) => ({
          value: strategy,
          label: tStrategies(`${strategy}.label`),
        }))}
      />
      {mutation.isPending ? <Spinner className="size-3.5 text-ink-faint" /> : null}
      {error ? (
        <span role="alert" className="text-xs font-medium text-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
}
