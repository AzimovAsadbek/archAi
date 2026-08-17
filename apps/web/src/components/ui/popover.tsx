'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefCallback,
} from 'react';
import { cn } from '@/lib/cn';

/**
 * The one popover foundation.
 *
 * Every dropdown, select menu and locale list in the product mounts through
 * this, so surface, radius, border, padding, elevation and open/close motion
 * are defined once. Building each menu independently is how a design system
 * drifts — the shared piece here is the *surface and behaviour*, while each
 * caller supplies its own trigger and rows.
 *
 * Behaviour it owns: outside-click and Escape dismissal, focus return to the
 * trigger on close, roving arrow-key navigation over the rows, and Home/End.
 * Callers get keyboard support for free rather than re-implementing it.
 */

export interface PopoverRenderProps {
  open: boolean;
  /** Spread onto the trigger element. */
  triggerProps: {
    ref: RefCallback<HTMLElement>;
    'aria-haspopup': 'listbox' | 'menu';
    'aria-expanded': boolean;
    'aria-controls': string;
    onClick: () => void;
    onKeyDown: (event: React.KeyboardEvent) => void;
  };
  close: (returnFocus?: boolean) => void;
}

export interface PopoverProps {
  /** `listbox` for value selection, `menu` for actions. */
  role?: 'listbox' | 'menu';
  label: string;
  trigger: (props: PopoverRenderProps) => ReactNode;
  children: (close: (returnFocus?: boolean) => void) => ReactNode;
  /** Menu alignment against the trigger. */
  align?: 'start' | 'end';
  /** Menu width: matches the trigger, or sizes to content. */
  matchTriggerWidth?: boolean;
  className?: string;
  menuClassName?: string;
}

export function Popover({
  role = 'menu',
  label,
  trigger,
  children,
  align = 'start',
  matchTriggerWidth = false,
  className,
  menuClassName,
}: PopoverProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  // Dismiss on outside pointer or Escape, wherever focus currently is.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close]);

  /** Focusable rows, in DOM order. */
  const items = (): HTMLElement[] =>
    menuRef.current
      ? Array.from(menuRef.current.querySelectorAll<HTMLElement>('[data-popover-item]:not([aria-disabled="true"])'))
      : [];

  // On open, focus the selected row when there is one, else the first.
  useEffect(() => {
    if (!open) return;
    const rows = items();
    const selected = rows.find((row) => row.getAttribute('aria-selected') === 'true');
    (selected ?? rows[0])?.focus();
  }, [open]);

  const onMenuKeyDown = (event: React.KeyboardEvent) => {
    const rows = items();
    if (rows.length === 0) return;
    const index = rows.indexOf(document.activeElement as HTMLElement);
    let next: number | null = null;
    if (event.key === 'ArrowDown') next = (index + 1) % rows.length;
    else if (event.key === 'ArrowUp') next = (index - 1 + rows.length) % rows.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = rows.length - 1;
    else if (event.key === 'Tab') {
      // Tabbing out of a popover dismisses it, matching native select behaviour.
      close(false);
      return;
    } else return;
    event.preventDefault();
    rows[next]?.focus();
  };

  const triggerProps: PopoverRenderProps['triggerProps'] = {
    ref: (node) => {
      triggerRef.current = node;
    },
    'aria-haspopup': role,
    'aria-expanded': open,
    'aria-controls': menuId,
    onClick: () => setOpen((value) => !value),
    onKeyDown: (event) => {
      // Down/Up open the menu from the trigger, as a native select does.
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setOpen(true);
      }
    },
  };

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      {trigger({ open, triggerProps, close })}

      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role={role}
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          className={cn(
            'absolute z-50 mt-1.5 min-w-full overflow-hidden rounded-panel border border-line bg-surface p-1 shadow-card',
            'motion-safe:animate-[popover-in_var(--duration-fast)_var(--ease-out)]',
            align === 'end' ? 'right-0' : 'left-0',
            matchTriggerWidth ? 'w-full' : 'w-max',
            menuClassName,
          )}
        >
          {children(close)}
        </div>
      ) : null}
    </div>
  );
}

/**
 * One row inside a popover. `selected` drives both the check mark and the
 * accent wash, so a caller cannot style a row as chosen without also
 * announcing it.
 */
export function PopoverItem({
  selected = false,
  disabled = false,
  onSelect,
  children,
  className,
}: {
  selected?: boolean;
  disabled?: boolean;
  onSelect: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      data-popover-item=""
      role="option"
      aria-selected={selected}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-tool px-2.5 py-2 text-left text-sm transition-colors',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
        selected ? 'bg-accent-soft font-semibold text-accent-strong' : 'text-ink hover:bg-paper',
        disabled && 'cursor-not-allowed opacity-40',
        className,
      )}
    >
      {children}
    </button>
  );
}
