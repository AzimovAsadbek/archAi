'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Newspaper, Pencil, Plus, Trash2 } from 'lucide-react';
import { BLOG_STATUSES, type BlogStatus } from '@archai/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Select } from '@/components/ui/select';
import {
  ADMIN_PAGE_SIZE,
  deleteAdminBlog,
  listAdminBlog,
  type AdminBlogRow,
  type ListAdminBlogInput,
} from '@/lib/endpoints';
import { queryKeys } from '@/lib/query-keys';
import { useApiErrorMessage } from '@/lib/use-api-error';
import { BlogStatusBadge } from './admin-badges';
import { AdminBlogForm } from './admin-blog-form';
import {
  AdminErrorState,
  AdminFilters,
  AdminPageHeader,
  AdminPagination,
  TableCard,
  TableSkeleton,
  TD_CLASS,
  TH_CLASS,
} from './admin-table';

type StatusFilter = '' | BlogStatus;

export function AdminBlogView() {
  const t = useTranslations('adminContent.blog');
  const format = useFormatter();
  const apiErrorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<StatusFilter>('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<'new' | AdminBlogRow | null>(null);
  const [target, setTarget] = useState<AdminBlogRow | null>(null);

  useEffect(() => {
    setPage(1);
  }, [status]);

  const query: ListAdminBlogInput = useMemo(
    () => ({ page, pageSize: ADMIN_PAGE_SIZE, status: status === '' ? undefined : status }),
    [page, status],
  );

  const blogQuery = useQuery({
    queryKey: queryKeys.admin.blog(query),
    queryFn: ({ signal }) => listAdminBlog(query, signal),
    placeholderData: keepPreviousData,
  });

  const removeMutation = useMutation({
    mutationFn: (row: AdminBlogRow) => deleteAdminBlog(row.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
    onSettled: () => setTarget(null),
  });

  const data = blogQuery.data;
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  if (editing !== null) {
    return <AdminBlogForm item={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />;
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

      <AdminFilters>
        <Select
          aria-label={t('statusLabel')}
          value={status}
          onChange={(event) => setStatus(event.target.value as StatusFilter)}
          className="sm:w-56"
        >
          <option value="">{t('statusAll')}</option>
          {BLOG_STATUSES.map((value) => (
            <option key={value} value={value}>
              {value === 'PUBLISHED' ? t('status.PUBLISHED') : t('status.DRAFT')}
            </option>
          ))}
        </Select>
      </AdminFilters>

      {removeMutation.isError ? (
        <Alert tone="danger" live className="mt-5">
          {apiErrorMessage(removeMutation.error)}
        </Alert>
      ) : null}

      {blogQuery.isPending ? (
        <TableSkeleton columns={5} />
      ) : blogQuery.isError ? (
        <AdminErrorState message={apiErrorMessage(blogQuery.error)} onRetry={() => void blogQuery.refetch()} />
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyState
          className="mt-6"
          icon={<Newspaper className="size-5" />}
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
                {t('columns.title')}
              </th>
              <th scope="col" className={TH_CLASS}>
                {t('columns.slug')}
              </th>
              <th scope="col" className={TH_CLASS}>
                {t('columns.status')}
              </th>
              <th scope="col" className={TH_CLASS}>
                {t('columns.category')}
              </th>
              <th scope="col" className={TH_CLASS}>
                {t('columns.publishedAt')}
              </th>
              <th scope="col" className={`${TH_CLASS} text-right`}>
                <span className="sr-only">{t('columns.actions')}</span>
              </th>
            </>
          }
        >
          {(data?.items ?? []).map((row) => (
            <tr key={row.id} className="border-t border-line">
              <td className={`${TD_CLASS} max-w-xs font-semibold text-ink`}>{row.title}</td>
              <td className={TD_CLASS}>
                <code className="text-[12px] text-ink-soft">{row.slug}</code>
              </td>
              <td className={TD_CLASS}>
                <BlogStatusBadge status={row.status} />
              </td>
              <td className={`${TD_CLASS} text-ink-soft`}>
                {row.category ?? <span className="text-ink-faint">{t('noCategory')}</span>}
              </td>
              <td className={`numeric ${TD_CLASS} whitespace-nowrap text-ink-faint`}>
                {row.publishedAt
                  ? format.dateTime(new Date(row.publishedAt), { dateStyle: 'short' })
                  : '—'}
              </td>
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

      <AdminPagination page={page} pageCount={pageCount} busy={blogQuery.isFetching} onPageChange={setPage} />

      <ConfirmDialog
        open={target !== null}
        variant="danger"
        pending={removeMutation.isPending}
        title={t('confirmDelete.title')}
        description={target ? t('confirmDelete.body', { title: target.title }) : undefined}
        confirmLabel={t('confirmDelete.confirm')}
        onCancel={() => setTarget(null)}
        onConfirm={() => {
          if (target) removeMutation.mutate(target);
        }}
      />
    </div>
  );
}
