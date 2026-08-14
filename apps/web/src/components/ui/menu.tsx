'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';

export interface MenuTriggerProps {
  ref: (node: HTMLButtonElement | null) => void;
  onClick: () => void;
  'aria-haspopup': 'menu';
  'aria-expanded': boolean;
  'aria-controls': string;
}

export type MenuClose = (restoreFocus?: boolean) => void;

export interface MenuProps {
  trigger: (props: MenuTriggerProps) => ReactNode;
  children: (close: MenuClose) => ReactNode;
  align?: 'start' | 'end';
  className?: string;
  panelClassName?: string;
}

/** Lightweight popover menu: outside-click + Escape close, arrow-key navigation. */
export function Menu({ trigger, children, align = 'end', className, panelClassName }: MenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const close = useCallback<MenuClose>((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const first = panelRef.current?.querySelector<HTMLElement>('[data-menu-item]:not([disabled])');
    first?.focus();
  }, [open]);

  const handlePanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();

    const items = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>('[data-menu-item]:not([disabled])') ?? [],
    );
    if (items.length === 0) return;

    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    const delta = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = (currentIndex + delta + items.length) % items.length;
    items[nextIndex]?.focus();
  };

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      {trigger({
        ref: (node) => {
          triggerRef.current = node;
        },
        onClick: () => setOpen((value) => !value),
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': panelId,
      })}

      {open ? (
        <div
          id={panelId}
          ref={panelRef}
          role="menu"
          onKeyDown={handlePanelKeyDown}
          className={cn(
            'absolute z-40 mt-2 min-w-52 overflow-hidden rounded-md border border-line bg-surface py-1 shadow-card',
            align === 'end' ? 'right-0' : 'left-0',
            panelClassName,
          )}
        >
          {children(close)}
        </div>
      ) : null}
    </div>
  );
}

export interface MenuItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  danger?: boolean;
}

export function MenuItem({ icon, danger, className, children, ...props }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      data-menu-item=""
      className={cn(
        'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm font-medium transition-colors',
        'focus-visible:outline-offset-[-2px] disabled:cursor-not-allowed disabled:opacity-50',
        danger ? 'text-danger hover:bg-danger-soft' : 'text-ink hover:bg-paper',
        className,
      )}
      {...props}
    >
      {icon ? (
        <span className="shrink-0 text-ink-faint" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="truncate">{children}</span>
    </button>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-line" />;
}
