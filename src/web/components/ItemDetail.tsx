import { useEffect } from 'react';
import clsx from 'clsx';
import type { Item, ItemMetadata } from '@shared/types';

interface ItemDetailProps {
  item: Item | null;
  onClose: () => void;
  onProcess: (id: string) => void;
  onDelete: (id: string) => void;
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
  { key: 'tag', label: 'Tag' },
  { key: 'notes', label: 'Notes' },
];

export function ItemDetail({ item, onClose, onProcess, onDelete }: ItemDetailProps) {
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

  if (!item) return null;

  const display = item.processed_image_url ?? item.raw_image_url;
  const meta = item.metadata ?? {};
  const visibleRows = METADATA_FIELDS.filter(({ key }) => {
    const v = meta[key];
    return typeof v === 'string' && v.length > 0;
  });
  const title =
    (typeof meta.brand === 'string' && meta.brand) ||
    (typeof meta.item_type === 'string' && meta.item_type) ||
    'Untitled item';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={String(title)}
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-neutral-700 shadow hover:bg-white"
        >
          ✕
        </button>

        <div className="relative aspect-square w-full bg-neutral-100 md:aspect-auto md:w-1/2">
          <img
            src={display}
            alt={String(title)}
            className="h-full w-full object-cover"
            draggable={false}
          />
          <StatusPill status={item.status} className="absolute left-3 top-3" />
        </div>

        <div className="flex w-full flex-col gap-4 overflow-y-auto p-5 md:w-1/2">
          <header>
            <h2 className="text-lg font-semibold tracking-tight text-neutral-900">
              {String(title)}
            </h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              Added {new Date(item.created_at * 1000).toLocaleString()}
            </p>
          </header>

          {visibleRows.length > 0 ? (
            <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1.5 text-sm">
              {visibleRows.map(({ key, label }) => (
                <div key={String(key)} className="contents">
                  <dt className="text-neutral-500">{label}</dt>
                  <dd className="text-neutral-900">{String(meta[key])}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-neutral-500">
              No metadata yet. V2 will let you tag brand, type, color, season,
              and more.
            </p>
          )}

          {item.status === 'processing' ? (
            <div className="mt-auto rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-900">
              Working magic…
            </div>
          ) : (
            <div className="mt-auto flex gap-2">
              <button
                type="button"
                onClick={() => onProcess(item.id)}
                className="flex-1 rounded-md bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
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
                className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
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

function StatusPill({
  status,
  className,
}: {
  status: Item['status'];
  className?: string;
}) {
  const map: Record<Item['status'], string> = {
    raw: 'bg-amber-100 text-amber-900',
    processing: 'bg-sky-100 text-sky-900',
    ready: 'bg-emerald-100 text-emerald-900',
  };
  return (
    <span
      className={clsx(
        'rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide shadow-sm',
        map[status],
        className,
      )}
    >
      {status}
    </span>
  );
}
