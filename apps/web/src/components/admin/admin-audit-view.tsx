'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Filter, ScrollText } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { ADMIN_PAGE_SIZE, listAdminAudit, type ListAdminAuditInput } from '@/lib/endpoints';
import { queryKeys } from '@/lib/query-keys';
import { useApiErrorMessage } from '@/lib/use-api-error';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import {
  AdminErrorState,
  AdminFilters,
  AdminPageHeader,
  AdminPagination,
  NoResultsState,
  TableCard,
  TableSkeleton,
  TD_CLASS,
  TH_CLASS,
} from './admin-table';

/** Metadata is small by contract (ids/emails) — one `key: value` chip per entry. */
function metadataEntries(metadata: unknown): [string, string][] {
  if (metadata === null || metadata === undefined) return [];
  if (typeof metadata !== 'object' || Array.isArray(metadata)) {
    return [['value', String(metadata)]];
  }

  return Object.entries(metadata as Record<string, unknown>).map(([key, value]) => {
    if (value === null) return [key, 'null'];
    if (typeof value === 'object') return [key, JSON.stringify(value)];
    return [key, String(value)];
  });
}

function MetadataRow({ metadata, columns }: { metadata: unknown; columns: number }) {
  const tAudit = useTranslations('admin.audit');
  const entries = metadataEntries(metadata);
  if (entries.length === 0) return null;

  return (
    <tr className="border-t border-line/60 bg-paper/40">
      <td colSpan={columns} className="px-4 pt-0 pb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-ink-faint">{tAudit('metadata')}</span>
          {entries.map(([key, value]) => (
            <code
              key={key}
              className="numeric rounded-sm border border-line bg-surface px-1.5 py-0.5 text-[11px] text-ink-soft"
            >
              <span className="font-semibold text-ink-faint">{key}:</span> {value}
            </code>
          ))}
        </div>
      </td>
    </tr>
  );
}

export function AdminAuditView() {
  const t = useTranslations('admin.audit');
  const format = useFormatter();
  const apiErrorMessage = useApiErrorMessage();

  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);

  const debouncedAction = useDebouncedValue(action, 300);

  useEffect(() => {
    setPage(1);
  }, [debouncedAction]);

  const query: ListAdminAuditInput = useMemo(
    () => ({
      page,
      pageSize: ADMIN_PAGE_SIZE,
      action: debouncedAction.trim() === '' ? undefined : debouncedAction.trim(),
    }),
    [page, debouncedAction],
  );

  const auditQuery = useQuery({
    queryKey: queryKeys.admin.audit(query),
    queryFn: ({ signal }) => listAdminAudit(query, signal),
    placeholderData: keepPreviousData,
  });

  const data = auditQuery.data;
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const hasFilters = debouncedAction.trim() !== '';

  return (
    <div>
      <AdminPageHeader
        title={t('title')}
        description={t('subtitle')}
        meta={t('count', { count: total })}
      />

      <AdminFilters>
        <div className="relative flex-1">
          <Filter
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={action}
            aria-label={t('actionLabel')}
            placeholder={t('actionPlaceholder')}
            onChange={(event) => setAction(event.target.value)}
            className="pl-9"
          />
        </div>
      </AdminFilters>
      <p className="mt-2 text-xs leading-relaxed text-ink-faint">{t('actionHint')}</p>

      {auditQuery.isPending ? (
        <TableSkeleton columns={5} />
      ) : auditQuery.isError ? (
        <AdminErrorState
          message={apiErrorMessage(auditQuery.error)}
          onRetry={() => void auditQuery.refetch()}
        />
      ) : (data?.items.length ?? 0) === 0 ? (
        hasFilters ? (
          <NoResultsState onReset={() => setAction('')} />
        ) : (
          <EmptyState
            className="mt-6"
            icon={<ScrollText className="size-5" />}
            title={t('empty.title')}
            description={t('empty.body')}
          />
        )
      ) : (
        <TableCard
          caption={t('caption')}
          head={
            <>
              <th scope="col" className={TH_CLASS}>
                {t('columns.time')}
              </th>
              <th scope="col" className={TH_CLASS}>
                {t('columns.actor')}
              </th>
              <th scope="col" className={TH_CLASS}>
                {t('columns.action')}
              </th>
              <th scope="col" className={TH_CLASS}>
                {t('columns.entity')}
              </th>
              <th scope="col" className={TH_CLASS}>
                {t('columns.entityId')}
              </th>
            </>
          }
        >
          {(data?.items ?? []).map((row) => (
            <Fragment key={row.id}>
              <tr className="border-t border-line">
                <td className={`numeric ${TD_CLASS} whitespace-nowrap text-ink-soft`}>
                  {format.dateTime(new Date(row.createdAt), {
                    dateStyle: 'short',
                    timeStyle: 'medium',
                  })}
                </td>
                <td className={`${TD_CLASS} text-ink-soft`}>
                  {row.actorEmail ?? <span className="text-ink-faint">{t('deletedActor')}</span>}
                </td>
                <td className={`${TD_CLASS} font-semibold whitespace-nowrap text-ink`}>
                  {row.action}
                </td>
                <td className={`${TD_CLASS} text-ink-soft`}>{row.entity}</td>
                <td className={`${TD_CLASS} text-ink-faint`}>
                  {row.entityId === null ? (
                    '—'
                  ) : (
                    <code className="text-[11px] break-all">{row.entityId}</code>
                  )}
                </td>
              </tr>
              <MetadataRow metadata={row.metadata} columns={5} />
            </Fragment>
          ))}
        </TableCard>
      )}

      <AdminPagination
        page={page}
        pageCount={pageCount}
        busy={auditQuery.isFetching}
        onPageChange={setPage}
      />
    </div>
  );
}
