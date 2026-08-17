'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useMe } from '@/lib/use-auth';
import { LocaleSwitcher } from './locale-switcher';
import { Logo } from './logo';
import { UserMenu } from './user-menu';

/**
 * The one top bar of the signed-in app.
 *
 * Dashboard, workspace and admin all render this: same height, same obsidian,
 * same identity mark on the left and same account controls on the right. Only
 * the middle changes — a nav link on the dashboard, a project breadcrumb and
 * instrument readouts in the workspace.
 *
 * It exists because those screens used to carry three different headers. Opening
 * a project swapped a light bar for a dark one and dropped the logo, the
 * language selector and the account menu, so the studio read as a separate
 * product rather than a mode of this one. Keeping the bar fixed across the whole
 * signed-in app is what makes moving between them feel like one place.
 */

export interface HeaderReadout {
  /** Short mono label, e.g. `1:100` or `X`. */
  label: string;
  value: string;
}

export interface AppHeaderProps {
  /** Breadcrumb content after the logo — nav links, or a project name. */
  context?: ReactNode;
  /** Live measurements for the active viewport. Omitted where there are none. */
  readouts?: HeaderReadout[];
  /** Screen-specific actions, placed before the account controls. */
  actions?: ReactNode;
  /** `sticky` for scrolling pages, `static` inside a fixed-height frame. */
  position?: 'sticky' | 'static';
  className?: string;
}

export function AppHeader({
  context,
  readouts,
  actions,
  position = 'static',
  className,
}: AppHeaderProps) {
  // Read from the auth cache rather than take a prop: every screen that renders
  // this bar is already behind an auth gate that populated it, and threading the
  // user through two shells was one more way for them to drift apart.
  const { data: user } = useMe();

  return (
    <header
      className={cn(
        'flex h-[var(--size-app-header)] shrink-0 items-center gap-3 border-b border-shell-line bg-shell px-3 sm:px-4',
        // The chrome sets its own inherited colour. Without this, text lands on
        // `text-ink` from the body — the same value as `--color-shell` — so
        // anything that forgets an explicit class renders invisible.
        'text-shell-ink-soft',
        position === 'sticky' && 'sticky top-0',
        className,
      )}
      style={{ zIndex: 'var(--z-header)' }}
    >
      <Logo href="/dashboard" size="sm" tone="shell" className="shrink-0" />

      {/* `min-w-0 flex-1` is what lets a long project name truncate. Without it
          the breadcrumb refuses to shrink, and on a phone the controls to its
          right overlap it instead. */}
      {context ? (
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <span aria-hidden="true" className="shrink-0 text-shell-ink-faint select-none">
            /
          </span>
          {context}
        </div>
      ) : null}

      {/* Mono so a changing readout never reflows the control beside it. */}
      {readouts && readouts.length > 0 ? (
        <dl className="ml-3 hidden items-center gap-4 lg:flex">
          {readouts.map((r) => (
            <div key={r.label} className="flex items-baseline gap-1.5">
              <dt className="font-mono text-[10px] tracking-wider text-shell-ink-faint uppercase">
                {r.label}
              </dt>
              <dd className="font-mono text-xs tabular-nums text-shell-ink-soft">{r.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        {actions}
        {/* Full name, not the flag-only form: the selector names the language it
            will switch to. The word hides below `sm`, where the bar has no room
            for it — never the language code. */}
        <LocaleSwitcher tone="shell" className="inline-flex" compact="sm" />
        {user ? <UserMenu user={user} tone="shell" /> : null}
      </div>
    </header>
  );
}
