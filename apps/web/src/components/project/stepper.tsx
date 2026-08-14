'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface StepperStep {
  id: string;
  label: string;
}

export interface StepperProps {
  steps: StepperStep[];
  currentIndex: number;
  /** Highest step the user is allowed to jump back (or forward) to. */
  maxReachedIndex: number;
  onSelect: (index: number) => void;
  label: string;
  disabled?: boolean;
}

export function Stepper({
  steps,
  currentIndex,
  maxReachedIndex,
  onSelect,
  label,
  disabled = false,
}: StepperProps) {
  const progress = steps.length > 1 ? (currentIndex / (steps.length - 1)) * 100 : 100;

  return (
    <nav aria-label={label}>
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-2">
        {steps.map((step, index) => {
          const isCurrent = index === currentIndex;
          const isDone = index < currentIndex;
          const reachable = index <= maxReachedIndex;

          return (
            <li key={step.id} className="flex items-center">
              <button
                type="button"
                onClick={() => onSelect(index)}
                disabled={disabled || !reachable}
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm font-semibold transition-colors',
                  isCurrent && 'text-ink',
                  !isCurrent && reachable && 'text-ink-soft hover:text-ink',
                  !reachable && 'cursor-not-allowed text-ink-faint',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'numeric flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold',
                    isCurrent && 'border-accent bg-accent text-white',
                    isDone && !isCurrent && 'border-ink bg-ink text-paper',
                    !isCurrent && !isDone && 'border-line-strong bg-surface text-ink-faint',
                  )}
                >
                  {isDone ? <Check className="size-3.5" /> : index + 1}
                </span>
                <span className="hidden sm:inline">{step.label}</span>
              </button>
              {index < steps.length - 1 ? (
                <span aria-hidden="true" className="mx-1 h-px w-3 bg-line-strong sm:w-5" />
              ) : null}
            </li>
          );
        })}
      </ol>

      <div
        className="mt-3 h-1 w-full overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={currentIndex + 1}
        aria-label={label}
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${Math.max(progress, 4)}%` }}
        />
      </div>
    </nav>
  );
}
