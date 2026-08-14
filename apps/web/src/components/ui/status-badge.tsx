'use client';

import { useTranslations } from 'next-intl';
import { type ProjectStatus } from '@archai/shared';
import { cn } from '@/lib/cn';
import { Badge, type BadgeTone } from './badge';

const TONES: Record<ProjectStatus, BadgeTone> = {
  DRAFT: 'neutral',
  CONFIGURED: 'success',
  GENERATING: 'info',
  READY: 'accent',
  ARCHIVED: 'faint',
  FAILED: 'danger',
};

const DOTS: Record<ProjectStatus, string> = {
  DRAFT: 'bg-ink-faint',
  CONFIGURED: 'bg-success',
  GENERATING: 'bg-info animate-pulse',
  READY: 'bg-accent',
  ARCHIVED: 'bg-line-strong',
  FAILED: 'bg-danger',
};

export function StatusBadge({
  status,
  size = 'md',
  className,
}: {
  status: ProjectStatus;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const t = useTranslations('project.status');

  return (
    <Badge tone={TONES[status]} size={size} className={className}>
      <span className={cn('size-1.5 rounded-full', DOTS[status])} aria-hidden="true" />
      {t(status)}
    </Badge>
  );
}
