import { useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';
import type { Item } from '@shared/types';

interface ItemCardProps {
  item: Item;
  onProcess: (id: string) => void;
  onOpen: (item: Item) => void;
  sortable?: boolean;
}

export function ItemCard({ item, onProcess, onOpen, sortable = true }: ItemCardProps) {
  const sortableState = useSortable({ id: item.id, disabled: !sortable });
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = sortableState;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Distinguish click (tap) from drag: capture pointerdown pos, only
  // fire onOpen if pointerup is within a small threshold (dnd-kit's
  // activationConstraint already suppresses drag below 6px).
  const downAt = useRef<{ x: number; y: number } | null>(null);

  const displayUrl = item.processed_image_url ?? item.raw_image_url;
  // Prefer the auto-generated title, fall back to brand or a generic
  // placeholder so cards always show *something* below the image.
  const title =
    (typeof item.metadata?.title === 'string' && item.metadata.title) ||
    (typeof item.metadata?.brand === 'string' && item.metadata.brand) ||
    'Untitled';

  const rotation = normalizeRotation(item.metadata?.rotation);
  const imgStyle: React.CSSProperties =
    rotation === 0 ? {} : { transform: `rotate(${rotation}deg)` };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        'group relative flex flex-col gap-1.5',
        isDragging && 'z-10 opacity-70',
      )}
    >
      <div
        {...attributes}
        {...listeners}
        role="button"
        tabIndex={0}
        onPointerDownCapture={(e) => {
          downAt.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const start = downAt.current;
          downAt.current = null;
          if (!start) return;
          const dx = Math.abs(e.clientX - start.x);
          const dy = Math.abs(e.clientY - start.y);
          // Below the drag-activation threshold => treat as a click.
          if (dx < 6 && dy < 6 && !isDragging) onOpen(item);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onOpen(item);
        }}
        className={clsx(
          'relative aspect-square overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 shadow-sm transition',
          'dark:border-neutral-800 dark:bg-neutral-900',
          'group-hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/30 dark:focus-visible:ring-white/30',
          sortable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        )}
      >
        <img
          src={displayUrl}
          alt={title}
          loading="lazy"
          draggable={false}
          style={imgStyle}
          className="h-full w-full select-none object-cover"
        />

        <StatusBadge status={item.status} />

        {item.status === 'raw' && (
          <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/40 via-black/0 to-transparent p-3 opacity-0 transition group-hover:opacity-100">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onProcess(item.id);
              }}
              className="pointer-events-auto rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-neutral-900 shadow-md hover:bg-neutral-100"
            >
              ✨ Magic Fix
            </button>
          </div>
        )}

        {item.status === 'ready' && (
          <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/40 via-black/0 to-transparent p-3 opacity-0 transition group-hover:opacity-100">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onProcess(item.id);
              }}
              className="pointer-events-auto rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-neutral-900 shadow-md hover:bg-white"
            >
              ✨ Re-fix
            </button>
          </div>
        )}

        {item.status === 'processing' && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm dark:bg-neutral-950/60">
            <Spinner />
          </div>
        )}
      </div>

      <div
        className="truncate px-1 text-xs font-medium text-neutral-700 dark:text-neutral-300"
        title={title}
      >
        {title}
      </div>
    </div>
  );
}

function normalizeRotation(value: unknown): 0 | 90 | 180 | 270 {
  if (value === 90 || value === 180 || value === 270) return value;
  return 0;
}

const STATUS_LABEL: Record<Item['status'], string> = {
  raw: 'Original',
  processing: 'Working magic',
  ready: 'Ready',
};

function StatusBadge({ status }: { status: Item['status'] }) {
  const map: Record<Item['status'], string> = {
    raw: 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100',
    processing: 'bg-sky-100 text-sky-900 dark:bg-sky-900/50 dark:text-sky-100',
    ready: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100',
  };
  return (
    <span
      className={clsx(
        'absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide shadow-sm',
        map[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function Spinner() {
  return (
    <span
      role="status"
      aria-label="Processing"
      className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700 dark:border-neutral-700 dark:border-t-neutral-200"
    />
  );
}
