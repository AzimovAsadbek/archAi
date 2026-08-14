import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeTone =
  | 'neutral'
  | 'faint'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'outline';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-line/70 text-ink-soft',
  faint: 'bg-paper text-ink-faint border border-line',
  accent: 'bg-accent-soft text-accent-strong',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  outline: 'border border-line-strong text-ink-soft',
};

export interface BadgeProps {
  tone?: BadgeTone;
  size?: 'sm' | 'md';
  className?: string;
  children: ReactNode;
}

export function Badge({ tone = 'neutral', size = 'md', className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm font-semibold whitespace-nowrap',
        size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-1 text-xs',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
