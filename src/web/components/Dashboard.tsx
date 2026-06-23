import { useState } from 'react';
import { ControlBar, type SortMode } from './ControlBar';
import { SortableGallery } from './SortableGallery';
import { useItems, useProcess, useReorder } from '../hooks/useItems';
import { useUpload } from '../hooks/useUpload';

export function Dashboard() {
  const [sortMode, setSortMode] = useState<SortMode>('custom');
  const { data, isLoading, error } = useItems();
  const reorder = useReorder();
  const processMut = useProcess();
  const { upload, isUploading, progress, error: uploadError } = useUpload();

  return (
    <div className="min-h-full">
      <ControlBar
        sortMode={sortMode}
        onSortChange={setSortMode}
        onUpload={(files) => upload(files)}
        isUploading={isUploading}
        progress={progress}
      />

      <main className="mx-auto max-w-6xl px-4 py-6">
        {error && (
          <ErrorBanner
            message={error instanceof Error ? error.message : 'Failed to load items'}
          />
        )}
        {uploadError && (
          <ErrorBanner
            message={
              uploadError instanceof Error
                ? uploadError.message
                : 'Upload failed'
            }
          />
        )}

        {isLoading ? (
          <div className="py-24 text-center text-sm text-neutral-500">
            Loading…
          </div>
        ) : (
          <SortableGallery
            items={data?.items ?? []}
            sortMode={sortMode}
            onReorder={(ids) => reorder.mutate(ids)}
            onProcess={(id) => processMut.mutate(id)}
          />
        )}
      </main>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      {message}
    </div>
  );
}
