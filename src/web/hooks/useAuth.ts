import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '../api/client';
import type { User } from '@shared/types';

const ME_KEY = ['auth', 'me'] as const;

/**
 * Returns `{ data: { user } | null }`. A 401 from /api/auth/me is
 * collapsed into `null` so callers can render a login redirect without
 * treating it as an error.
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: async (): Promise<{ user: User } | null> => {
      try {
        return await api.me();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 60_000,
    retry: false,
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.logout(),
    onSuccess: () => {
      qc.setQueryData(ME_KEY, null);
      qc.removeQueries({ queryKey: ['items'] });
    },
  });
}
