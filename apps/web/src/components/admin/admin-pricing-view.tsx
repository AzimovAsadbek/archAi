'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, PowerOff, Wallet } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import {
  ADMIN_PAGE_SIZE,
  deactivateAdminPricing,
  listAdminPricing,
  type AdminPricingRow,
  type ListAdminPricingInput,
} from '@/lib/endpoints';
import { formatUZS } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { useApiErrorMessage } from '@/lib/use-api-error';
import { PlanActiveBadge } from './admin-badges';
import { AdminPricingForm } from './admin-pricing-form';
import {
  AdminErrorState,
  AdminPageHeader,
  AdminPagination,
  TableCard,
  TableSkeleton,
  TD_CLASS,
  TH_CLASS,
} from './admin-table';

export function AdminPricingView() {
  const t = useTranslations('adminContent.pricing');
  const apiErrorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<'new' | AdminPricingRow | null>(null);
  const [target, setTarget] = useState<AdminPricingRow | null>(null);

  const query: ListAdminPricingInput = useMemo(() => ({ page, pageSize: ADMIN_PAGE_SIZE }), [page]);

  const pricingQuery = useQuery({
    queryKey: queryKeys.admin.pricing(query),
    queryFn: ({ signal }) => listAdminPricing(query, signal),
    placeholderData: keepPreviousData,
  });

  const deactivateMutation = useMutation({
    mutationFn: (row: AdminPricingRow) => deactivateAdminPricing(row.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
    onSettled: () => setTarget(null),
  });

  const data = pricingQuery.data;
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  if (editing !== null) {
    return <AdminPricingForm item={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />;
  }

  return (
    <div>
      <AdminPageHeader
        title={t('title')}
        description={t('subtitle')}
        meta={t('count', { count: total })}
        action={
          <Button variant="accent" onClick={() => setEditing('new')}>
            <Plus className="size-4" aria-hidden="true" />
            {t('new')}
          </Button>
        }
      />

      {deactivateMutation.isError ? (
        <Alert tone="danger" live className="mt-5">
          {apiErrorMessage(deactivateMutation.error)}
        </Alert>
      ) : null}

      {pricingQuery.isPending ? (
        <TableSkeleton columns={5} />
      ) : pricingQuery.isError ? (
        <AdminErrorState message={apiErrorMessage(pricingQuery.error)} onRetry={() => void pricingQuery.refetch()} />
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyState
          className="mt-6"
          icon={<Wallet className="size-5" />}
          title={t('empty.title')}
          description={t('empty.body')}
          action={
            <Button variant="accent" onClick={() => setEditing('new')}>
              <Plus className="size-4" aria-hidden="true" />
              {t('new')}
            </Button>
          }
        />
      ) : (
        <TableCard
          caption={t('caption')}
          head={
            <>
              <th scope="col" className={TH_CLASS}>
                {t('columns.key')}
              </th>
              <th scope="col" className={TH_CLASS}>
                {t('columns.name')}
              </th>
              <th scope="col" className={`${TH_CLASS} text-right`}>
                {t('columns.price')}
              </th>
              <th scope="col" className={TH_CLASS}>
                {t('columns.status')}
              </th>
              <th scope="col" className={`${TH_CLASS} text-right`}>
                {t('columns.order')}
              </th>
              <th scope="col" className={`${TH_CLASS} text-right`}>
                <span className="sr-only">{t('columns.actions')}</span>
              </th>
            </>
          }
        >
          {(data?.items ?? []).map((row) => (
            <tr key={row.id} className="border-t border-line">
              <td className={`${TD_CLASS} font-semibold text-ink`}>
                <code className="text-[12px]">{row.key}</code>
              </td>
              <td className={`${TD_CLASS} text-ink-soft`}>{row.name}</td>
              <td className={`numeric ${TD_CLASS} text-right whitespace-nowrap text-ink-soft`}>
                {t('priceValue', { amount: formatUZS(row.priceMonthly) })}
              </td>
              <td className={TD_CLASS}>
                <PlanActiveBadge isActive={row.isActive} />
              </td>
              <td className={`numeric ${TD_CLASS} text-right text-ink-soft`}>{row.sortOrder}</td>
              <td className={`${TD_CLASS} text-right whitespace-nowrap`}>
                <div className="inline-flex gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => setEditing(row)}>
                    <Pencil className="size-3.5" aria-hidden="true" />
                    {t('editAction')}
                  </Button>
                  {row.isActive ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t('deactivateAction')}
                      onClick={() => setTarget(row)}
                    >
                      <PowerOff className="size-3.5 text-danger" aria-hidden="true" />
                    </Button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </TableCard>
      )}

      <AdminPagination
        page={page}
        pageCount={pageCount}
        busy={pricingQuery.isFetching}
        onPageChange={setPage}
      />

      <ConfirmDialog
        open={target !== null}
        variant="danger"
        pending={deactivateMutation.isPending}
        title={t('confirmDeactivate.title')}
        description={target ? t('confirmDeactivate.body', { name: target.name }) : undefined}
        confirmLabel={t('confirmDeactivate.confirm')}
        onCancel={() => setTarget(null)}
        onConfirm={() => {
          if (target) deactivateMutation.mutate(target);
        }}
      />
    </div>
  );
}
