import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds hover elevation — use for cards that behave as links. */
  interactive?: boolean;
  children: ReactNode;
}

export function Card({ interactive, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-md border border-line bg-surface',
        interactive && 'transition-shadow duration-150 hover:shadow-card',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
