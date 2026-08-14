'use client';

import { useTranslations } from 'next-intl';
import { type UserRole } from '@archai/shared';
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
