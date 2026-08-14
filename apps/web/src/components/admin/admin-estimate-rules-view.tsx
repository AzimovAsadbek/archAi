'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { listAdminEstimateRules } from '@/lib/endpoints';
import { queryKeys } from '@/lib/query-keys';
import { useApiErrorMessage } from '@/lib/use-api-error';
import { AdminErrorState, AdminPageHeader } from './admin-table';
import { AdminRulesForm } from './admin-rules-form';
import { AdminRulesHistory } from './admin-rules-history';

function RulesSkeleton() {
  return (
    <div className="mt-6 flex flex-col gap-4">
      {[0, 1, 2, 3].map((index) => (
        <Skeleton key={index} className="h-44 rounded-md" />
      ))}
    </div>
  );
}

export function AdminEstimateRulesView() {
  const t = useTranslations('admin.rules');
  const apiErrorMessage = useApiErrorMessage();

  const rulesQuery = useQuery({
    queryKey: queryKeys.admin.estimateRules,
    queryFn: ({ signal }) => listAdminEstimateRules(signal),
  });

  const items = rulesQuery.data?.items ?? [];
  const active = items.find((rule) => rule.isActive);

  return (
    <div>
      <AdminPageHeader
        title={t('title')}
        description={t('subtitle')}
        meta={active ? t('activeVersion', { version: active.version }) : undefined}
      />

      {rulesQuery.isPending ? (
        <RulesSkeleton />
      ) : rulesQuery.isError ? (
        <AdminErrorState
          message={apiErrorMessage(rulesQuery.error)}
          onRetry={() => void rulesQuery.refetch()}
        />
      ) : (
        <>
          <AdminRulesForm active={active} />
          <AdminRulesHistory items={items} />
        </>
      )}
    </div>
  );
}
