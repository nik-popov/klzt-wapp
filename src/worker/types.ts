import type { Item, ItemMetadata, ItemStatus, User } from '@shared/types';

export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  ASSETS: Fetcher;
  APP_ENV: string;
  /** @deprecated Pre-Phase-2 shared bearer token. No longer enforced. */
  AUTH_TOKEN?: string;
  R2_PUBLIC_BASE_URL?: string;
  GEMINI_API_KEY?: string;
  /** Image-gen model for Magic Fix. Defaults to gemini-2.5-flash-image. */
  GEMINI_MODEL?: string;
  /** Vision/text model for auto-analysis. Defaults to gemini-2.5-flash. */
  GEMINI_TEXT_MODEL?: string;

  /* ---------- Phase 2: Google OAuth ---------- */
  /** OAuth 2.0 client id from Google Cloud Console. */
  GOOGLE_CLIENT_ID?: string;
  /** OAuth 2.0 client secret. Set via `wrangler secret put`. */
  GOOGLE_CLIENT_SECRET?: string;
  /** Optional explicit redirect URI; otherwise derived from request origin. */
  GOOGLE_REDIRECT_URI?: string;
  /** Session cookie lifetime in days. Defaults to 30. */
  SESSION_TTL_DAYS?: string;
  /**
   * Email that claims the bootstrap admin row on first login. Seed items
   * end up in that user's closet. Optional.
   */
  BOOTSTRAP_USER_EMAIL?: string;
  /**
   * Local-dev shortcut: when set, all /api/* requests run as this user
   * (created on demand), bypassing cookies entirely. Never set in prod.
   */
  DEV_USER_EMAIL?: string;
}

/** Hono context variables populated by the auth middleware. */
export interface Variables {
  user: User;
  closetId: string;
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
  user_id: string | null;
  closet_id: string | null;
}

export interface UserRow {
  id: string;
  google_sub: string;
  email: string;
  name: string | null;
  picture: string | null;
  created_at: number;
}

export interface SessionRow {
  id: string;
  user_id: string;
  expires_at: number;
  created_at: number;
}

export interface ClosetRow {
  id: string;
  user_id: string;
  name: string;
  created_at: number;
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

export function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    picture: row.picture,
  };
}
