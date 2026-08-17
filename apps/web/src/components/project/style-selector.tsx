'use client';

import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { HOUSE_STYLES, type HouseStyle } from '@archai/shared';
import { cn } from '@/lib/cn';

/**
 * Visual style picker.
 *
 * A dropdown is the wrong control for a visual choice — nobody picks a facade
 * from a list of words. Each option carries a drawn elevation instead.
 *
 * The previews are line elevations rather than photographs: there is no image
 * pipeline, and a stock photo would show a building archAI did not design. A
 * drawing is honest about what the product produces and matches the plan
 * language used everywhere else. Each one reflects what its style actually
 * changes in the 3D presentation — glazing proportion, roof form, facade
 * articulation — so the preview is a real cue rather than decoration.
 */

/** Elevation sketches, drawn in a shared 64×44 frame. */
function Elevation({ style }: { style: HouseStyle }) {
  const ink = 'var(--color-ink)';
  const soft = 'var(--color-ink-faint)';
  const glass = 'var(--color-accent)';

  return (
    <svg viewBox="0 0 64 44" className="h-full w-full" aria-hidden="true" focusable="false">
      <rect width="64" height="44" fill="var(--color-paper)" />
      <line x1="4" y1="39" x2="60" y2="39" stroke={soft} strokeWidth="0.7" />

      {style === 'MODERN' ? (
        <g stroke={ink} strokeWidth="1.2" fill="none">
          <path d="M10 39 V20 H54 V39" />
          <path d="M8 20 H56" />
          {/* Large glazing, flat roof, horizontal emphasis. */}
          <rect x="14" y="24" width="16" height="11" fill={glass} fillOpacity="0.18" />
          <rect x="34" y="24" width="16" height="11" fill={glass} fillOpacity="0.18" />
        </g>
      ) : null}

      {style === 'CLASSIC' ? (
        <g stroke={ink} strokeWidth="1.2" fill="none">
          <path d="M12 39 V22 H52 V39" />
          {/* Pitched roof with eaves, symmetrical openings, columns. */}
          <path d="M8 22 L32 9 L56 22" />
          <rect x="17" y="26" width="8" height="9" />
          <rect x="39" y="26" width="8" height="9" />
          <path d="M29 39 V27 H35 V39" />
          <path d="M26 27 V39 M38 27 V39" strokeWidth="1.6" />
        </g>
      ) : null}

      {style === 'MINIMALIST' ? (
        <g stroke={ink} strokeWidth="1.2" fill="none">
          <path d="M14 39 V21 H50 V39" />
          <path d="M12 21 H52" />
          {/* One opening, no articulation. */}
          <rect x="28" y="26" width="9" height="9" fill={glass} fillOpacity="0.14" />
        </g>
      ) : null}

      {style === 'TRADITIONAL' || style === 'NATIONAL' ? (
        <g stroke={ink} strokeWidth="1.2" fill="none">
          <path d="M12 39 V24 H52 V39" />
          <path d="M9 24 L32 13 L55 24" />
          {/* Deep eave and a shaded veranda — the regional cue. */}
          <path d="M9 24 H55" strokeWidth="1.6" />
          <rect x="18" y="28" width="7" height="7" />
          <rect x="39" y="28" width="7" height="7" />
          <path d="M28 39 V29 H36 V39" />
        </g>
      ) : null}

      {style === 'EUROPEAN' ? (
        <g stroke={ink} strokeWidth="1.2" fill="none">
          <path d="M13 39 V23 H51 V39" />
          <path d="M10 23 L32 11 L54 23" />
          <rect x="18" y="27" width="7" height="8" />
          <rect x="39" y="27" width="7" height="8" />
          <path d="M29 39 V28 H35 V39" />
          <path d="M32 11 V6" strokeWidth="0.9" />
        </g>
      ) : null}
    </svg>
  );
}

export function StyleSelector({
  value,
  onChange,
  label,
  disabled = false,
  /** Restrict the offered set; defaults to every supported style. */
  styles = HOUSE_STYLES,
  className,
}: {
  value: HouseStyle | null;
  onChange: (style: HouseStyle) => void;
  label: string;
  disabled?: boolean;
  styles?: readonly HouseStyle[];
  className?: string;
}) {
  const t = useTranslations('styles');

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4', className)}
    >
      {styles.map((style) => {
        const selected = style === value;
        return (
          <button
            key={style}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            // Roving tabindex: the group is one tab stop.
            tabIndex={selected || (value === null && style === styles[0]) ? 0 : -1}
            onClick={() => onChange(style)}
            title={t(`${style}.description`)}
            className={cn(
              'group relative overflow-hidden rounded-panel border text-left transition-colors',
              'focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:outline-none',
              selected
                ? 'border-accent bg-accent-soft'
                : 'border-line bg-surface hover:border-line-strong',
              disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            <span className="block aspect-[16/11] border-b border-line">
              <Elevation style={style} />
            </span>
            <span className="flex items-center justify-between gap-1.5 px-2.5 py-2">
              <span
                className={cn(
                  'truncate text-xs font-semibold',
                  selected ? 'text-accent-strong' : 'text-ink',
                )}
              >
                {t(`${style}.label`)}
              </span>
              {selected ? (
                <Check className="size-3.5 shrink-0 text-accent-strong" aria-hidden="true" />
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
