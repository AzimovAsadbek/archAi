import { type ReactNode } from 'react';
import { AlertTriangle, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

export type AlertTone = 'info' | 'warning' | 'danger';

const TONES: Record<AlertTone, string> = {
  info: 'border-info/25 bg-info-soft text-ink',
  warning: 'border-warning/30 bg-warning-soft text-ink',
  danger: 'border-danger/25 bg-danger-soft text-ink',
};

const ICON_TONES: Record<AlertTone, string> = {
  info: 'text-info',
  warning: 'text-warning',
  danger: 'text-danger',
};

const ICONS: Record<AlertTone, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  danger: XCircle,
};

export interface AlertProps {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  className?: string;
  /** Errors should announce themselves to assistive tech. */
  live?: boolean;
}

export function Alert({ tone = 'info', title, children, className, live }: AlertProps) {
  const Icon = ICONS[tone];

  return (
    <div
      role={live ? 'alert' : undefined}
      className={cn('flex gap-3 rounded-md border px-4 py-3', TONES[tone], className)}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', ICON_TONES[tone])} aria-hidden="true" />
      <div className="min-w-0 text-sm leading-relaxed">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && 'mt-0.5 text-ink-soft')}>{children}</div> : null}
      </div>
    </div>
  );
}
