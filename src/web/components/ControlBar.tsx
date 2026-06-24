import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { getThemePref, setThemePref, type ThemePref } from '../lib/theme';

export type SortMode = 'custom' | 'newest' | 'status';

const SETTINGS_KEYS = {
  taxonomy: 'klzt.settings.taxonomyMode', // 'general' | 'advanced'
  magicFix: 'klzt.settings.magicFixStyle', // 'flat-lay' for now
} as const;

type TaxonomyMode = 'general' | 'advanced';

function readSetting<T extends string>(key: string, fallback: T, allowed: T[]): T {
  if (typeof window === 'undefined') return fallback;
  const v = window.localStorage.getItem(key);
  return allowed.includes(v as T) ? (v as T) : fallback;
}

interface ControlBarProps {
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
  onUploadFromDevice: (files: FileList) => void;
  onTakePhoto: (files: FileList) => void;
  isUploading: boolean;
  uploadProgress: { done: number; total: number };
  rawCount: number;
  onProcessAll: () => void;
  isProcessingAll: boolean;
  processAllProgress: { done: number; total: number; failed: number };
}

export function ControlBar({
  sortMode,
  onSortChange,
  onUploadFromDevice,
  onTakePhoto,
  isUploading,
  uploadProgress,
  rawCount,
  onProcessAll,
  isProcessingAll,
  processAllProgress,
}: ControlBarProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statusInfoOpen, setStatusInfoOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const statusInfoRef = useRef<HTMLDivElement>(null);

  // Close popovers when clicking outside.
  useEffect(() => {
    if (!addMenuOpen && !statusInfoOpen) return;
    const onDown = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setAddMenuOpen(false);
      }
      if (
        statusInfoRef.current &&
        !statusInfoRef.current.contains(e.target as Node)
      ) {
        setStatusInfoOpen(false);
      }
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [addMenuOpen, statusInfoOpen]);

  const addLabel = isUploading
    ? `Uploading ${uploadProgress.done}/${uploadProgress.total}…`
    : '+ Add items';

  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200/70 bg-white/80 backdrop-blur dark:border-neutral-800/70 dark:bg-neutral-950/80">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <h1 className="text-lg font-semibold tracking-tight">KLZT</h1>

        <div className="ml-auto flex items-center gap-2">
          <label
            className="text-xs text-neutral-500 dark:text-neutral-400"
            htmlFor="sort-select"
          >
            View
          </label>
          <select
            id="sort-select"
            value={sortMode}
            onChange={(e) => onSortChange(e.target.value as SortMode)}
            className="rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:ring-white/20"
          >
            <option value="custom">All · Custom</option>
            <option value="newest">All · Newest</option>
            <option value="status">By status</option>
          </select>

          <div ref={statusInfoRef} className="relative">
            <button
              type="button"
              aria-label="What does status mean?"
              onClick={() => setStatusInfoOpen((v) => !v)}
              className="grid h-7 w-7 place-items-center rounded-full border border-neutral-200 bg-white text-neutral-600 shadow-sm hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              ?
            </button>
            {statusInfoOpen && (
              <div className="absolute right-0 top-9 z-30 w-72 rounded-lg border border-neutral-200 bg-white p-3 text-xs shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
                <p className="mb-2 font-semibold text-neutral-800 dark:text-neutral-100">
                  What does status mean?
                </p>
                <ul className="space-y-1.5 text-neutral-600 dark:text-neutral-300">
                  <li>
                    <span className="font-medium text-amber-700 dark:text-amber-300">
                      Original
                    </span>{' '}
                    — your raw upload. Run Magic Fix to clean it up.
                  </li>
                  <li>
                    <span className="font-medium text-sky-700 dark:text-sky-300">
                      Working magic
                    </span>{' '}
                    — AI is generating a catalog-style photo.
                  </li>
                  <li>
                    <span className="font-medium text-emerald-700 dark:text-emerald-300">
                      Ready
                    </span>{' '}
                    — flat-lay shot is done. You can re-fix anytime.
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* Magic Fix all raw — only shown when there's something to fix. */}
          {rawCount > 0 && (
            <button
              type="button"
              onClick={onProcessAll}
              disabled={isProcessingAll || isUploading}
              className={clsx(
                'rounded-md px-3 py-1.5 text-sm font-medium shadow-sm transition',
                isProcessingAll || isUploading
                  ? 'cursor-not-allowed bg-neutral-200 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-500'
                  : 'bg-amber-500 text-white hover:bg-amber-600',
              )}
            >
              {isProcessingAll
                ? `✨ ${processAllProgress.done}/${processAllProgress.total}…`
                : `✨ Magic Fix all raw (${rawCount})`}
            </button>
          )}

          {/* Hidden inputs — one for picker, one for camera capture. */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                onUploadFromDevice(e.target.files);
                e.target.value = '';
              }
            }}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                onTakePhoto(e.target.files);
                e.target.value = '';
              }
            }}
          />

          {/* + Add items menu */}
          <div ref={addMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setAddMenuOpen((v) => !v)}
              disabled={isUploading}
              className={clsx(
                'rounded-md px-3 py-1.5 text-sm font-medium shadow-sm transition',
                isUploading
                  ? 'cursor-not-allowed bg-neutral-200 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-500'
                  : 'bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200',
              )}
            >
              {addLabel}
            </button>
            {addMenuOpen && !isUploading && (
              <div className="absolute right-0 top-10 z-30 w-56 overflow-hidden rounded-lg border border-neutral-200 bg-white text-sm shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  onClick={() => {
                    setAddMenuOpen(false);
                    fileRef.current?.click();
                  }}
                >
                  <UploadIcon className="h-4 w-4" />
                  Upload from device
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 border-t border-neutral-100 px-3 py-2 text-left hover:bg-neutral-100 dark:border-neutral-800 dark:hover:bg-neutral-800"
                  onClick={() => {
                    setAddMenuOpen(false);
                    cameraRef.current?.click();
                  }}
                >
                  <CameraIcon className="h-4 w-4" />
                  Take a photo
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            aria-label="Settings"
            onClick={() => setSettingsOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-md border border-neutral-200 bg-white text-neutral-700 shadow-sm hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            <GearIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </header>
  );
}

/* -------------------------- Settings drawer -------------------------- */

interface DrawerProps {
  open: boolean;
  onClose: () => void;
}

function SettingsDrawer({ open, onClose }: DrawerProps) {
  const [theme, setTheme] = useState<ThemePref>(() => getThemePref());
  const [taxonomy, setTaxonomy] = useState<TaxonomyMode>(() =>
    readSetting(SETTINGS_KEYS.taxonomy, 'general', ['general', 'advanced']),
  );
  const [magicFix, setMagicFix] = useState(() =>
    readSetting(SETTINGS_KEYS.magicFix, 'flat-lay', ['flat-lay']),
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const updateTheme = (next: ThemePref) => {
    setTheme(next);
    setThemePref(next);
  };
  const updateTaxonomy = (next: TaxonomyMode) => {
    setTaxonomy(next);
    window.localStorage.setItem(SETTINGS_KEYS.taxonomy, next);
  };
  const updateMagicFix = (next: string) => {
    setMagicFix(next);
    window.localStorage.setItem(SETTINGS_KEYS.magicFix, next);
  };

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={clsx(
          'fixed inset-0 z-40 bg-black/40 transition-opacity',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />
      <aside
        role="dialog"
        aria-label="Settings"
        aria-modal="true"
        className={clsx(
          'fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col overflow-y-auto border-l border-neutral-200 bg-white shadow-2xl transition-transform duration-200 dark:border-neutral-800 dark:bg-neutral-950',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <h2 className="text-base font-semibold">Settings</h2>
          <button
            type="button"
            aria-label="Close settings"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            ✕
          </button>
        </header>

        <div className="flex flex-col gap-6 px-4 py-5 text-sm">
          <Section title="Account">
            <div className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-3 py-3 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
              <p className="font-medium">Sign in coming soon</p>
              <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                Google login lands in the next phase so each user has their own closet.
              </p>
            </div>
          </Section>

          <Section title="Default closet">
            <select
              disabled
              className="w-full cursor-not-allowed rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-sm text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400"
              defaultValue="my-closet"
            >
              <option value="my-closet">My closet</option>
            </select>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Multiple closets coming soon (home / dad's / dacha / etc.).
            </p>
          </Section>

          <Section title="Sort taxonomy mode">
            <RadioGroup
              name="taxonomy"
              value={taxonomy}
              onChange={(v) => updateTaxonomy(v as TaxonomyMode)}
              options={[
                {
                  value: 'general',
                  label: 'General',
                  hint: 'Tops, bottoms, accessories…',
                },
                {
                  value: 'advanced',
                  label: 'Advanced',
                  hint: 'Sweaters, turtlenecks, maxi dresses…',
                },
              ]}
            />
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Used when grouping items by category. Full grouping arrives in the next update.
            </p>
          </Section>

          <Section title="Magic Fix style">
            <select
              value={magicFix}
              onChange={(e) => updateMagicFix(e.target.value)}
              className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:ring-white/20"
            >
              <option value="flat-lay">Flat-lay on neutral background</option>
            </select>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              More presets (ghost mannequin, styled lay-down) coming soon.
            </p>
          </Section>

          <Section title="Theme">
            <RadioGroup
              name="theme"
              value={theme}
              onChange={(v) => updateTheme(v as ThemePref)}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
                { value: 'system', label: 'System' },
              ]}
            />
          </Section>
        </div>
      </aside>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {title}
      </h3>
      {children}
    </section>
  );
}

function RadioGroup({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string; hint?: string }>;
}) {
  return (
    <div className="flex flex-col gap-1">
      {options.map((o) => (
        <label
          key={o.value}
          className={clsx(
            'flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 transition',
            value === o.value
              ? 'border-neutral-900 bg-neutral-50 dark:border-white dark:bg-neutral-900'
              : 'border-neutral-200 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900',
          )}
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">{o.label}</span>
            {o.hint && (
              <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                {o.hint}
              </span>
            )}
          </span>
        </label>
      ))}
    </div>
  );
}

/* ---------------------------- Icons (inline) ---------------------------- */

function GearIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06A2 2 0 1 1 4.27 16.4l.06-.06A1.65 1.65 0 0 0 4.66 14.5a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1A1.65 1.65 0 0 0 4.27 6.68l-.06-.06A2 2 0 1 1 7.04 3.79l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
