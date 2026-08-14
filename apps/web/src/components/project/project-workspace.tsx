'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Copy,
  Layers,
  MoreHorizontal,
  Pencil,
  Ruler,
  Scan,
  SquareStack,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { type ProjectDto, type RoomDto } from '@archai/shared';
import { FloorPlanPanel } from '@/components/floor-plan/floor-plan-panel';
import { ThreePanel } from '@/components/three/three-panel';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { buttonClasses } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Menu, MenuItem, MenuSeparator } from '@/components/ui/menu';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/cn';
import {
  archiveProject,
  deleteProject,
  duplicateProject,
  getProject,
  unarchiveProject,
} from '@/lib/endpoints';
import { coveragePercent, m2ToSotix, round } from '@/lib/format';
import { FEATURE_ICONS, FEATURE_KEYS } from '@/lib/project-options';
import { queryKeys } from '@/lib/query-keys';
import { useApiErrorMessage } from '@/lib/use-api-error';
import { StatCard } from './stat-card';
import { ValidationPanel } from './validation-panel';

/** Tabs backed by a real panel today. */
const LIVE_TABS = ['overview', 'plans2d', 'view3d'] as const;
const ROADMAP_TABS = ['interior', 'exterior', 'estimate'] as const;

type LiveTab = (typeof LIVE_TABS)[number];
type PendingAction = 'delete' | 'archive' | null;

function WorkspaceSkeleton() {
  return (
    <div>
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-4 h-8 w-72" />
      <Skeleton className="mt-6 h-10 w-full" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-24 rounded-md" />
        ))}
      </div>
      <Skeleton className="mt-6 h-64 w-full rounded-md" />
    </div>
  );
}

function RoomsTable({ project }: { project: ProjectDto }) {
  const tRooms = useTranslations('workspace.rooms');
  const tRoomTypes = useTranslations('roomTypes');

  const floorCount = project.house?.floorCount ?? 1;
  const floors = Array.from({ length: floorCount }, (_, index) => index);

  const roomArea = (room: RoomDto): number | null =>
    room.widthM != null && room.lengthM != null ? round(room.widthM * room.lengthM, 1) : null;

  return (
    <div className="overflow-hidden rounded-md border border-line bg-surface">
      <header className="border-b border-line px-5 py-4">
        <h2 className="text-sm font-bold tracking-wide text-ink uppercase">{tRooms('title')}</h2>
      </header>

      {project.rooms.length === 0 ? (
        <p className="px-5 py-8 text-sm text-ink-faint">{tRooms('empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-xl border-collapse text-sm">
            <caption className="sr-only">{tRooms('caption')}</caption>
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="px-5 py-2.5 text-xs font-bold text-ink-faint uppercase">
                  {tRooms('type')}
                </th>
                <th scope="col" className="px-5 py-2.5 text-xs font-bold text-ink-faint uppercase">
                  {tRooms('label')}
                </th>
                <th scope="col" className="px-5 py-2.5 text-xs font-bold text-ink-faint uppercase">
                  {tRooms('dims')}
                </th>
                <th
                  scope="col"
                  className="px-5 py-2.5 text-right text-xs font-bold text-ink-faint uppercase"
                >
                  {tRooms('area')}
                </th>
              </tr>
            </thead>
            {floors.map((floor) => {
              const floorRooms = project.rooms.filter((room) => room.floor === floor);
              if (floorRooms.length === 0) return null;
              const total = round(
                floorRooms.reduce((sum, room) => sum + (roomArea(room) ?? 0), 0),
                1,
              );

              return (
                <tbody key={floor} className="border-b border-line last:border-b-0">
                  <tr className="bg-paper">
                    <th
                      scope="colgroup"
                      colSpan={4}
                      className="px-5 py-2 text-left text-xs font-bold tracking-wide text-ink-soft uppercase"
                    >
                      {tRooms('floorGroup', { floor: floor + 1 })}
                    </th>
                  </tr>
                  {floorRooms.map((room) => {
                    const area = roomArea(room);
                    return (
                      <tr key={room.id} className="border-t border-line">
                        <td className="px-5 py-2.5 font-semibold text-ink">
                          {tRoomTypes(room.type)}
                        </td>
                        <td className="px-5 py-2.5 text-ink-soft">{room.label ?? '—'}</td>
                        <td className="numeric px-5 py-2.5 text-ink-soft">
                          {room.widthM != null && room.lengthM != null
                            ? tRooms('dimsValue', { width: room.widthM, length: room.lengthM })
                            : '—'}
                        </td>
                        <td className="numeric px-5 py-2.5 text-right text-ink-soft">
                          {area === null ? '—' : tRooms('areaValue', { area })}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t border-line">
                    <td colSpan={3} className="px-5 py-2 text-xs font-bold text-ink-faint uppercase">
                      {tRooms('floorTotal', { floor: floor + 1 })}
                    </td>
                    <td className="numeric px-5 py-2 text-right text-sm font-bold text-ink">
                      {tRooms('areaValue', { area: total })}
                    </td>
                  </tr>
                </tbody>
              );
            })}
          </table>
        </div>
      )}
    </div>
  );
}

export function ProjectWorkspace({ projectId }: { projectId: string }) {
  const t = useTranslations('workspace');
  const tProject = useTranslations('project');
  const tFeatures = useTranslations('features');
  const tStyles = useTranslations('styles');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const queryClient = useQueryClient();
  const apiErrorMessage = useApiErrorMessage();

  const [pending, setPending] = useState<PendingAction>(null);
  const [actionError, setActionError] = useState<string | undefined>();
  const [tab, setTab] = useState<LiveTab>('overview');

  const projectQuery = useQuery({
    queryKey: queryKeys.project(projectId),
    queryFn: ({ signal }) => getProject(projectId, signal),
  });
  const project = projectQuery.data;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
    await queryClient.invalidateQueries({ queryKey: ['projects'] });
  };

  const duplicate = useMutation({
    mutationFn: () => duplicateProject(projectId),
    onSuccess: (copy) => {
      queryClient.setQueryData(queryKeys.project(copy.id), copy);
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      router.push(`/projects/${copy.id}`);
    },
    onError: (error) => setActionError(apiErrorMessage(error)),
  });

  const toggleArchive = useMutation({
    mutationFn: (archived: boolean) =>
      archived ? unarchiveProject(projectId) : archiveProject(projectId),
    onSuccess: () => void refresh(),
    onError: (error) => setActionError(apiErrorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: () => deleteProject(projectId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: queryKeys.project(projectId) });
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      router.push('/dashboard');
    },
    onError: (error) => setActionError(apiErrorMessage(error)),
  });

  if (projectQuery.isPending) return <WorkspaceSkeleton />;

  if (projectQuery.isError || !project) {
    return (
      <EmptyState
        tone="danger"
        icon={<TriangleAlert className="size-5" />}
        title={t('loadError')}
        description={apiErrorMessage(projectQuery.error)}
        action={
          <Link href="/dashboard" className={buttonClasses('outline', 'md')}>
            {t('back')}
          </Link>
        }
      />
    );
  }

  const archived = project.status === 'ARCHIVED';
  const landAreaM2 = project.land?.areaM2 ?? null;
  const footprint =
    project.house != null ? round(project.house.widthM * project.house.lengthM, 1) : null;
  const coverage =
    footprint !== null && landAreaM2 !== null ? coveragePercent(footprint, landAreaM2) : null;
  const totalArea = footprint !== null ? round(footprint * (project.house?.floorCount ?? 1), 1) : null;
  const enabledFeatures = FEATURE_KEYS.filter((feature) => project.features[feature]);
  const configured = project.land !== null && project.house !== null && project.rooms.length > 0;

  return (
    <div>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-ink-faint transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        {t('back')}
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
              {project.name}
            </h1>
            <StatusBadge status={project.status} />
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
            {project.description ?? t('descriptionEmpty')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/projects/${projectId}/edit`}
            className={buttonClasses('primary', 'md', archived ? 'pointer-events-none opacity-50' : '')}
            aria-disabled={archived || undefined}
            tabIndex={archived ? -1 : undefined}
          >
            <Pencil className="size-4" aria-hidden="true" />
            {tProject('actions.edit')}
          </Link>

          <Menu
            trigger={(triggerProps) => (
              <button
                type="button"
                {...triggerProps}
                aria-label={tProject('actions.menu')}
                className="flex size-10 items-center justify-center rounded-md border border-line-strong bg-surface text-ink-soft transition-colors hover:bg-paper"
              >
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </button>
            )}
          >
            {(close) => (
              <>
                <MenuItem
                  icon={<Copy className="size-4" />}
                  disabled={duplicate.isPending}
                  onClick={() => {
                    close(false);
                    duplicate.mutate();
                  }}
                >
                  {tProject('actions.duplicate')}
                </MenuItem>
                <MenuItem
                  icon={
                    archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />
                  }
                  disabled={toggleArchive.isPending}
                  onClick={() => {
                    close(false);
                    if (archived) toggleArchive.mutate(true);
                    else setPending('archive');
                  }}
                >
                  {archived ? tProject('actions.unarchive') : tProject('actions.archive')}
                </MenuItem>
                <MenuSeparator />
                <MenuItem
                  danger
                  icon={<Trash2 className="size-4" />}
                  onClick={() => {
                    close(false);
                    setPending('delete');
                  }}
                >
                  {tProject('actions.delete')}
                </MenuItem>
              </>
            )}
          </Menu>
        </div>
      </div>

      {actionError ? (
        <Alert tone="danger" live className="mt-5">
          {actionError}
        </Alert>
      ) : null}

      {/* Tabs — Overview, the 2D plan and the 3D preview are real; the rest is roadmap. */}
      <div className="mt-7 overflow-x-auto border-b border-line">
        <div role="tablist" aria-label={t('tabsLabel')} className="flex min-w-max items-center gap-1">
          {LIVE_TABS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`workspace-tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`workspace-panel-${id}`}
              onClick={() => setTab(id)}
              className={cn(
                '-mb-px border-b-2 px-3 py-2.5 text-sm transition-colors',
                tab === id
                  ? 'border-accent font-bold text-ink'
                  : 'border-transparent font-semibold text-ink-faint hover:text-ink',
              )}
            >
              {t(`tabs.${id}`)}
            </button>
          ))}
          {ROADMAP_TABS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected="false"
              disabled
              title={t('tabDisabled')}
              className={cn(
                '-mb-px flex cursor-not-allowed items-center gap-1.5 border-b-2 border-transparent px-3 py-2.5',
                'text-sm font-semibold text-ink-faint',
              )}
            >
              {t(`tabs.${id}`)}
              <Badge tone="faint" size="sm">
                {tCommon('roadmap')}
              </Badge>
            </button>
          ))}
        </div>
      </div>

      {tab === 'plans2d' ? (
        <div
          role="tabpanel"
          id="workspace-panel-plans2d"
          aria-labelledby="workspace-tab-plans2d"
          className="mt-8"
        >
          <FloorPlanPanel projectId={projectId} projectUpdatedAt={project.updatedAt} />
        </div>
      ) : null}

      {/* Mounted only while selected: unmounting releases the WebGL context. */}
      {tab === 'view3d' ? (
        <div
          role="tabpanel"
          id="workspace-panel-view3d"
          aria-labelledby="workspace-tab-view3d"
          className="mt-8"
        >
          <ThreePanel
            projectId={projectId}
            projectUpdatedAt={project.updatedAt}
            land={project.land}
          />
        </div>
      ) : null}

      <div
        role="tabpanel"
        id="workspace-panel-overview"
        aria-labelledby="workspace-tab-overview"
        hidden={tab !== 'overview'}
      >
        {!configured ? (
          <EmptyState
            className="mt-8"
            icon={<Scan className="size-5" />}
            title={t('notConfigured.title')}
            description={t('notConfigured.body')}
            action={
              <Link href={`/projects/${projectId}/edit`} className={buttonClasses('accent', 'md')}>
                {t('notConfigured.cta')}
              </Link>
            }
          />
        ) : null}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<Ruler className="size-4" />}
            label={t('stats.land')}
            value={landAreaM2 === null ? '—' : t('stats.areaValue', { area: landAreaM2 })}
            hint={
              landAreaM2 === null
                ? undefined
                : t('stats.sotixHint', { sotix: m2ToSotix(landAreaM2) })
            }
          />
          <StatCard
            icon={<Scan className="size-4" />}
            label={t('stats.footprint')}
            value={footprint === null ? '—' : t('stats.areaValue', { area: footprint })}
            hint={coverage === null ? undefined : t('stats.coverageHint', { percent: coverage })}
          />
          <StatCard
            icon={<Layers className="size-4" />}
            label={t('stats.floors')}
            value={project.house === null ? '—' : String(project.house.floorCount)}
            hint={totalArea === null ? undefined : t('stats.totalAreaHint', { area: totalArea })}
          />
          <StatCard
            icon={<SquareStack className="size-4" />}
            label={t('stats.rooms')}
            value={String(project.rooms.length)}
            hint={project.house?.style ? tStyles(`${project.house.style}.label`) : undefined}
          />
        </div>

        {enabledFeatures.length > 0 ? (
          <section className="mt-6 rounded-md border border-line bg-surface p-5">
            <h2 className="text-sm font-bold tracking-wide text-ink uppercase">
              {t('featuresTitle')}
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {enabledFeatures.map((feature) => {
                const Icon = FEATURE_ICONS[feature];
                return (
                  <li
                    key={feature}
                    className="inline-flex items-center gap-1.5 rounded-sm border border-line bg-paper px-2.5 py-1.5 text-xs font-semibold text-ink"
                  >
                    <Icon className="size-3.5 text-ink-faint" aria-hidden="true" />
                    {tFeatures(`${feature}.label`)}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <div className="mt-6">
          <RoomsTable project={project} />
        </div>

        <ValidationPanel
          className="mt-6"
          errors={project.validation.errors}
          warnings={project.validation.warnings}
        />
      </div>

      <ConfirmDialog
        open={pending !== null}
        variant={pending === 'delete' ? 'danger' : 'default'}
        title={
          pending === 'delete' ? tProject('confirmDelete.title') : tProject('confirmArchive.title')
        }
        description={
          pending === 'delete'
            ? tProject('confirmDelete.body', { name: project.name })
            : tProject('confirmArchive.body', { name: project.name })
        }
        confirmLabel={
          pending === 'delete'
            ? tProject('confirmDelete.confirm')
            : tProject('confirmArchive.confirm')
        }
        pending={remove.isPending || toggleArchive.isPending}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const action = pending;
          setPending(null);
          setActionError(undefined);
          if (action === 'delete') remove.mutate();
          else if (action === 'archive') toggleArchive.mutate(false);
        }}
      />
    </div>
  );
}
