import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ListItemsResponse, UploadResponse } from '@shared/types';
import { api } from '../api/client';

export function useUpload() {
  const qc = useQueryClient();
  const [progress, setProgress] = useState<{ done: number; total: number }>({
    done: 0,
    total: 0,
  });

  const mutation = useMutation({
    mutationFn: async (files: File[]) => {
      setProgress({ done: 0, total: files.length });
      // Upload one at a time so progress reflects per-file completion and
      // backend sort_order assignment stays deterministic.
      const created: UploadResponse['items'] = [];
      for (const f of files) {
        const res = await api.uploadFiles([f]);
        created.push(...res.items);
        setProgress((p) => ({ done: p.done + 1, total: p.total }));
      }
      return { items: created } satisfies UploadResponse;
    },
    onSuccess: (res) => {
      const previous = qc.getQueryData<ListItemsResponse>(['items']);
      if (previous) {
        qc.setQueryData<ListItemsResponse>(['items'], {
          items: [...previous.items, ...res.items],
        });
      }
      qc.invalidateQueries({ queryKey: ['items'] });
    },
    onSettled: () => setProgress({ done: 0, total: 0 }),
  });

  const upload = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;
      mutation.mutate(list);
    },
    [mutation],
  );

  return {
    upload,
    isUploading: mutation.isPending,
    error: mutation.error,
    progress,
  };
}
