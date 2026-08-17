'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  Box,
  Calculator,
  Grid2x2,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Sofa,
  Sparkles,
  Trees,
  type LucideIcon,
} from 'lucide-react';
import { type ProjectStatus } from '@archai/shared';
import { AppHeader, type HeaderReadout } from '@/components/layout/app-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/cn';

/**
 * The Architectural Studio Shell.
 *
 * A fixed-height frame rather than a scrolling page: the app's obsidian chrome
 * on the outside so the drawing reads as the lit surface, a collapsible icon
 * rail for the five workspace modes, and a canvas region that takes every pixel
 * the chrome does not. The document surfaces inside stay light — this is shell
 * chrome, not a dark theme.
 *
 * The top bar is `AppHeader`, the same component the dashboard renders, so the
 * logo, language selector and account menu stay exactly where they were when
 * the project was opened. Only the rail is particular to the workspace.
 *
 * The header carries live instrument readouts (scale, cursor coordinates). They
 * are passed in rather than computed here, because only the active viewport
 * knows them and an invented coordinate would be worse than none: `readouts`
 * is optional and simply renders nothing when a mode has no measurements.
 */

export type WorkspaceMode = 'overview' | 'plans2d' | 'view3d' | 'estimate' | 'assistant';

export const WORKSPACE_MODES: { id: WorkspaceMode; icon: LucideIcon }[] = [
  { id: 'overview', icon: LayoutDashboard },
  { id: 'plans2d', icon: Grid2x2 },
  { id: 'view3d', icon: Box },
  { id: 'estimate', icon: Calculator },
  { id: 'assistant', icon: Sparkles },
];

/**
 * Modules that are planned but not built. They stay in the rail — hiding them
 * would misrepresent the roadmap just as badly as showing them enabled would
 * misrepresent the product — rendered disabled and explicitly labelled.
 */
export const ROADMAP_MODES: { id: 'interior' | 'exterior'; icon: LucideIcon }[] = [
  { id: 'interior', icon: Sofa },
  { id: 'exterior', icon: Trees },
];

/** Readouts are the header's shape; the alias keeps existing imports working. */
export type WorkspaceReadout = HeaderReadout;

export interface WorkspaceShellProps {
  projectName: string;
  status: ProjectStatus;
  mode: WorkspaceMode;
  onModeChange: (mode: WorkspaceMode) => void;
  railCollapsed: boolean;
  onRailToggle: () => void;
  /** Instrument readouts for the active mode; omitted modes show none. */
  readouts?: WorkspaceReadout[];
  /** Right-hand header actions (export, edit, overflow menu). */
  actions?: ReactNode;
  children: ReactNode;
}

export function WorkspaceShell({
  projectName,
  status,
  mode,
  onModeChange,
  railCollapsed,
  onRailToggle,
  readouts,
  actions,
  children,
}: WorkspaceShellProps) {
  const t = useTranslations('workspace');

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-shell">
      {/* The same top bar the dashboard renders — the project name takes the
          breadcrumb slot after the logo, so moving in and out of a project
          never changes the chrome. */}
      <AppHeader
        readouts={readouts}
        actions={actions}
        context={
          <div className="flex min-w-0 items-center gap-2.5">
            <h1 className="truncate text-sm font-bold text-shell-ink">{projectName}</h1>
            {/* The name is the context that matters on a phone; the status is
                repeated on the overview below, so it yields the space. */}
            <span className="hidden shrink-0 sm:inline-flex">
              <StatusBadge status={status} size="sm" />
            </span>
          </div>
        }
      />

      {/* ── Rail + canvas ────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1">
        <nav
          aria-label={t('modes')}
          className={cn(
            'flex shrink-0 flex-col border-r border-shell-line bg-shell py-2 transition-[width]',
            // Same reason as the header: without an explicit colour the rail
            // inherits `text-ink`, which is the exact value of `--color-shell`.
            'text-shell-ink-soft',
            'w-14',
            !railCollapsed && 'lg:w-52',
          )}
          style={{ transitionDuration: 'var(--duration-base)', zIndex: 'var(--z-rail)' }}
        >
          <ul className="flex flex-col gap-0.5 px-2">
            {WORKSPACE_MODES.map(({ id, icon: Icon }) => {
              const active = mode === id;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => onModeChange(id)}
                    aria-current={active ? 'page' : undefined}
                    title={railCollapsed ? t(`tabs.${id}`) : undefined}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-tool px-2.5 py-2 text-sm font-semibold transition-colors',
                      active
                        ? 'bg-accent text-white'
                        : 'text-shell-ink-soft hover:bg-shell-raised hover:text-shell-ink',
                      railCollapsed ? 'justify-center px-0' : 'justify-center px-0 lg:justify-start lg:px-2.5',
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    <span
                      className={cn(
                        'truncate',
                        railCollapsed ? 'sr-only' : 'sr-only lg:not-sr-only',
                      )}
                    >
                      {t(`tabs.${id}`)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <ul className="mt-1 flex flex-col gap-0.5 border-t border-shell-line px-2 pt-2">
            {ROADMAP_MODES.map(({ id, icon: Icon }) => {
              const name = t('tabRoadmap', { tab: t(`tabs.${id}`) });
              return (
                <li key={id}>
                  <span
                    title={name}
                    aria-disabled="true"
                    className={cn(
                      'flex w-full cursor-not-allowed items-center gap-3 rounded-tool px-2.5 py-2 text-sm font-semibold text-shell-ink-faint',
                      railCollapsed
                        ? 'justify-center px-0'
                        : 'justify-center px-0 lg:justify-start lg:px-2.5',
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    <span className={cn('truncate', railCollapsed ? 'sr-only' : 'sr-only lg:not-sr-only')}>{name}</span>
                  </span>
                </li>
              );
            })}
          </ul>

          <button
            type="button"
            onClick={onRailToggle}
            aria-expanded={!railCollapsed}
            className={cn(
              'mt-auto mx-2 flex items-center gap-3 rounded-tool px-2.5 py-2 text-shell-ink-faint transition-colors hover:bg-shell-raised hover:text-shell-ink',
              railCollapsed
                ? 'justify-center px-0'
                : 'justify-center px-0 lg:justify-start lg:px-2.5',
            )}
          >
            {railCollapsed ? (
              <PanelLeftOpen className="size-4" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="size-4" aria-hidden="true" />
            )}
            <span className={cn('text-xs font-semibold', railCollapsed ? 'sr-only' : 'sr-only lg:not-sr-only')}>
              {t('collapseRail')}
            </span>
          </button>
        </nav>

        {/* The canvas region. `min-h-0` lets a child own the scroll instead of
            the page, which is what keeps the frame fixed. */}
        <main
          id="workspace-canvas"
          className="min-h-0 min-w-0 flex-1 overflow-hidden bg-paper"
          style={{ zIndex: 'var(--z-canvas)' }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

/** Header action button, styled for the dark shell. */
export function ShellAction({
  icon: Icon,
  label,
  onClick,
  href,
  disabled,
  className,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  className?: string;
}) {
  const classes = cn(
    'flex h-8 items-center gap-1.5 rounded-tool border border-shell-line px-2.5 text-xs font-semibold text-shell-ink-soft transition-colors hover:bg-shell-raised hover:text-shell-ink disabled:opacity-40',
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes} title={label}>
        <Icon className="size-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">{label}</span>
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={classes}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

