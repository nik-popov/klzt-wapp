// Shared DTOs used by both the Worker (Hono) and the React SPA.

export type ItemStatus = 'raw' | 'processing' | 'ready';

/**
 * V2 attribute bag. Stored as JSON in items.metadata. Every field is
 * optional so it can grow without migrations. Promote a field to its
 * own column once you need to query/index by it.
 */
export interface ItemMetadata {
  /** Short, human-friendly name, e.g. "Navy denim jacket". 2-5 words. */
  title?: string;
  brand?: string;
  color?: string;
  pattern?: string;
  material?: string;
  item_type?: string;
  fit?: string;
  occasion?: string;
  size?: string;
  season?: string;
  /** Free-form descriptive tags surfaced as chips in the detail modal. */
  tags?: string[];
  notes?: string;
  /** Optional secondary photo (e.g. backside) for items shot from two angles. */
  back_image_url?: string;
  /** CSS-applied rotation in degrees. We don't re-encode the image. */
  rotation?: 0 | 90 | 180 | 270;
  [key: string]: unknown;
}

export interface Item {
  id: string;
  created_at: number;
  sort_order: number;
  raw_image_url: string;
  processed_image_url: string | null;
  status: ItemStatus;
  metadata: ItemMetadata | null;
}

export interface ListItemsResponse {
  items: Item[];
}

export interface UploadResponse {
  items: Item[];
}

export interface ReorderRequest {
  ids: string[];
}

export interface ReorderResponse {
  ok: true;
  count: number;
}

export interface ProcessResponse {
  item: Item;
  /** Which path produced the processed image. */
  processedBy?: 'gemini' | 'fallback';
  /** Populated when the Gemini call failed and we fell back. */
  warning?: string;
}

export interface DeleteResponse {
  ok: true;
  id: string;
  item: Item;
}

export interface PatchItemRequest {
  metadata: Partial<ItemMetadata>;
}

export interface PatchItemResponse {
  item: Item;
}

export interface ApiErrorBody {
  error: string;
  details?: unknown;
}
