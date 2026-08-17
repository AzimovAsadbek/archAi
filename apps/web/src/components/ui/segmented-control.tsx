'use client';

import { useRef } from 'react';
import { cn } from '@/lib/cn';

/**
 * Segmented control for small, mutually exclusive choices — floor count,
 * finish level, layout strategy.
 *
 * A radio group underneath, not a row of buttons: the semantics a screen reader
 * needs for "one of these" are exactly radio semantics, and getting them free
 * is worth more than the markup saved by using buttons. Arrow keys move between
 * options and select as they go, which is the native radio behaviour people
 * already have in their fingers.
 */

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
  /** Optional short line under the label — room counts use it for the type. */
  hint?: string;
  disabled?: boolean;
}

export function SegmentedControl<T extends string | number>({
  name,
  label,
  options,
  value,
  onChange,
  size = 'md',
  fullWidth = true,
  className,
}: {
  name: string;
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
  className?: string;
}) {
  const refs = useRef(new Map<T, HTMLButtonElement>());

  const move = (direction: 1 | -1) => {
    const enabled = options.filter((option) => !option.disabled);
    const index = enabled.findIndex((option) => option.value === value);
    const next = enabled[(index + direction + enabled.length) % enabled.length];
    if (!next) return;
    onChange(next.value);
    refs.current.get(next.value)?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'inline-flex items-stretch gap-1 rounded-panel border border-line bg-paper p-1',
        fullWidth && 'flex w-full',
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            ref={(node) => {
              if (node) refs.current.set(option.value, node);
              else refs.current.delete(option.value);
            }}
            type="button"
            role="radio"
            name={name}
            aria-checked={selected}
            disabled={option.disabled}
            // Roving tabindex: the group is one tab stop, arrows move within it.
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                event.preventDefault();
                move(1);
              } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                event.preventDefault();
                move(-1);
              }
            }}
            className={cn(
              'flex flex-1 flex-col items-center justify-center rounded-tool font-semibold transition-colors',
              'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
              size === 'sm' ? 'h-7 px-2 text-xs' : 'h-9 px-3 text-sm',
              selected
                ? 'bg-surface text-ink shadow-card'
                : 'text-ink-faint hover:text-ink disabled:hover:text-ink-faint',
              option.disabled && 'cursor-not-allowed opacity-40',
            )}
          >
            <span>{option.label}</span>
            {option.hint ? (
              <span className="text-[10px] leading-tight font-medium text-ink-faint">
                {option.hint}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
