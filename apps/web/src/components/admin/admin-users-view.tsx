'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserX } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Select } from '@/components/ui/select';
import {
  ADMIN_PAGE_SIZE,
  listAdminUsers,
  setAdminUserActive,
  type AdminUserRow,
  type ListAdminUsersInput,
} from '@/lib/endpoints';
import { queryKeys } from '@/lib/query-keys';
import { useApiErrorMessage } from '@/lib/use-api-error';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { ActiveBadge, RoleBadge } from './admin-badges';
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

type ActiveFilter = '' | 'active' | 'inactive';

export function AdminUsersView() {
  const t = useTranslations('admin.users');
  const format = useFormatter();
  const apiErrorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('');
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<AdminUserRow | null>(null);

  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, activeFilter]);

  const query: ListAdminUsersInput = useMemo(
    () => ({
      page,
      pageSize: ADMIN_PAGE_SIZE,
      search: debouncedSearch.trim() === '' ? undefined : debouncedSearch.trim(),
      isActive: activeFilter === '' ? undefined : activeFilter === 'active',
    }),
    [page, debouncedSearch, activeFilter],
  );

  const usersQuery = useQuery({
    queryKey: queryKeys.admin.users(query),
    queryFn: ({ signal }) => listAdminUsers(query, signal),
    placeholderData: keepPreviousData,
  });

  const toggleActive = useMutation({
    mutationFn: (user: AdminUserRow) => setAdminUserActive(user.id, !user.isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
    onSettled: () => setTarget(null),
  });

  const data = usersQuery.data;
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const hasFilters = debouncedSearch.trim() !== '' || activeFilter !== '';

  const resetFilters = () => {
    setSearch('');
    setActiveFilter('');
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
          aria-label={t('filterLabel')}
          value={activeFilter}
          onChange={(event) => setActiveFilter(event.target.value as ActiveFilter)}
          className="sm:w-56"
        >
          <option value="">{t('filterAll')}</option>
          <option value="active">{t('filterActive')}</option>
          <option value="inactive">{t('filterInactive')}</option>
        </Select>
      </AdminFilters>

      {toggleActive.isError ? (
        <Alert tone="danger" live className="mt-5">
          {apiErrorMessage(toggleActive.error)}
        </Alert>
      ) : null}

      {usersQuery.isPending ? (
        <TableSkeleton columns={6} />
      ) : usersQuery.isError ? (
        <AdminErrorState
          message={apiErrorMessage(usersQuery.error)}
          onRetry={() => void usersQuery.refetch()}
        />
      ) : (data?.items.length ?? 0) === 0 ? (
        hasFilters ? (
          <NoResultsState onReset={resetFilters} />
        ) : (
          <EmptyState
            className="mt-6"
            icon={<UserX className="size-5" />}
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
                {t('columns.email')}
              </th>
              <th scope="col" className={TH_CLASS}>
                {t('columns.name')}
              </th>
              <th scope="col" className={TH_CLASS}>
                {t('columns.role')}
              </th>
              <th scope="col" className={TH_CLASS}>
                {t('columns.status')}
              </th>
              <th scope="col" className={`${TH_CLASS} text-right`}>
                {t('columns.projects')}
              </th>
              <th scope="col" className={`${TH_CLASS} text-right`}>
                {t('columns.aiGenerations')}
              </th>
              <th scope="col" className={TH_CLASS}>
                {t('columns.createdAt')}
              </th>
              <th scope="col" className={`${TH_CLASS} text-right`}>
                <span className="sr-only">{t('columns.actions')}</span>
              </th>
            </>
          }
        >
          {(data?.items ?? []).map((user) => (
            <tr key={user.id} className="border-t border-line">
              <td className={`${TD_CLASS} font-semibold text-ink`}>{user.email}</td>
              <td className={`${TD_CLASS} text-ink-soft`}>{user.fullName}</td>
              <td className={TD_CLASS}>
                <RoleBadge role={user.role} />
              </td>
              <td className={TD_CLASS}>
                <ActiveBadge isActive={user.isActive} />
              </td>
              <td className={`numeric ${TD_CLASS} text-right text-ink-soft`}>
                {user.projectCount}
              </td>
              <td className={`numeric ${TD_CLASS} text-right text-ink-soft`}>
                {user.aiGenerationCount}
              </td>
              <td className={`numeric ${TD_CLASS} whitespace-nowrap text-ink-faint`}>
                {/* `short` stays dense and unambiguous in all three locales — uz-Latn
                    renders `medium` as "2026 M08 14". */}
                {format.dateTime(new Date(user.createdAt), { dateStyle: 'short' })}
              </td>
              <td className={`${TD_CLASS} text-right`}>
                {user.role === 'ADMIN' ? (
                  // The API refuses to touch an ADMIN row (409 CANNOT_MODIFY_ADMIN /
                  // CANNOT_MODIFY_SELF); offering the button would only ever fail.
                  <span className="text-xs font-medium whitespace-nowrap text-ink-faint">
                    {t('actions.protected')}
                  </span>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={toggleActive.isPending}
                    onClick={() => setTarget(user)}
                  >
                    {user.isActive ? t('actions.deactivate') : t('actions.activate')}
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </TableCard>
      )}

      <AdminPagination
        page={page}
        pageCount={pageCount}
        busy={usersQuery.isFetching}
        onPageChange={setPage}
      />

      <ConfirmDialog
        open={target !== null}
        variant={target?.isActive ? 'danger' : 'default'}
        pending={toggleActive.isPending}
        title={target?.isActive ? t('confirmDeactivate.title') : t('confirmActivate.title')}
        description={
          target
            ? target.isActive
              ? t('confirmDeactivate.body', { email: target.email })
              : t('confirmActivate.body', { email: target.email })
            : undefined
        }
        confirmLabel={
          target?.isActive ? t('confirmDeactivate.confirm') : t('confirmActivate.confirm')
        }
        onCancel={() => setTarget(null)}
        onConfirm={() => {
          if (target) toggleActive.mutate(target);
        }}
      />
    </div>
  );
}
