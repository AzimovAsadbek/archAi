'use client';

import { type HouseStyle } from '@archai/shared';
import { cn } from '@/lib/cn';

export interface StyleRadioCardProps {
  style: HouseStyle;
  label: string;
  description: string;
  checked: boolean;
  name: string;
  onSelect: (style: HouseStyle) => void;
  disabled?: boolean;
}

export function StyleRadioCard({
  style,
  label,
  description,
  checked,
  name,
  onSelect,
  disabled,
}: StyleRadioCardProps) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-md border bg-surface p-4 transition-colors',
        checked ? 'border-accent bg-accent-soft/40' : 'border-line hover:border-line-strong',
        disabled && 'cursor-not-allowed opacity-60',
        'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent',
      )}
    >
      <input
        type="radio"
        name={name}
        value={style}
        checked={checked}
        disabled={disabled}
        onChange={() => onSelect(style)}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border',
          checked ? 'border-accent' : 'border-line-strong',
        )}
      >
        {checked ? <span className="size-2 rounded-full bg-accent" /> : null}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-ink">{label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">{description}</span>
      </span>
    </label>
  );
}
