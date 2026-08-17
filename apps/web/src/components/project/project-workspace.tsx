'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ArchiveRestore,
  Copy,
  FileDown,
  Layers,
  MoreHorizontal,
  Pencil,
  Ruler,
  Scan,
  SquareStack,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useLocale } from 'next-intl';
import { type ProjectDto, type RoomDto } from '@archai/shared';
import { EstimatePanel } from '@/components/estimate/estimate-panel';
import { FloorPlanPanel } from '@/components/floor-plan/floor-plan-panel';
import { ThreePanel } from '@/components/three/three-panel';
import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Menu, MenuItem, MenuSeparator } from '@/components/ui/menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
  archiveProject,
  deleteProject,
  duplicateProject,
  getProject,
  unarchiveProject,
} from '@/lib/endpoints';
import { downloadProjectPdf } from '@/lib/download-pdf';
import { coveragePercent, m2ToSotix, round } from '@/lib/format';
import { FEATURE_ICONS, FEATURE_KEYS } from '@/lib/project-options';
import { queryKeys } from '@/lib/query-keys';
import { useApiErrorMessage } from '@/lib/use-api-error';
import {
  ShellAction,
  WorkspaceShell,
  type WorkspaceMode,
} from '@/components/workspace/workspace-shell';
import { AssistantPanel } from './assistant-panel';
import { StatCard } from './stat-card';
import { ValidationPanel } from './validation-panel';

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
    <div className="overflow-hidden rounded-panel border border-line bg-surface">
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
  const locale = useLocale();
  const tFeatures = useTranslations('features');
  const tStyles = useTranslations('styles');
  const router = useRouter();
  const queryClient = useQueryClient();
  const apiErrorMessage = useApiErrorMessage();

  const [pending, setPending] = useState<PendingAction>(null);
  const [actionError, setActionError] = useState<string | undefined>();
  const [tab, setTab] = useState<WorkspaceMode>('overview');
  const [railCollapsed, setRailCollapsed] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  const projectQuery = useQuery({
    queryKey: queryKeys.project(projectId),
    queryFn: ({ signal }) => getProject(projectId, signal),
  });
  const project = projectQuery.data;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
    await queryClient.invalidateQueries({ queryKey: ['projects'] });
  };

  const exportPdf = useMutation({
    mutationFn: () => downloadProjectPdf(projectId, locale),
    onError: (error) => setActionError(apiErrorMessage(error)),
  });

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

  // Below `sm` the top bar cannot hold the logo, the project name, three action
  // buttons and the account controls — the name was truncating to a single
  // character. PDF and Edit collapse into the overflow menu there instead, so a
  // phone loses the buttons but not the actions.
  const shellActions = (
    <>
      <ShellAction
        className="hidden sm:flex"
        icon={FileDown}
        label={exportPdf.isPending ? tProject('actions.pdfPending') : tProject('actions.pdf')}
        onClick={() => exportPdf.mutate()}
        disabled={!configured || exportPdf.isPending}
      />
      {!archived ? (
        <ShellAction
          className="hidden sm:flex"
          icon={Pencil}
          label={tProject('actions.edit')}
          href={`/projects/${projectId}/edit`}
        />
      ) : null}
      <Menu
        trigger={({ ref: menuRef, ...triggerProps }) => (
          <button
            type="button"
            {...triggerProps}
            ref={(node) => {
              menuRef(node);
              menuButtonRef.current = node;
            }}
            aria-label={tProject('actions.menu')}
            className="flex size-8 items-center justify-center rounded-tool border border-shell-line text-shell-ink-soft transition-colors hover:bg-shell-raised hover:text-shell-ink"
          >
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </button>
        )}
      >
        {(close) => (
          <>
            {/* The counterparts of the buttons hidden below `sm`. */}
            <div className="sm:hidden">
              <MenuItem
                icon={<FileDown className="size-4" />}
                disabled={!configured || exportPdf.isPending}
                onClick={() => {
                  close(false);
                  exportPdf.mutate();
                }}
              >
                {exportPdf.isPending ? tProject('actions.pdfPending') : tProject('actions.pdf')}
              </MenuItem>
              {!archived ? (
                <MenuItem
                  icon={<Pencil className="size-4" />}
                  onClick={() => {
                    close(false);
                    router.push(`/projects/${projectId}/edit`);
                  }}
                >
                  {tProject('actions.edit')}
                </MenuItem>
              ) : null}
              <MenuSeparator />
            </div>
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
              icon={archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
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
    </>
  );

  return (
    <WorkspaceShell
      projectName={project.name}
      status={project.status}
      mode={tab}
      onModeChange={setTab}
      railCollapsed={railCollapsed}
      onRailToggle={() => setRailCollapsed((v) => !v)}
      actions={shellActions}
    >
      {actionError ? (
        <Alert tone="danger" live className="m-4">
          {actionError}
        </Alert>
      ) : null}

      {/* Viewport modes own the full canvas; document modes scroll inside it. */}
      {tab === 'plans2d' ? (
        <div className="h-full min-h-0">
          <FloorPlanPanel
            projectId={projectId}
            projectUpdatedAt={project.updatedAt}
            land={project.land}
            features={project.features}
          />
        </div>
      ) : null}

      {/* Mounted only while selected: unmounting releases the WebGL context. */}
      {tab === 'view3d' ? (
        <div className="h-full min-h-0">
          <ThreePanel
            projectId={projectId}
            projectUpdatedAt={project.updatedAt}
            land={project.land}
            features={project.features}
            style={project.house?.style ?? null}
          />
        </div>
      ) : null}

      {tab === 'estimate' ? (
        <div className="h-full overflow-y-auto p-5 lg:p-6">
          <EstimatePanel projectId={projectId} projectUpdatedAt={project.updatedAt} />
        </div>
      ) : null}

      {tab === 'assistant' ? (
        <div className="h-full overflow-y-auto p-5 lg:p-6">
          <AssistantPanel projectId={projectId} />
        </div>
      ) : null}

      <div
        className="h-full overflow-y-auto p-5 lg:p-6"
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
          <section className="mt-6 rounded-panel border border-line bg-surface p-5">
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
        triggerRef={menuButtonRef}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const action = pending;
          setPending(null);
          setActionError(undefined);
          if (action === 'delete') remove.mutate();
          else if (action === 'archive') toggleArchive.mutate(false);
        }}
      />
    </WorkspaceShell>
  );
}
