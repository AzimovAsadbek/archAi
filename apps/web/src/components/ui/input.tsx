'use client';

import { type InputHTMLAttributes, type ReactNode, type Ref } from 'react';
import { Check, LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * archAI input.
 *
 * The control is a bordered *shell* with the bare `<input>` sitting inside it,
 * rather than a styled input. That is what lets a leading icon, a trailing
 * action and a unit suffix share one focus ring instead of each sitting in its
 * own box — and the whole shell reacts to focus, error and success, so the
 * states read as one object.
 *
 * Focus is an accent ring plus an accent border: visible immediately at a
 * glance, without the heavy glow that makes a dense form feel noisy.
 */

export const CONTROL_CLASSES =
  'w-full rounded-md border border-line bg-surface px-3 text-sm text-ink ' +
  'placeholder:text-ink-faint transition-colors ' +
  'focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 ' +
  'disabled:cursor-not-allowed disabled:bg-paper disabled:text-ink-faint ' +
  'aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/15';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  ref?: Ref<HTMLInputElement>;
  invalid?: boolean;
  /** Confirmed-good state — a validated slug, an available email. */
  valid?: boolean;
  loading?: boolean;
  leadingIcon?: ReactNode;
  /** Unit shown inside the shell, e.g. `m` or `m²`. Decorative: the accessible
   *  name must still carry the unit, so callers put it in the field label. */
  suffix?: string;
  /** Interactive trailing control (clear, reveal password). */
  trailing?: ReactNode;
  /** Centre the value — used by the paired dimension inputs. */
  centered?: boolean;
}

export function Input({
  className,
  invalid = false,
  valid = false,
  loading = false,
  leadingIcon,
  suffix,
  trailing,
  centered = false,
  disabled,
  type = 'text',
  ...props
}: InputProps) {
  return (
    <div
      className={cn(
        'flex h-10 items-center gap-2 rounded-md border bg-surface px-3 transition-colors',
        // The shell owns focus styling on behalf of the inner input.
        'focus-within:ring-2 focus-within:ring-accent/25',
        invalid
          ? 'border-danger focus-within:border-danger focus-within:ring-danger/20'
          : valid
            ? 'border-success focus-within:border-success'
            : 'border-line focus-within:border-accent hover:border-line-strong',
        disabled && 'cursor-not-allowed bg-paper',
        className,
      )}
    >
      {leadingIcon ? (
        <span className="shrink-0 text-ink-faint" aria-hidden="true">
          {leadingIcon}
        </span>
      ) : null}

      <input
        type={type}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className={cn(
          'min-w-0 flex-1 bg-transparent text-sm text-ink outline-none',
          'placeholder:text-ink-faint disabled:cursor-not-allowed disabled:text-ink-faint',
          // Measured values are mono so digits line up between paired fields.
          (type === 'number' || centered) && 'font-mono tabular-nums',
          centered && 'text-center',
        )}
        {...props}
      />

      {loading ? (
        <LoaderCircle className="size-4 shrink-0 animate-spin text-ink-faint" aria-hidden="true" />
      ) : valid && !invalid ? (
        <Check className="size-4 shrink-0 text-success" aria-hidden="true" />
      ) : null}

      {suffix ? (
        <span
          className="shrink-0 border-l border-line pl-2 font-mono text-xs text-ink-faint"
          aria-hidden="true"
        >
          {suffix}
        </span>
      ) : null}

      {trailing ? <span className="shrink-0">{trailing}</span> : null}
    </div>
  );
}

/**
 * Paired dimension input — `12 × 15 m`.
 *
 * Architectural measurements come in pairs far more often than alone, and two
 * separate fields with two separate unit labels reads as a form rather than as
 * a dimension. The `×` is decorative; each field keeps its own accessible name.
 */
export function DimensionInput({
  widthLabel,
  lengthLabel,
  width,
  length,
  onWidthChange,
  onLengthChange,
  unit = 'm',
  invalid = false,
  disabled = false,
  className,
}: {
  widthLabel: string;
  lengthLabel: string;
  width: string;
  length: string;
  onWidthChange: (value: string) => void;
  onLengthChange: (value: string) => void;
  unit?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Input
        inputMode="decimal"
        aria-label={widthLabel}
        value={width}
        onChange={(event) => onWidthChange(event.target.value)}
        invalid={invalid}
        disabled={disabled}
        centered
        className="flex-1"
      />
      <span aria-hidden="true" className="shrink-0 text-sm text-ink-faint">
        ×
      </span>
      <Input
        inputMode="decimal"
        aria-label={lengthLabel}
        value={length}
        onChange={(event) => onLengthChange(event.target.value)}
        invalid={invalid}
        disabled={disabled}
        centered
        suffix={unit}
        className="flex-1"
      />
    </div>
  );
}
