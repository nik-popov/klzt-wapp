import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import type { Item, ItemMetadata } from '@shared/types';

interface ItemDetailProps {
  item: Item | null;
  onClose: () => void;
  onProcess: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, metadata: Partial<ItemMetadata>) => void;
}

const METADATA_FIELDS: Array<{ key: keyof ItemMetadata; label: string }> = [
  { key: 'brand', label: 'Brand' },
  { key: 'item_type', label: 'Type' },
  { key: 'color', label: 'Color' },
  { key: 'pattern', label: 'Pattern' },
  { key: 'material', label: 'Material' },
  { key: 'fit', label: 'Fit' },
  { key: 'occasion', label: 'Occasion' },
  { key: 'size', label: 'Size' },
  { key: 'season', label: 'Season' },
  { key: 'notes', label: 'Notes' },
];

const STATUS_LABEL: Record<Item['status'], string> = {
  raw: 'Original',
  processing: 'Working magic',
  ready: 'Ready',
};

function normalizeRotation(value: unknown): 0 | 90 | 180 | 270 {
  if (value === 90 || value === 180 || value === 270) return value;
  return 0;
}

function rotateBy(current: 0 | 90 | 180 | 270, delta: 90 | -90): 0 | 90 | 180 | 270 {
  const next = ((current + delta + 360) % 360) as 0 | 90 | 180 | 270;
  return next;
}

export function ItemDetail({
  item,
  onClose,
  onProcess,
  onDelete,
  onUpdate,
}: ItemDetailProps) {
  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [item, onClose]);

  // Title edit state. Resets when the open item changes.
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setEditingTitle(false);
    setTitleDraft('');
  }, [item?.id]);

  if (!item) return null;

  const display = item.processed_image_url ?? item.raw_image_url;
  const meta = item.metadata ?? {};
  const visibleRows = METADATA_FIELDS.filter(({ key }) => {
    const v = meta[key];
    return typeof v === 'string' && v.length > 0;
  });
  const tags = Array.isArray(meta.tags)
    ? meta.tags.filter((t): t is string => typeof t === 'string' && t.length > 0)
    : [];
  const fallbackTitle =
    (typeof meta.brand === 'string' && meta.brand) ||
    (typeof meta.item_type === 'string' && meta.item_type) ||
    'Untitled item';
  const currentTitle =
    typeof meta.title === 'string' && meta.title.length > 0 ? meta.title : '';
  const displayTitle = currentTitle || fallbackTitle;

  const rotation = normalizeRotation(meta.rotation);
  const imgStyle: React.CSSProperties =
    rotation === 0 ? {} : { transform: `rotate(${rotation}deg)` };

  const startEditTitle = () => {
    setTitleDraft(currentTitle);
    setEditingTitle(true);
    // Focus on next tick once the input renders.
    setTimeout(() => titleInputRef.current?.select(), 0);
  };

  const commitTitle = () => {
    const next = titleDraft.trim();
    setEditingTitle(false);
    // Only PATCH if the value actually changed; an empty value clears the title.
    if (next !== currentTitle) onUpdate(item.id, { title: next });
  };

  const cancelTitle = () => {
    setEditingTitle(false);
    setTitleDraft('');
  };

  const rotate = (delta: 90 | -90) => {
    onUpdate(item.id, { rotation: rotateBy(rotation, delta) });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={String(displayTitle)}
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-neutral-900 md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-neutral-700 shadow hover:bg-white dark:bg-neutral-800/90 dark:text-neutral-200 dark:hover:bg-neutral-800"
        >
          ✕
        </button>

        <div className="relative aspect-square w-full overflow-hidden bg-neutral-100 dark:bg-neutral-950 md:aspect-auto md:w-1/2">
          <img
            src={display}
            alt={String(displayTitle)}
            style={imgStyle}
            className="h-full w-full object-cover transition-transform"
            draggable={false}
          />
          <StatusPill status={item.status} className="absolute left-3 top-3" />

          {/* Rotate controls — bottom-left, hidden while processing. */}
          {item.status !== 'processing' && (
            <div className="absolute bottom-3 left-3 flex gap-1.5">
              <RotateButton label="Rotate left" onClick={() => rotate(-90)} dir="ccw" />
              <RotateButton label="Rotate right" onClick={() => rotate(90)} dir="cw" />
            </div>
          )}
        </div>

        <div className="flex w-full flex-col gap-4 overflow-y-auto p-5 md:w-1/2">
          <header>
            {editingTitle ? (
              <input
                ref={titleInputRef}
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitTitle();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelTitle();
                  }
                }}
                placeholder="Name this item"
                className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-lg font-semibold tracking-tight text-neutral-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              />
            ) : (
              <button
                type="button"
                onClick={startEditTitle}
                title="Click to rename"
                className="group/title -mx-1 flex w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-lg font-semibold tracking-tight text-neutral-900 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-800"
              >
                <span className={clsx(!currentTitle && 'text-neutral-500 dark:text-neutral-400')}>
                  {displayTitle}
                </span>
                <PencilIcon className="h-3.5 w-3.5 shrink-0 opacity-0 transition group-hover/title:opacity-60" />
              </button>
            )}
            <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              Added {new Date(item.created_at * 1000).toLocaleString()}
            </p>
          </header>

          {visibleRows.length > 0 ? (
            <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1.5 text-sm">
              {visibleRows.map(({ key, label }) => (
                <div key={String(key)} className="contents">
                  <dt className="text-neutral-500 dark:text-neutral-400">{label}</dt>
                  <dd className="text-neutral-900 dark:text-neutral-100">{String(meta[key])}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              No metadata yet. Magic Fix will auto-analyze this item.
            </p>
          )}

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          {item.status === 'processing' ? (
            <div className="mt-auto rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:bg-sky-900/30 dark:text-sky-100">
              Working magic…
            </div>
          ) : (
            <div className="mt-auto flex gap-2">
              <button
                type="button"
                onClick={() => onProcess(item.id)}
                className="flex-1 rounded-md bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
              >
                {item.status === 'raw' ? '✨ Magic Fix' : '✨ Re-fix'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Delete this item from your closet?')) {
                    onDelete(item.id);
                    onClose();
                  }
                }}
                className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 dark:border-red-900 dark:bg-neutral-900 dark:text-red-300 dark:hover:bg-red-950/40"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RotateButton({
  label,
  onClick,
  dir,
}: {
  label: string;
  onClick: () => void;
  dir: 'cw' | 'ccw';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid h-9 w-9 place-items-center rounded-full bg-white/90 text-neutral-700 shadow hover:bg-white dark:bg-neutral-800/90 dark:text-neutral-200 dark:hover:bg-neutral-800"
    >
      {dir === 'ccw' ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <path d="M3 4v5h5" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <path d="M21 12a9 9 0 1 1-3-6.7" />
          <path d="M21 4v5h-5" />
        </svg>
      )}
    </button>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function StatusPill({
  status,
  className,
}: {
  status: Item['status'];
  className?: string;
}) {
  const map: Record<Item['status'], string> = {
    raw: 'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100',
    processing: 'bg-sky-100 text-sky-900 dark:bg-sky-900/60 dark:text-sky-100',
    ready: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-100',
  };
  return (
    <span
      className={clsx(
        'rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide shadow-sm',
        map[status],
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
