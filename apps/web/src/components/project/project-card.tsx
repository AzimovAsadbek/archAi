'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import {
  Archive,
  ArchiveRestore,
  Copy,
  FolderOpen,
  Layers,
  MoreHorizontal,
  Ruler,
  Trash2,
} from 'lucide-react';
import { type ProjectListItemDto } from '@archai/shared';
import { Card } from '@/components/ui/card';
import { Menu, MenuItem, MenuSeparator } from '@/components/ui/menu';
import { StatusBadge } from '@/components/ui/status-badge';
import { relativeTimeParts } from '@/lib/relative-time';

export interface ProjectCardProps {
  project: ProjectListItemDto;
  onDuplicate: (project: ProjectListItemDto) => void;
  /** `trigger` is this card's ⋯ button, so a confirm dialog can return focus to it. */
  onArchive: (project: ProjectListItemDto, trigger: HTMLElement | null) => void;
  onUnarchive: (project: ProjectListItemDto) => void;
  onDelete: (project: ProjectListItemDto, trigger: HTMLElement | null) => void;
  busy?: boolean;
}

export function ProjectCard({
  project,
  onDuplicate,
  onArchive,
  onUnarchive,
  onDelete,
  busy = false,
}: ProjectCardProps) {
  const t = useTranslations('project');
  const tStyles = useTranslations('styles');
  const tTime = useTranslations('time');
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const router = useRouter();
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  const archived = project.status === 'ARCHIVED';

  // Catalog-driven relative time: Intl.RelativeTimeFormat has no `uz` data and
  // would render a raw "-15 h" (see relative-time.ts). `now` ticks each minute.
  const updated = relativeTimeParts(project.updatedAt, now);
  const updatedLabel = updated.key === 'now' ? tTime('now') : tTime(updated.key, { count: updated.count });

  return (
    <Card interactive className="relative flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base leading-snug font-bold text-ink">
            <Link
              href={`/projects/${project.id}`}
              className="rounded-sm after:absolute after:inset-0 after:content-['']"
            >
              {project.name}
            </Link>
          </h3>
          <div className="mt-2">
            <StatusBadge status={project.status} size="sm" />
          </div>
        </div>

        <Menu
          className="relative z-10 shrink-0"
          trigger={({ ref: menuRef, ...triggerProps }) => (
            <button
              type="button"
              {...triggerProps}
              ref={(node) => {
                menuRef(node);
                menuButtonRef.current = node;
              }}
              aria-label={t('actions.menu')}
              disabled={busy}
              className="flex size-8 items-center justify-center rounded-sm text-ink-faint transition-colors hover:bg-paper hover:text-ink disabled:opacity-50"
            >
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem
                icon={<FolderOpen className="size-4" />}
                onClick={() => {
                  close(false);
                  router.push(`/projects/${project.id}`);
                }}
              >
                {t('actions.open')}
              </MenuItem>
              <MenuItem
                icon={<Copy className="size-4" />}
                onClick={() => {
                  close(false);
                  onDuplicate(project);
                }}
              >
                {t('actions.duplicate')}
              </MenuItem>
              {archived ? (
                <MenuItem
                  icon={<ArchiveRestore className="size-4" />}
                  onClick={() => {
                    close(false);
                    onUnarchive(project);
                  }}
                >
                  {t('actions.unarchive')}
                </MenuItem>
              ) : (
                <MenuItem
                  icon={<Archive className="size-4" />}
                  onClick={() => {
                    close(false);
                    onArchive(project, menuButtonRef.current);
                  }}
                >
                  {t('actions.archive')}
                </MenuItem>
              )}
              <MenuSeparator />
              <MenuItem
                danger
                icon={<Trash2 className="size-4" />}
                onClick={() => {
                  close(false);
                  onDelete(project, menuButtonRef.current);
                }}
              >
                {t('actions.delete')}
              </MenuItem>
            </>
          )}
        </Menu>
      </div>

      <dl className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-ink-soft">
        <div className="flex items-center gap-1.5">
          <Ruler className="size-3.5 text-ink-faint" aria-hidden="true" />
          <dt className="sr-only">{t('meta.landLabel')}</dt>
          <dd className="numeric">
            {project.landAreaM2 === null
              ? t('meta.noLand')
              : t('meta.land', { m2: project.landAreaM2 })}
          </dd>
        </div>
        <div className="flex items-center gap-1.5">
          <Layers className="size-3.5 text-ink-faint" aria-hidden="true" />
          <dt className="sr-only">{t('meta.floorsLabel')}</dt>
          <dd className="numeric">
            {project.floorCount === null
              ? t('meta.noFloors')
              : t('meta.floors', { count: project.floorCount })}
          </dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">{t('meta.roomsLabel')}</dt>
          <dd className="numeric">{t('meta.rooms', { count: project.roomCount })}</dd>
        </div>
      </dl>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4">
        <span className="truncate text-xs font-semibold text-ink-faint">
          {project.style ? tStyles(`${project.style}.label`) : t('meta.noStyle')}
        </span>
        <time
          dateTime={project.updatedAt}
          className="shrink-0 text-xs text-ink-faint"
          title={format.dateTime(new Date(project.updatedAt), {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        >
          {updatedLabel}
        </time>
      </div>
    </Card>
  );
}
