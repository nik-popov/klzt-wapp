import type { Item, ItemMetadata, ItemStatus } from '@shared/types';

export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  ASSETS: Fetcher;
  APP_ENV: string;
  AUTH_TOKEN?: string;
  R2_PUBLIC_BASE_URL?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
}

/** Raw row shape as returned by D1. metadata is a JSON string or null. */
export interface ItemRow {
  id: string;
  created_at: number;
  sort_order: number;
  raw_image_url: string;
  processed_image_url: string | null;
  status: ItemStatus;
  metadata: string | null;
}

export function rowToItem(row: ItemRow): Item {
  let metadata: ItemMetadata | null = null;
  if (row.metadata) {
    try {
      metadata = JSON.parse(row.metadata) as ItemMetadata;
    } catch {
      metadata = null;
    }
  }
  return {
    id: row.id,
    created_at: row.created_at,
    sort_order: row.sort_order,
    raw_image_url: row.raw_image_url,
    processed_image_url: row.processed_image_url,
    status: row.status,
    metadata,
  };
}
