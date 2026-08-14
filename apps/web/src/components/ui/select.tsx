import { type Ref, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { CONTROL_CLASSES } from './input';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  ref?: Ref<HTMLSelectElement>;
  invalid?: boolean;
}

export function Select({ className, invalid, children, ...props }: SelectProps) {
  return (
    <span className="relative block">
      <select
        aria-invalid={invalid || undefined}
        className={cn(CONTROL_CLASSES, 'h-10 cursor-pointer appearance-none pr-9', className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-faint"
        aria-hidden="true"
      />
    </span>
  );
}
