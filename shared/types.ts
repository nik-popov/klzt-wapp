// Shared DTOs used by both the Worker (Hono) and the React SPA.

export type ItemStatus = 'raw' | 'processing' | 'ready';

/**
 * V2 attribute bag. Stored as JSON in items.metadata. Every field is
 * optional so it can grow without migrations. Promote a field to its
 * own column once you need to query/index by it.
 */
export interface ItemMetadata {
  brand?: string;
  color?: string;
  pattern?: string;
  material?: string;
  item_type?: string;
  fit?: string;
  occasion?: string;
  size?: string;
  tag?: string;
  season?: string;
  notes?: string;
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
}

export interface ApiErrorBody {
  error: string;
  details?: unknown;
}
