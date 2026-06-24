export type ThemePref = 'light' | 'dark' | 'system';

const KEY = 'klzt.settings.theme';

export function getThemePref(): ThemePref {
  if (typeof window === 'undefined') return 'system';
  const v = window.localStorage.getItem(KEY);
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
}

export function setThemePref(pref: ThemePref): void {
  window.localStorage.setItem(KEY, pref);
  applyTheme(pref);
}

export function applyTheme(pref: ThemePref = getThemePref()): void {
  if (typeof document === 'undefined') return;
  const sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = pref === 'dark' || (pref === 'system' && sysDark);
  document.documentElement.classList.toggle('dark', dark);
}

let watcher: MediaQueryList | null = null;
export function watchSystemTheme(): () => void {
  if (typeof window === 'undefined') return () => {};
  watcher = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => {
    if (getThemePref() === 'system') applyTheme('system');
  };
  watcher.addEventListener('change', onChange);
  return () => watcher?.removeEventListener('change', onChange);
}
