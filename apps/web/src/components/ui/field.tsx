import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface FieldControlProps {
  id: string;
  'aria-describedby': string | undefined;
  'aria-invalid': true | undefined;
  'aria-required': true | undefined;
}

export interface FieldProps {
  label: string;
  /** Localized error text; presence marks the control invalid. */
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  labelSuffix?: ReactNode;
  children: (control: FieldControlProps) => ReactNode;
}

export function Field({
  label,
  error,
  hint,
  required,
  className,
  labelSuffix,
  children,
}: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ');

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold text-ink">
          {label}
          {required ? (
            <span className="ml-1 text-accent-strong" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
        {labelSuffix}
      </div>

      {children({
        id,
        'aria-describedby': describedBy || undefined,
        'aria-invalid': error ? true : undefined,
        'aria-required': required ? true : undefined,
      })}

      {hint ? (
        <p id={hintId} className="text-xs leading-relaxed text-ink-faint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
