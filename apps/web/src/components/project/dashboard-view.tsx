'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, FolderOpen, Plus, Search, TriangleAlert } from 'lucide-react';
import { PROJECT_STATUSES, type ProjectListItemDto, type ProjectStatus } from '@archai/shared';
import { Alert } from '@/components/ui/alert';
import { Button, buttonClasses } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  archiveProject,
  deleteProject,
  duplicateProject,
  listProjects,
  unarchiveProject,
  type ListProjectsInput,
} from '@/lib/endpoints';
import { queryKeys } from '@/lib/query-keys';
import { useApiErrorMessage } from '@/lib/use-api-error';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { ProjectGrid, ProjectGridSkeleton } from './project-grid';

const PAGE_SIZE = 12;

type PendingAction =
  | { kind: 'delete'; project: ProjectListItemDto }
  | { kind: 'archive'; project: ProjectListItemDto };

export function DashboardView() {
  const t = useTranslations('dashboard');
  const tProject = useTranslations('project');
  const tStatus = useTranslations('project.status');
  const apiErrorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ProjectStatus | ''>('');
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | undefined>();

  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status]);

  const query: ListProjectsInput = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      search: debouncedSearch.trim() === '' ? undefined : debouncedSearch.trim(),
      status: status === '' ? undefined : status,
    }),
    [page, debouncedSearch, status],
  );

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects(query),
    queryFn: ({ signal }) => listProjects(query, signal),
    placeholderData: keepPreviousData,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['projects'] });

  const runAction = (project: ProjectListItemDto, action: () => Promise<unknown>) => {
    setActionError(undefined);
    setBusyId(project.id);
    return action()
      .then(() => invalidate())
      .catch((error: unknown) => setActionError(apiErrorMessage(error)))
      .finally(() => setBusyId(null));
  };

  const duplicate = useMutation({
    mutationFn: (project: ProjectListItemDto) =>
      runAction(project, () => duplicateProject(project.id)),
  });
  const unarchive = useMutation({
    mutationFn: (project: ProjectListItemDto) =>
      runAction(project, () => unarchiveProject(project.id)),
  });

  const confirmPending = async () => {
    if (!pending) return;
    const { kind, project } = pending;
    setPending(null);
    await runAction(project, () =>
      kind === 'delete' ? deleteProject(project.id) : archiveProject(project.id),
    );
  };

  const data = projectsQuery.data;
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = debouncedSearch.trim() !== '' || status !== '';

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            {t('title')}
          </h1>
          <p className="numeric mt-1.5 text-sm text-ink-soft">{t('count', { count: total })}</p>
        </div>
        <Link href="/projects/new" className={buttonClasses('accent', 'md')}>
          <Plus className="size-4" aria-hidden="true" />
          {t('newProject')}
        </Link>
      </div>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={search}
            aria-label={t('searchLabel')}
            placeholder={t('searchPlaceholder')}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>
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
      </div>

      {actionError ? (
        <Alert tone="danger" live className="mt-5">
          {actionError}
        </Alert>
      ) : null}

      <div className="mt-6">
        {projectsQuery.isPending ? (
          <ProjectGridSkeleton />
        ) : projectsQuery.isError ? (
          <EmptyState
            tone="danger"
            icon={<TriangleAlert className="size-5" />}
            title={t('error.title')}
            description={apiErrorMessage(projectsQuery.error)}
            action={
              <Button variant="outline" onClick={() => projectsQuery.refetch()}>
                {t('error.retry')}
              </Button>
            }
          />
        ) : (data?.items.length ?? 0) === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={<Search className="size-5" />}
              title={t('emptySearch.title')}
              description={t('emptySearch.body')}
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch('');
                    setStatus('');
                  }}
                >
                  {t('emptySearch.reset')}
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<FolderOpen className="size-5" />}
              title={t('empty.title')}
              description={t('empty.body')}
              action={
                <Link href="/projects/new" className={buttonClasses('accent', 'md')}>
                  <Plus className="size-4" aria-hidden="true" />
                  {t('empty.cta')}
                </Link>
              }
            />
          )
        ) : (
          <ProjectGrid
            projects={data?.items ?? []}
            busyId={busyId}
            onDuplicate={(project) => duplicate.mutate(project)}
            onUnarchive={(project) => unarchive.mutate(project)}
            onArchive={(project) => setPending({ kind: 'archive', project })}
            onDelete={(project) => setPending({ kind: 'delete', project })}
          />
        )}
      </div>

      {total > PAGE_SIZE ? (
        <nav
          aria-label={t('pagination.label')}
          className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-5"
        >
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || projectsQuery.isFetching}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            {t('pagination.prev')}
          </Button>
          <p className="numeric text-sm text-ink-soft">
            {t('pagination.info', { page, pages: pageCount })}
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount || projectsQuery.isFetching}
            onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
          >
            {t('pagination.next')}
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </nav>
      ) : null}

      <ConfirmDialog
        open={pending !== null}
        variant={pending?.kind === 'delete' ? 'danger' : 'default'}
        title={
          pending?.kind === 'delete'
            ? tProject('confirmDelete.title')
            : tProject('confirmArchive.title')
        }
        description={
          pending?.kind === 'delete'
            ? tProject('confirmDelete.body', { name: pending.project.name })
            : pending
              ? tProject('confirmArchive.body', { name: pending.project.name })
              : undefined
        }
        confirmLabel={
          pending?.kind === 'delete'
            ? tProject('confirmDelete.confirm')
            : tProject('confirmArchive.confirm')
        }
        onCancel={() => setPending(null)}
        onConfirm={() => void confirmPending()}
      />
    </div>
  );
}
