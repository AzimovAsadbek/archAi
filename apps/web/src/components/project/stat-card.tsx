import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  className?: string;
}

export function StatCard({ label, value, hint, icon, className }: StatCardProps) {
  return (
    <div className={cn('rounded-panel border border-line bg-surface p-4', className)}>
      <div className="flex items-center gap-2">
        {icon ? (
          <span className="text-ink-faint" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <p className="text-xs font-semibold tracking-wide text-ink-faint uppercase">{label}</p>
      </div>
      <p className="numeric mt-2 text-2xl leading-none font-extrabold text-ink">{value}</p>
      {hint ? <p className="numeric mt-1.5 text-xs text-ink-soft">{hint}</p> : null}
    </div>
  );
}
