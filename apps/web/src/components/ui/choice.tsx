'use client';

import { type InputHTMLAttributes, type ReactNode, type Ref } from 'react';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Checkbox, Radio and Switch.
 *
 * Each keeps a real `<input>` underneath, visually hidden but not
 * `display: none` — it stays in the accessibility tree and the tab order, so
 * the browser continues to supply checked state, form participation, label
 * association and the correct screen-reader role. The visible box is a sibling
 * driven entirely by `peer-*` selectors, which means the custom appearance can
 * never disagree with the real state: there is only one source of truth and the
 * browser owns it.
 */

const BOX_BASE =
  'pointer-events-none flex shrink-0 items-center justify-center border transition-all ' +
  'peer-focus-visible:ring-2 peer-focus-visible:ring-accent/30 peer-focus-visible:ring-offset-1 ' +
  'peer-disabled:opacity-40';

interface ChoiceBaseProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label: ReactNode;
  /** Secondary line under the label. */
  hint?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

export interface CheckboxProps extends ChoiceBaseProps {
  /** Renders the dash state used by "select all" headers. */
  indeterminate?: boolean;
}

export function Checkbox({
  label,
  hint,
  indeterminate = false,
  className,
  disabled,
  ...props
}: CheckboxProps) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-2.5',
        disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <span className="relative flex items-center">
        <input
          type="checkbox"
          disabled={disabled}
          aria-checked={indeterminate ? 'mixed' : undefined}
          className="peer absolute size-5 cursor-pointer opacity-0 disabled:cursor-not-allowed"
          {...props}
        />
        <span
          aria-hidden="true"
          className={cn(
            BOX_BASE,
            'size-5 rounded-[5px] border-line-strong bg-surface',
            'peer-hover:border-accent/60',
            'peer-checked:border-accent peer-checked:bg-accent peer-checked:text-white',
            indeterminate && 'border-accent bg-accent text-white',
          )}
        >
          {indeterminate ? (
            <Minus className="size-3.5" strokeWidth={3} />
          ) : (
            <Check className="size-3.5 scale-0 transition-transform peer-checked:scale-100" strokeWidth={3} />
          )}
        </span>
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint ? <span className="block text-xs text-ink-faint">{hint}</span> : null}
      </span>
    </label>
  );
}

export function Radio({ label, hint, className, disabled, ...props }: ChoiceBaseProps) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-2.5',
        disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <span className="relative flex items-center">
        <input
          type="radio"
          disabled={disabled}
          className="peer absolute size-5 cursor-pointer opacity-0 disabled:cursor-not-allowed"
          {...props}
        />
        <span
          aria-hidden="true"
          className={cn(
            BOX_BASE,
            'size-5 rounded-full border-line-strong bg-surface',
            'peer-hover:border-accent/60 peer-checked:border-accent',
          )}
        >
          {/* The dot scales in rather than appearing, so the state change is
              legible at a glance without animating the whole control. */}
          <span className="size-2.5 scale-0 rounded-full bg-accent transition-transform peer-checked:scale-100" />
        </span>
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint ? <span className="block text-xs text-ink-faint">{hint}</span> : null}
      </span>
    </label>
  );
}

/**
 * Switch — for settings that take effect immediately. A checkbox with
 * `role="switch"`, which is what assistive technology expects for on/off state
 * as opposed to a selection that is confirmed later by a submit.
 */
export function Switch({ label, hint, className, disabled, ...props }: ChoiceBaseProps) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3',
        disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <span className="relative flex items-center">
        <input
          type="checkbox"
          role="switch"
          disabled={disabled}
          className="peer absolute h-6 w-10 cursor-pointer opacity-0 disabled:cursor-not-allowed"
          {...props}
        />
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none flex h-6 w-10 shrink-0 items-center rounded-full border border-line-strong bg-paper p-0.5 transition-colors',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-accent/30 peer-focus-visible:ring-offset-1',
            'peer-checked:border-accent peer-checked:bg-accent peer-disabled:opacity-40',
          )}
        >
          <span className="size-4.5 translate-x-0 rounded-full bg-surface shadow-sm transition-transform peer-checked:translate-x-4" />
        </span>
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint ? <span className="block text-xs text-ink-faint">{hint}</span> : null}
      </span>
    </label>
  );
}
