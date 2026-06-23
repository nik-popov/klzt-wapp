import { useRef, useState } from 'react';
import clsx from 'clsx';
import { getAuthToken, setAuthToken } from '../api/client';

export type SortMode = 'custom' | 'newest' | 'status';

interface ControlBarProps {
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
  onUpload: (files: FileList) => void;
  isUploading: boolean;
  progress: { done: number; total: number };
}

export function ControlBar({
  sortMode,
  onSortChange,
  onUpload,
  isUploading,
  progress,
}: ControlBarProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tokenDraft, setTokenDraft] = useState(getAuthToken());

  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200/70 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <h1 className="text-lg font-semibold tracking-tight">KLZT</h1>

        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs text-neutral-500" htmlFor="sort-select">
            Sort
          </label>
          <select
            id="sort-select"
            value={sortMode}
            onChange={(e) => onSortChange(e.target.value as SortMode)}
            className="rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
          >
            <option value="custom">Custom</option>
            <option value="newest">Newest</option>
            <option value="status">Status</option>
          </select>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                onUpload(e.target.files);
                e.target.value = '';
              }
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={isUploading}
            className={clsx(
              'rounded-md px-3 py-1.5 text-sm font-medium shadow-sm transition',
              isUploading
                ? 'cursor-not-allowed bg-neutral-200 text-neutral-500'
                : 'bg-neutral-900 text-white hover:bg-neutral-800',
            )}
          >
            {isUploading
              ? `Uploading ${progress.done}/${progress.total}…`
              : 'Upload'}
          </button>

          <button
            type="button"
            aria-label="Settings"
            onClick={() => setSettingsOpen((v) => !v)}
            className="rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-sm shadow-sm hover:bg-neutral-50"
          >
            ⚙
          </button>
        </div>
      </div>

      {settingsOpen && (
        <div className="border-t border-neutral-200/70 bg-neutral-50/80">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
            <label
              htmlFor="auth-token"
              className="text-xs font-medium text-neutral-600"
            >
              API token
            </label>
            <input
              id="auth-token"
              type="password"
              value={tokenDraft}
              onChange={(e) => setTokenDraft(e.target.value)}
              placeholder="Leave empty in dev"
              className="min-w-[16rem] flex-1 rounded-md border border-neutral-200 px-2 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
            />
            <button
              type="button"
              onClick={() => {
                setAuthToken(tokenDraft);
                setSettingsOpen(false);
              }}
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
