import Link from 'next/link';
import { cn } from '@/lib/cn';

export function Logo({
  href = '/',
  className,
  size = 'md',
}: {
  href?: string;
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-baseline font-extrabold tracking-tight text-ink',
        size === 'sm' ? 'text-lg' : 'text-xl',
        className,
      )}
    >
      <span>arch</span>
      <span className="text-accent">Ai</span>
    </Link>
  );
}
