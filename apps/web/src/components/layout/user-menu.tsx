'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronDown, LogOut, ShieldCheck } from 'lucide-react';
import { type UserDto } from '@archai/shared';
import { Menu, MenuItem, MenuSeparator } from '@/components/ui/menu';
import { useLogout } from '@/lib/use-auth';
import { initials } from '@/lib/format';

export function UserMenu({ user }: { user: UserDto }) {
  const t = useTranslations('nav');
  const router = useRouter();
  const logout = useLogout();

  return (
    <Menu
      trigger={(triggerProps) => (
        <button
          type="button"
          {...triggerProps}
          className="flex items-center gap-2 rounded-md border border-line bg-surface py-1 pr-2 pl-1 text-sm font-semibold text-ink transition-colors hover:bg-paper"
        >
          <span
            className="flex size-7 items-center justify-center rounded-sm bg-ink text-[11px] font-bold text-paper"
            aria-hidden="true"
          >
            {initials(user.fullName)}
          </span>
          <span className="hidden max-w-32 truncate sm:inline">{user.fullName}</span>
          <ChevronDown className="size-4 text-ink-faint" aria-hidden="true" />
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="px-3 py-2">
            <p className="truncate text-sm font-bold text-ink">{user.fullName}</p>
            <p className="truncate text-xs text-ink-faint">{user.email}</p>
          </div>
          <MenuSeparator />
          {/* Admin-only entry point; the panel itself re-checks the role, and every
              /admin endpoint enforces it server-side. */}
          {user.role === 'ADMIN' ? (
            <MenuItem
              icon={<ShieldCheck className="size-4" />}
              onClick={() => {
                close(false);
                router.push('/admin/users');
              }}
            >
              {t('admin')}
            </MenuItem>
          ) : null}
          <MenuItem
            icon={<LogOut className="size-4" />}
            disabled={logout.isPending}
            onClick={() => {
              close(false);
              logout.mutate();
            }}
          >
            {t('logout')}
          </MenuItem>
        </>
      )}
    </Menu>
  );
}
