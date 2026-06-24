import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Item,
  ItemMetadata,
  ListItemsResponse,
  ProcessResponse,
} from '@shared/types';
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
      if (res.warning) {
        // Bubble Gemini failure to the user: the byte-copy fallback ran so
        // the item flipped to 'ready' but the image is unchanged.
        console.warn('Magic Fix fell back:', res.warning);
        alert(`Magic Fix couldn't reach Gemini, so the image wasn't changed.\n\n${res.warning}`);
      }
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(ITEMS_KEY, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ITEMS_KEY }),
  });
}

export function useDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ITEMS_KEY });
      const previous = qc.getQueryData<ListItemsResponse>(ITEMS_KEY);
      if (previous) {
        qc.setQueryData<ListItemsResponse>(ITEMS_KEY, {
          items: previous.items.filter((it) => it.id !== id),
        });
      }
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(ITEMS_KEY, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ITEMS_KEY }),
  });
}

/**
 * Inline-edit any subset of an item's metadata (title, rotation, etc).
 * Optimistically merges the patch into the cached item so the UI feels
 * instant; rolls back on error.
 */
export function useUpdateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, metadata }: { id: string; metadata: Partial<ItemMetadata> }) =>
      api.patchItem(id, metadata),
    onMutate: async ({ id, metadata }) => {
      await qc.cancelQueries({ queryKey: ITEMS_KEY });
      const previous = qc.getQueryData<ListItemsResponse>(ITEMS_KEY);
      if (previous) {
        qc.setQueryData<ListItemsResponse>(ITEMS_KEY, {
          items: previous.items.map((it) =>
            it.id === id
              ? { ...it, metadata: { ...(it.metadata ?? {}), ...metadata } }
              : it,
          ),
        });
      }
      return { previous };
    },
    onSuccess: (res) => {
      const previous = qc.getQueryData<ListItemsResponse>(ITEMS_KEY);
      if (previous) {
        qc.setQueryData<ListItemsResponse>(ITEMS_KEY, {
          items: previous.items.map((it) =>
            it.id === res.item.id ? res.item : it,
          ),
        });
      }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(ITEMS_KEY, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ITEMS_KEY }),
  });
}

/**
 * Sequentially run Magic Fix on a list of ids. Concurrency = 1 to stay
 * within Gemini rate limits; progress is exposed for the ControlBar UI.
 * Cache is invalidated once at the end rather than per-item.
 */
export function useProcessAll() {
  const qc = useQueryClient();
  const [progress, setProgress] = useState<{ done: number; total: number; failed: number }>(
    { done: 0, total: 0, failed: 0 },
  );
  const [isProcessing, setProcessing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const run = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0 || isProcessing) return;
      setProcessing(true);
      setLastError(null);
      setProgress({ done: 0, total: ids.length, failed: 0 });

      let updatedItems: Item[] = [];
      for (const id of ids) {
        // Flip status to processing in the cache so the gallery shows the spinner.
        qc.setQueryData<ListItemsResponse>(ITEMS_KEY, (prev) =>
          prev
            ? {
                items: prev.items.map((it) =>
                  it.id === id ? { ...it, status: 'processing' } : it,
                ),
              }
            : prev,
        );
        try {
          const res: ProcessResponse = await api.process(id);
          updatedItems.push(res.item);
          qc.setQueryData<ListItemsResponse>(ITEMS_KEY, (prev) =>
            prev
              ? {
                  items: prev.items.map((it) =>
                    it.id === res.item.id ? res.item : it,
                  ),
                }
              : prev,
          );
          setProgress((p) => ({ ...p, done: p.done + 1 }));
        } catch (err) {
          setLastError(err instanceof Error ? err.message : String(err));
          setProgress((p) => ({ ...p, done: p.done + 1, failed: p.failed + 1 }));
        }
      }

      await qc.invalidateQueries({ queryKey: ITEMS_KEY });
      setProcessing(false);
      return updatedItems;
    },
    [isProcessing, qc],
  );

  return { run, isProcessing, progress, error: lastError };
}
