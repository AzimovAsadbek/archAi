import Link from 'next/link';
import { cn } from '@/lib/cn';

/**
 * `tone` picks the surface the mark sits on, not a different mark: `shell` is
 * the obsidian chrome of the signed-in app, `paper` the light marketing and
 * document surfaces. The accent half stays indigo in both — it is the brand,
 * and it clears AA on either background.
 */
export function Logo({
  href = '/',
  className,
  size = 'md',
  tone = 'paper',
}: {
  href?: string;
  className?: string;
  size?: 'sm' | 'md';
  tone?: 'paper' | 'shell';
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-baseline font-extrabold tracking-tight',
        tone === 'shell' ? 'text-shell-ink' : 'text-ink',
        size === 'sm' ? 'text-lg' : 'text-xl',
        className,
      )}
    >
      <span>arch</span>
      <span className={tone === 'shell' ? 'text-accent-on-shell' : 'text-accent'}>Ai</span>
    </Link>
  );
}
