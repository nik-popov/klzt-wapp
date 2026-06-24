import type { Env } from '../types';

/** Allowed image MIME types for uploads. */
export const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/avif',
  'image/gif',
]);

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB per file

export function extFromMime(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/heic':
      return 'heic';
    case 'image/heif':
      return 'heif';
    case 'image/avif':
      return 'avif';
    case 'image/gif':
      return 'gif';
    default:
      return 'bin';
  }
}

/**
 * R2 key for a user's raw upload. Pre-Phase-2 items live at the legacy
 * `raw/items/{id}.{ext}` path; new uploads land under `users/{userId}/`
 * so multi-tenant data stays naturally segregated.
 */
export function rawKey(userId: string, id: string, ext: string): string {
  return `users/${userId}/raw/items/${id}.${ext}`;
}

export function processedKey(userId: string, id: string, ext: string): string {
  return `users/${userId}/processed/items/${id}.${ext}`;
}

/**
 * Returns the public URL for an R2 object key. If R2_PUBLIC_BASE_URL is
 * configured (custom domain on the bucket), uses it directly. Otherwise
 * routes through the Worker proxy at /api/r2/<key>.
 */
export function publicUrlForKey(env: Env, key: string): string {
  const base = env.R2_PUBLIC_BASE_URL?.trim();
  if (base) return `${base.replace(/\/$/, '')}/${key}`;
  return `/api/r2/${key}`;
}

/**
 * Inverse of publicUrlForKey: best-effort extraction of an R2 key from a
 * stored URL. Returns null when the URL doesn't point at our bucket
 * (e.g. external placehold.co demo images) — caller should skip R2
 * cleanup in that case.
 */
export function keyFromUrl(env: Env, url: string | null | undefined): string | null {
  if (!url) return null;
  const clean = url.split('?')[0];
  if (clean.startsWith('/api/r2/')) {
    return decodeURIComponent(clean.slice('/api/r2/'.length));
  }
  const base = env.R2_PUBLIC_BASE_URL?.trim();
  if (base) {
    const prefix = base.replace(/\/$/, '') + '/';
    if (clean.startsWith(prefix)) return decodeURIComponent(clean.slice(prefix.length));
  }
  return null;
}

/**
 * Extract the item id encoded in an R2 key, if the key follows our
 * naming convention. Both legacy (`raw/items/{id}.{ext}`) and scoped
 * (`users/{uid}/raw/items/{id}.{ext}`) layouts are recognized so old
 * URLs keep resolving after Phase 2.
 */
export function itemIdFromKey(key: string): string | null {
  const match = key.match(
    /(?:^users\/[^/]+\/)?(?:raw|processed)\/items\/([^/.]+)\.[A-Za-z0-9]+$/,
  );
  return match ? match[1] : null;
}

/** True when the key lives under this user's namespace. */
export function keyBelongsToUser(key: string, userId: string): boolean {
  return key.startsWith(`users/${userId}/`);
}

