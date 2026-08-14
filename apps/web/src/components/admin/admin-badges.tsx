'use client';

import { useTranslations } from 'next-intl';
import { type BlogStatus, type UserRole } from '@archai/shared';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';

/** ADMIN is the exception, so it is the only role that carries the accent. */
export function RoleBadge({ role }: { role: UserRole }) {
  const tRoles = useTranslations('admin.users.roles');

  return (
    <Badge tone={role === 'ADMIN' ? 'accent' : 'neutral'} size="sm">
      {role === 'ADMIN' ? tRoles('ADMIN') : tRoles('USER')}
    </Badge>
  );
}

export function ActiveBadge({ isActive }: { isActive: boolean }) {
  const tState = useTranslations('admin.users.state');

  return (
    <Badge tone={isActive ? 'success' : 'faint'} size="sm">
      <span
        className={cn('size-1.5 rounded-full', isActive ? 'bg-success' : 'bg-line-strong')}
        aria-hidden="true"
      />
      {isActive ? tState('active') : tState('inactive')}
    </Badge>
  );
}

/** FAQ item published state. */
export function PublishedBadge({ isPublished }: { isPublished: boolean }) {
  const tFaq = useTranslations('adminContent.faq');

  return (
    <Badge tone={isPublished ? 'success' : 'faint'} size="sm">
      <span
        className={cn('size-1.5 rounded-full', isPublished ? 'bg-success' : 'bg-line-strong')}
        aria-hidden="true"
      />
      {isPublished ? tFaq('published') : tFaq('unpublished')}
    </Badge>
  );
}

/** Blog post lifecycle — PUBLISHED carries the success tone, DRAFT stays neutral. */
export function BlogStatusBadge({ status }: { status: BlogStatus }) {
  const tStatus = useTranslations('adminContent.blog.status');

  return (
    <Badge tone={status === 'PUBLISHED' ? 'success' : 'neutral'} size="sm">
      {status === 'PUBLISHED' ? tStatus('PUBLISHED') : tStatus('DRAFT')}
    </Badge>
  );
}

/** Pricing plan active/inactive — inactive plans are hidden from the public list. */
export function PlanActiveBadge({ isActive }: { isActive: boolean }) {
  const tPricing = useTranslations('adminContent.pricing');

  return (
    <Badge tone={isActive ? 'success' : 'faint'} size="sm">
      <span
        className={cn('size-1.5 rounded-full', isActive ? 'bg-success' : 'bg-line-strong')}
        aria-hidden="true"
      />
      {isActive ? tPricing('active') : tPricing('inactive')}
    </Badge>
  );
}
