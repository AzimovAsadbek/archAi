'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type UserDto } from '@archai/shared';
import { isUnauthorized } from './api';
import { logout as logoutRequest, me } from './endpoints';
import { queryKeys } from './query-keys';

export function useMe() {
  return useQuery<UserDto>({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) => me(signal),
    retry: false,
    staleTime: 60_000,
  });
}

export interface RequireAuthResult {
  user: UserDto | undefined;
  isLoading: boolean;
  isUnauthenticated: boolean;
  /** Non-401 failure (server unreachable, 500, …) — 401 redirects instead. */
  error: unknown;
  retry: () => void;
}

/** Guards an authenticated area: 401 sends the visitor to /login?next=<path>. */
export function useRequireAuth(): RequireAuthResult {
  const router = useRouter();
  const pathname = usePathname();
  const { data, isPending, error, refetch } = useMe();
  const unauthenticated = isUnauthorized(error);

  useEffect(() => {
    if (!unauthenticated) return;
    const next = pathname && pathname !== '/' ? `?next=${encodeURIComponent(pathname)}` : '';
    router.replace(`/login${next}`);
  }, [unauthenticated, pathname, router]);

  return {
    user: data,
    isLoading: isPending,
    isUnauthenticated: unauthenticated,
    error: unauthenticated ? null : error,
    retry: () => void refetch(),
  };
}

export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => logoutRequest(),
    onSettled: () => {
      queryClient.clear();
      router.replace('/login');
    },
  });
}
