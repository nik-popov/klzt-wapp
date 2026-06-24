import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { ControlBar, type SortMode } from './ControlBar';
import { SortableGallery } from './SortableGallery';
import { ItemDetail } from './ItemDetail';
import {
  useDelete,
  useItems,
  useProcess,
  useProcessAll,
  useReorder,
  useUpdateItem,
} from '../hooks/useItems';
import { useUpload } from '../hooks/useUpload';

export function Dashboard() {
  const [sortMode, setSortMode] = useState<SortMode>('custom');
  const [openId, setOpenId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);

  const { data, isLoading, error } = useItems();
  const reorder = useReorder();
  const processMut = useProcess();
  const processAll = useProcessAll();
  const deleteMut = useDelete();
  const updateMut = useUpdateItem();
  const { upload, isUploading, progress, error: uploadError } = useUpload();

  const openItem = useMemo(
    () => data?.items.find((it) => it.id === openId) ?? null,
    [data, openId],
  );

  const rawIds = useMemo(
    () => (data?.items ?? []).filter((it) => it.status === 'raw').map((it) => it.id),
    [data],
  );

  // Native file drop: listen at window so the entire app is a target.
  // dragDepth handles nested dragenter/leave events without flicker.
  useEffect(() => {
    const hasFiles = (e: DragEvent) =>
      Array.from(e.dataTransfer?.types ?? []).includes('Files');

    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current += 1;
      setIsDragging(true);
    };
    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setIsDragging(false);
    };
    const onDrop = async (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current = 0;
      setIsDragging(false);
      const items = e.dataTransfer?.items;
      const files: File[] = items
        ? await collectFilesFromItems(items)
        : Array.from(e.dataTransfer?.files ?? []);
      const images = files.filter((f) => f.type.startsWith('image/'));
      if (images.length > 0) upload(images);
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [upload]);

  return (
    <div className="relative min-h-full">
      <ControlBar
        sortMode={sortMode}
        onSortChange={setSortMode}
        onUploadFromDevice={(files) => upload(files)}
        onTakePhoto={(files) => upload(files)}
        isUploading={isUploading}
        uploadProgress={progress}
        rawCount={rawIds.length}
        onProcessAll={() => processAll.run(rawIds)}
        isProcessingAll={processAll.isProcessing}
        processAllProgress={processAll.progress}
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
        {processAll.error && (
          <ErrorBanner
            message={`Magic Fix all: some items failed — ${processAll.error}`}
          />
        )}

        {isLoading ? (
          <div className="py-24 text-center text-sm text-neutral-500 dark:text-neutral-400">
            Loading…
          </div>
        ) : (
          <SortableGallery
            items={data?.items ?? []}
            sortMode={sortMode}
            onReorder={(ids) => reorder.mutate(ids)}
            onProcess={(id) => processMut.mutate(id)}
            onOpen={(it) => setOpenId(it.id)}
          />
        )}
      </main>

      <ItemDetail
        item={openItem}
        onClose={() => setOpenId(null)}
        onProcess={(id) => processMut.mutate(id)}
        onDelete={(id) => deleteMut.mutate(id)}
        onUpdate={(id, metadata) => updateMut.mutate({ id, metadata })}
      />

      <div
        aria-hidden
        className={clsx(
          'pointer-events-none fixed inset-0 z-40 flex items-center justify-center transition',
          isDragging
            ? 'bg-neutral-900/40 backdrop-blur-sm opacity-100'
            : 'opacity-0',
        )}
      >
        <div className="rounded-2xl border-2 border-dashed border-white/80 bg-white/10 px-8 py-6 text-center">
          <p className="text-lg font-semibold text-white">Drop to add</p>
          <p className="mt-1 text-sm text-white/80">
            Photos will be uploaded to your closet
          </p>
        </div>
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
      {message}
    </div>
  );
}

/**
 * Walk a DataTransferItemList (drop target) and collect every file,
 * recursing into directories so users can drop a whole folder. Falls
 * back to a flat list if the browser doesn't expose webkitGetAsEntry.
 */
async function collectFilesFromItems(list: DataTransferItemList): Promise<File[]> {
  const files: File[] = [];
  const entries: FileSystemEntry[] = [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (item.kind !== 'file') continue;
    const entry =
      typeof (item as DataTransferItem).webkitGetAsEntry === 'function'
        ? item.webkitGetAsEntry()
        : null;
    if (entry) {
      entries.push(entry);
    } else {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }
  for (const entry of entries) {
    await walkEntry(entry, files);
  }
  return files;
}

async function walkEntry(entry: FileSystemEntry, sink: File[]): Promise<void> {
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry;
    const file = await new Promise<File>((resolve, reject) =>
      fileEntry.file(resolve, reject),
    );
    sink.push(file);
    return;
  }
  if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry;
    const reader = dirEntry.createReader();
    // readEntries can return chunks; loop until empty.
    while (true) {
      const chunk = await new Promise<FileSystemEntry[]>((resolve, reject) =>
        reader.readEntries(resolve, reject),
      );
      if (chunk.length === 0) break;
      for (const e of chunk) await walkEntry(e, sink);
    }
  }
}
