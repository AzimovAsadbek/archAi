'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { FEATURE_ICONS, type FeatureKey } from '@/lib/project-options';

export interface FeatureToggleCardProps {
  feature: FeatureKey;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function FeatureToggleCard({
  feature,
  label,
  description,
  checked,
  onChange,
  disabled,
}: FeatureToggleCardProps) {
  const Icon = FEATURE_ICONS[feature];

  return (
    <label
      className={cn(
        'relative flex cursor-pointer items-start gap-3 rounded-md border bg-surface p-4 transition-colors',
        checked ? 'border-accent bg-accent-soft/40' : 'border-line hover:border-line-strong',
        disabled && 'cursor-not-allowed opacity-60',
        'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent',
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-sm border',
          checked ? 'border-accent/30 bg-surface text-accent' : 'border-line bg-paper text-ink-soft',
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-ink">{label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">{description}</span>
      </span>
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm border',
          checked ? 'border-accent bg-accent text-white' : 'border-line-strong bg-surface',
        )}
      >
        {checked ? <Check className="size-3.5" /> : null}
      </span>
    </label>
  );
}
