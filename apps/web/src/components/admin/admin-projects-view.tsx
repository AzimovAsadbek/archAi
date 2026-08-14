'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { FolderOpen } from 'lucide-react';
import { PROJECT_STATUSES, type ProjectStatus } from '@archai/shared';
import { EmptyState } from '@/components/ui/empty-state';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  ADMIN_PAGE_SIZE,
  listAdminProjects,
  type ListAdminProjectsInput,
} from '@/lib/endpoints';
import { round } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { useApiErrorMessage } from '@/lib/use-api-error';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import {
  AdminErrorState,
  AdminFilters,
  AdminPageHeader,
  AdminPagination,
  AdminSearchInput,
  NoResultsState,
  TableCard,
  TableSkeleton,
  TD_CLASS,
  TH_CLASS,
} from './admin-table';

/** Read-only in v1 (docs/admin.md §Web): admins observe projects, they do not edit them. */
export function AdminProjectsView() {
  const t = useTranslations('admin.projects');
  const tStatus = useTranslations('project.status');
  const format = useFormatter();
  const apiErrorMessage = useApiErrorMessage();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ProjectStatus | ''>('');
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status]);

  const query: ListAdminProjectsInput = useMemo(
    () => ({
      page,
      pageSize: ADMIN_PAGE_SIZE,
      search: debouncedSearch.trim() === '' ? undefined : debouncedSearch.trim(),
      status: status === '' ? undefined : status,
    }),
    [page, debouncedSearch, status],
  );

  const projectsQuery = useQuery({
    queryKey: queryKeys.admin.projects(query),
    queryFn: ({ signal }) => listAdminProjects(query, signal),
    placeholderData: keepPreviousData,
  });

  const data = projectsQuery.data;
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const hasFilters = debouncedSearch.trim() !== '' || status !== '';

  const resetFilters = () => {
    setSearch('');
    setStatus('');
  };

  return (
    <div>
      <AdminPageHeader
        title={t('title')}
        description={t('subtitle')}
        meta={t('count', { count: total })}
      />

      <AdminFilters>
        <AdminSearchInput
          value={search}
          onChange={setSearch}
          label={t('searchLabel')}
          placeholder={t('searchPlaceholder')}
        />
        <Select
          aria-label={t('statusLabel')}
          value={status}
          onChange={(event) => setStatus(event.target.value as ProjectStatus | '')}
          className="sm:w-56"
        >
          <option value="">{t('statusAll')}</option>
          {PROJECT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {tStatus(value)}
            </option>
          ))}
        </Select>
      </AdminFilters>

      {projectsQuery.isPending ? (
        <TableSkeleton columns={6} />
      ) : projectsQuery.isError ? (
        <AdminErrorState
          message={apiErrorMessage(projectsQuery.error)}
          onRetry={() => void projectsQuery.refetch()}
        />
      ) : (data?.items.length ?? 0) === 0 ? (
        hasFilters ? (
          <NoResultsState onReset={resetFilters} />
        ) : (
          <EmptyState
            className="mt-6"
            icon={<FolderOpen className="size-5" />}
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
                {t('columns.name')}
              </th>
              <th scope="col" className={TH_CLASS}>
                {t('columns.owner')}
              </th>
              <th scope="col" className={TH_CLASS}>
                {t('columns.status')}
              </th>
              <th scope="col" className={`${TH_CLASS} text-right`}>
                {t('columns.rooms')}
              </th>
              <th scope="col" className={`${TH_CLASS} text-right`}>
                {t('columns.land')}
              </th>
              <th scope="col" className={TH_CLASS}>
                {t('columns.updatedAt')}
              </th>
            </>
          }
        >
          {(data?.items ?? []).map((project) => (
            <tr key={project.id} className="border-t border-line">
              <td className={`${TD_CLASS} font-semibold text-ink`}>{project.name}</td>
              <td className={`${TD_CLASS} text-ink-soft`}>{project.ownerEmail}</td>
              <td className={TD_CLASS}>
                <StatusBadge status={project.status} size="sm" />
              </td>
              <td className={`numeric ${TD_CLASS} text-right text-ink-soft`}>
                {project.roomCount}
              </td>
              <td className={`numeric ${TD_CLASS} whitespace-nowrap text-right text-ink-soft`}>
                {project.landAreaM2 === null
                  ? t('noLand')
                  : t('landValue', { m2: round(project.landAreaM2, 1) })}
              </td>
              <td className={`numeric ${TD_CLASS} whitespace-nowrap text-ink-faint`}>
                {format.dateTime(new Date(project.updatedAt), {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </td>
            </tr>
          ))}
        </TableCard>
      )}

      <AdminPagination
        page={page}
        pageCount={pageCount}
        busy={projectsQuery.isFetching}
        onPageChange={setPage}
      />
    </div>
  );
}
