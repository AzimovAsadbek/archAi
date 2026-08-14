'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HelpCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import {
  ADMIN_PAGE_SIZE,
  deleteAdminFaq,
  listAdminFaq,
  type AdminFaqRow,
  type ListAdminFaqInput,
} from '@/lib/endpoints';
import { queryKeys } from '@/lib/query-keys';
import { useApiErrorMessage } from '@/lib/use-api-error';
import { PublishedBadge } from './admin-badges';
import { AdminFaqForm } from './admin-faq-form';
import {
  AdminErrorState,
  AdminPageHeader,
  AdminPagination,
  TableCard,
  TableSkeleton,
  TD_CLASS,
  TH_CLASS,
} from './admin-table';

export function AdminFaqView() {
  const t = useTranslations('adminContent.faq');
  const apiErrorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<'new' | AdminFaqRow | null>(null);
  const [target, setTarget] = useState<AdminFaqRow | null>(null);

  const query: ListAdminFaqInput = useMemo(() => ({ page, pageSize: ADMIN_PAGE_SIZE }), [page]);

  const faqQuery = useQuery({
    queryKey: queryKeys.admin.faq(query),
    queryFn: ({ signal }) => listAdminFaq(query, signal),
    placeholderData: keepPreviousData,
  });

  const removeMutation = useMutation({
    mutationFn: (row: AdminFaqRow) => deleteAdminFaq(row.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
    onSettled: () => setTarget(null),
  });

  const data = faqQuery.data;
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));

  // Never leave the pager past the last page after deletes.
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  if (editing !== null) {
    return <AdminFaqForm item={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />;
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

      {removeMutation.isError ? (
        <Alert tone="danger" live className="mt-5">
          {apiErrorMessage(removeMutation.error)}
        </Alert>
      ) : null}

      {faqQuery.isPending ? (
        <TableSkeleton columns={4} />
      ) : faqQuery.isError ? (
        <AdminErrorState message={apiErrorMessage(faqQuery.error)} onRetry={() => void faqQuery.refetch()} />
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyState
          className="mt-6"
          icon={<HelpCircle className="size-5" />}
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
                {t('columns.question')}
              </th>
              <th scope="col" className={TH_CLASS}>
                {t('columns.category')}
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
              <td className={`${TD_CLASS} max-w-md font-semibold text-ink`}>{row.question}</td>
              <td className={`${TD_CLASS} text-ink-soft`}>
                {row.category ?? <span className="text-ink-faint">{t('noCategory')}</span>}
              </td>
              <td className={TD_CLASS}>
                <PublishedBadge isPublished={row.isPublished} />
              </td>
              <td className={`numeric ${TD_CLASS} text-right text-ink-soft`}>{row.sortOrder}</td>
              <td className={`${TD_CLASS} text-right whitespace-nowrap`}>
                <div className="inline-flex gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => setEditing(row)}>
                    <Pencil className="size-3.5" aria-hidden="true" />
                    {t('editAction')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={t('deleteAction')}
                    onClick={() => setTarget(row)}
                  >
                    <Trash2 className="size-3.5 text-danger" aria-hidden="true" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </TableCard>
      )}

      <AdminPagination page={page} pageCount={pageCount} busy={faqQuery.isFetching} onPageChange={setPage} />

      <ConfirmDialog
        open={target !== null}
        variant="danger"
        pending={removeMutation.isPending}
        title={t('confirmDelete.title')}
        description={target ? t('confirmDelete.body', { question: target.question }) : undefined}
        confirmLabel={t('confirmDelete.confirm')}
        onCancel={() => setTarget(null)}
        onConfirm={() => {
          if (target) removeMutation.mutate(target);
        }}
      />
    </div>
  );
}
