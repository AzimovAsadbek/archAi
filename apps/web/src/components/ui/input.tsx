import { type InputHTMLAttributes, type Ref } from 'react';
import { cn } from '@/lib/cn';

export const CONTROL_CLASSES =
  'w-full rounded-md border border-line bg-surface px-3 text-sm text-ink ' +
  'placeholder:text-ink-faint transition-colors ' +
  'focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/10 ' +
  'disabled:cursor-not-allowed disabled:bg-paper disabled:text-ink-faint ' +
  'aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/15';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  ref?: Ref<HTMLInputElement>;
  invalid?: boolean;
}

export function Input({ className, invalid, type = 'text', ...props }: InputProps) {
  return (
    <input
      type={type}
      aria-invalid={invalid || undefined}
      className={cn(CONTROL_CLASSES, 'h-10', type === 'number' && 'numeric', className)}
      {...props}
    />
  );
}
