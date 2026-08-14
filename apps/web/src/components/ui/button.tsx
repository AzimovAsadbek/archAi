import { type ButtonHTMLAttributes, type Ref } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from './spinner';

export type ButtonVariant = 'primary' | 'accent' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap ' +
  'transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-paper hover:bg-ink-soft',
  accent: 'bg-accent text-white hover:bg-accent-strong',
  outline: 'border border-line-strong bg-surface text-ink hover:bg-paper',
  ghost: 'text-ink-soft hover:bg-line/60 hover:text-ink',
  danger: 'bg-danger text-white hover:bg-danger/90',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-[15px]',
};

export function buttonClasses(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className?: string,
): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses(variant, size, cn(fullWidth && 'w-full', className))}
      {...props}
    >
      {loading ? <Spinner className="size-4" /> : null}
      {children}
    </button>
  );
}

export interface IconButtonProps extends ButtonProps {
  /** Icon-only buttons must carry an accessible name. */
  'aria-label': string;
}

export function IconButton({ className, size = 'md', ...props }: IconButtonProps) {
  return (
    <Button
      {...props}
      size={size}
      className={cn('px-0', size === 'sm' ? 'w-8' : size === 'lg' ? 'w-12' : 'w-10', className)}
    />
  );
}
