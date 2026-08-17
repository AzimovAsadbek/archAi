'use client';

import { type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Popover, PopoverItem } from './popover';
import { cn } from '@/lib/cn';

/**
 * archAI Select.
 *
 * A listbox on the shared `Popover`, not a restyled native `<select>`: the
 * native control renders an OS menu that no amount of CSS reaches, so a product
 * whose whole argument is precision ends up with a Windows dropdown in the
 * middle of it.
 *
 * What it keeps from native behaviour, because losing it would be a regression:
 * the trigger is a real button with `aria-haspopup="listbox"`, arrow keys open
 * and traverse, the menu opens focused on the current value, Escape and outside
 * click dismiss, and focus returns to the trigger. Options carry
 * `role="option"` with `aria-selected`.
 *
 * A hidden native input mirrors the value so the control still posts inside an
 * uncontrolled form and is visible to form-level validation.
 */

export interface SelectOption<T extends string | number> {
  value: T;
  label: string;
  /** Secondary line — units, counts, anything that qualifies the label. */
  hint?: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface SelectProps<T extends string | number> {
  /** Accessible name. Pair with a visible <Field> label where one exists. */
  label: string;
  options: readonly SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Shown when no option matches `value`. */
  placeholder?: string;
  name?: string;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  className?: string;
  /** Leading icon on the trigger, mirroring the selected option's own icon. */
  leadingIcon?: ReactNode;
}

export function Select<T extends string | number>({
  label,
  options,
  value,
  onChange,
  placeholder,
  name,
  disabled = false,
  invalid = false,
  id,
  className,
  leadingIcon,
}: SelectProps<T>) {
  const selected = options.find((option) => option.value === value);

  return (
    <>
      {name ? <input type="hidden" name={name} value={String(value)} /> : null}
      <Popover
        role="listbox"
        label={label}
        matchTriggerWidth
        className={className}
        trigger={({ open, triggerProps }) => (
          <button
            type="button"
            {...triggerProps}
            ref={triggerProps.ref as React.Ref<HTMLButtonElement>}
            id={id}
            disabled={disabled}
            aria-label={label}
            aria-invalid={invalid || undefined}
            className={cn(
              'flex h-10 w-full items-center gap-2 rounded-md border bg-surface px-3 text-left text-sm transition-colors',
              'focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:outline-none',
              'disabled:cursor-not-allowed disabled:bg-paper disabled:text-ink-faint',
              invalid
                ? 'border-danger focus-visible:border-danger'
                : open
                  ? 'border-accent ring-2 ring-accent/25'
                  : 'border-line hover:border-line-strong',
            )}
          >
            {leadingIcon ?? selected?.icon ? (
              <span className="shrink-0 text-ink-faint">{leadingIcon ?? selected?.icon}</span>
            ) : null}
            <span
              className={cn(
                'min-w-0 flex-1 truncate font-medium',
                selected ? 'text-ink' : 'text-ink-faint',
              )}
            >
              {selected?.label ?? placeholder ?? ''}
            </span>
            {selected?.hint ? (
              <span className="shrink-0 font-mono text-xs text-ink-faint tabular-nums">
                {selected.hint}
              </span>
            ) : null}
            <ChevronDown
              className={cn(
                'size-4 shrink-0 text-ink-faint transition-transform',
                open && 'rotate-180',
              )}
              aria-hidden="true"
            />
          </button>
        )}
      >
        {(close) => (
          <div className="max-h-72 overflow-y-auto">
            {options.map((option) => (
              <PopoverItem
                key={String(option.value)}
                selected={option.value === value}
                disabled={option.disabled}
                onSelect={() => {
                  onChange(option.value);
                  close();
                }}
              >
                {option.icon ? <span className="shrink-0">{option.icon}</span> : null}
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.hint ? (
                  <span className="shrink-0 font-mono text-xs text-ink-faint tabular-nums">
                    {option.hint}
                  </span>
                ) : null}
                {option.value === value ? (
                  <Check className="size-4 shrink-0" aria-hidden="true" />
                ) : null}
              </PopoverItem>
            ))}
          </div>
        )}
      </Popover>
    </>
  );
}
