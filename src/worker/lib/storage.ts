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

export function rawKey(id: string, ext: string): string {
  return `raw/items/${id}.${ext}`;
}

export function processedKey(id: string, ext: string): string {
  return `processed/items/${id}.${ext}`;
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
