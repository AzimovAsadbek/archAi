import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  tone?: 'default' | 'danger';
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  tone = 'default',
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-md border border-dashed px-6 py-14 text-center',
        tone === 'danger' ? 'border-danger/40 bg-danger-soft/40' : 'border-line-strong bg-surface',
        className,
      )}
    >
      {icon ? (
        <div
          className={cn(
            'mb-4 flex size-11 items-center justify-center rounded-md border',
            tone === 'danger'
              ? 'border-danger/30 bg-surface text-danger'
              : 'border-line bg-paper text-ink-soft',
          )}
          aria-hidden="true"
        >
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-bold text-ink">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-ink-soft">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
