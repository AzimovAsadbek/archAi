import { type AppLocale } from '@/i18n/locales';
import { cn } from '@/lib/cn';

/**
 * Locale flags as inline SVG.
 *
 * Deliberately not emoji: Windows ships no glyphs for regional-indicator pairs,
 * so `🇺🇿` renders there as the bare letters "UZ" — which is precisely the
 * plain-text fallback the design forbids. Inline SVG renders identically on
 * every platform, scales cleanly, and costs no network request.
 *
 * Drawn at 3:2, the proportion all three of these flags actually use, and
 * simplified to the marks that read at 20px. They are decorative: the control
 * always carries the language name as its accessible label, so the flag is
 * `aria-hidden` and never the only way to identify a language.
 */

function FlagFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 30 20"
      aria-hidden="true"
      focusable="false"
      className={cn('block shrink-0 rounded-[2px] ring-1 ring-black/10', className)}
    >
      {children}
    </svg>
  );
}

/** Uzbekistan: sky blue / white / green, red fimbriations, crescent and stars. */
function UzFlag({ className }: { className?: string }) {
  return (
    <FlagFrame className={className}>
      <rect width="30" height="20" fill="#0099B5" />
      <rect y="6.6" width="30" height="6.8" fill="#fff" />
      <rect y="13.4" width="30" height="6.6" fill="#1EB53A" />
      <rect y="6.2" width="30" height="0.6" fill="#CE1126" />
      <rect y="13.2" width="30" height="0.6" fill="#CE1126" />
      {/* Crescent: a white disc with an overlapping blue disc cutting it. */}
      <circle cx="5.6" cy="3.4" r="2.2" fill="#fff" />
      <circle cx="6.6" cy="3.4" r="2.2" fill="#0099B5" />
      <g fill="#fff">
        <circle cx="10.4" cy="1.9" r="0.42" />
        <circle cx="10.4" cy="4.1" r="0.42" />
        <circle cx="12.6" cy="1.9" r="0.42" />
        <circle cx="12.6" cy="4.1" r="0.42" />
        <circle cx="14.8" cy="1.9" r="0.42" />
      </g>
    </FlagFrame>
  );
}

/** Russia: white / blue / red. */
function RuFlag({ className }: { className?: string }) {
  return (
    <FlagFrame className={className}>
      <rect width="30" height="20" fill="#fff" />
      <rect y="6.67" width="30" height="6.67" fill="#0039A6" />
      <rect y="13.34" width="30" height="6.66" fill="#D52B1E" />
    </FlagFrame>
  );
}

/** United Kingdom: Union Flag, simplified to its diagonals and cross. */
function GbFlag({ className }: { className?: string }) {
  return (
    <FlagFrame className={className}>
      <rect width="30" height="20" fill="#012169" />
      {/* Saltire — white then red, drawn as clipped strokes. */}
      <g clipPath="url(#gb-clip)">
        <clipPath id="gb-clip">
          <rect width="30" height="20" />
        </clipPath>
        <path d="M0 0 L30 20 M30 0 L0 20" stroke="#fff" strokeWidth="4" />
        <path d="M0 0 L30 20 M30 0 L0 20" stroke="#C8102E" strokeWidth="1.8" />
      </g>
      {/* Cross of St George. */}
      <path d="M15 0 V20 M0 10 H30" stroke="#fff" strokeWidth="6.6" />
      <path d="M15 0 V20 M0 10 H30" stroke="#C8102E" strokeWidth="4" />
    </FlagFrame>
  );
}

const FLAGS: Record<AppLocale, (props: { className?: string }) => React.ReactElement> = {
  uz: UzFlag,
  ru: RuFlag,
  en: GbFlag,
};

export function Flag({ locale, className }: { locale: AppLocale; className?: string }) {
  const Component = FLAGS[locale];
  return <Component className={cn('h-3.5 w-[21px]', className)} />;
}
