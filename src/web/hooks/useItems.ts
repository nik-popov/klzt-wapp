import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Item, ListItemsResponse, ProcessResponse } from '@shared/types';
import { api } from '../api/client';

const ITEMS_KEY = ['items'] as const;

export function useItems() {
  return useQuery({
    queryKey: ITEMS_KEY,
    queryFn: () => api.listItems(),
    staleTime: 30_000,
  });
}

export function useReorder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api.reorder(ids),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: ITEMS_KEY });
      const previous = qc.getQueryData<ListItemsResponse>(ITEMS_KEY);
      if (previous) {
        const byId = new Map(previous.items.map((it) => [it.id, it]));
        const reordered: Item[] = ids
          .map((id, index) => {
            const it = byId.get(id);
            return it ? { ...it, sort_order: index } : null;
          })
          .filter((x): x is Item => x !== null);
        qc.setQueryData<ListItemsResponse>(ITEMS_KEY, { items: reordered });
      }
      return { previous };
    },
    onError: (_err, _ids, ctx) => {
      if (ctx?.previous) qc.setQueryData(ITEMS_KEY, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ITEMS_KEY }),
  });
}

export function useProcess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.process(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ITEMS_KEY });
      const previous = qc.getQueryData<ListItemsResponse>(ITEMS_KEY);
      if (previous) {
        qc.setQueryData<ListItemsResponse>(ITEMS_KEY, {
          items: previous.items.map((it) =>
            it.id === id ? { ...it, status: 'processing' } : it,
          ),
        });
      }
      return { previous };
    },
    onSuccess: (res: ProcessResponse) => {
      const previous = qc.getQueryData<ListItemsResponse>(ITEMS_KEY);
      if (previous) {
        qc.setQueryData<ListItemsResponse>(ITEMS_KEY, {
          items: previous.items.map((it) =>
            it.id === res.item.id ? res.item : it,
          ),
        });
      }
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(ITEMS_KEY, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ITEMS_KEY }),
  });
}
