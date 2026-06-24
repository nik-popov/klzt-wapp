import type {
  ClosetRow,
  Env,
  ItemRow,
  SessionRow,
  UserRow,
} from '../types';
import type { ItemStatus } from '@shared/types';

/* ------------------------------- Items ------------------------------- */

const ITEM_COLS =
  'id, created_at, sort_order, raw_image_url, processed_image_url, status, metadata, user_id, closet_id';

export async function listItems(env: Env, userId: string): Promise<ItemRow[]> {
  const result = await env.DB.prepare(
    `SELECT ${ITEM_COLS}
     FROM items
     WHERE user_id = ?
     ORDER BY sort_order ASC`,
  )
    .bind(userId)
    .all<ItemRow>();
  return result.results ?? [];
}

export async function getItem(
  env: Env,
  id: string,
  userId: string,
): Promise<ItemRow | null> {
  const row = await env.DB.prepare(
    `SELECT ${ITEM_COLS} FROM items WHERE id = ? AND user_id = ?`,
  )
    .bind(id, userId)
    .first<ItemRow>();
  return row ?? null;
}

/** Lookup by id only, no ownership check. Used by internal storage paths. */
export async function getItemRaw(env: Env, id: string): Promise<ItemRow | null> {
  const row = await env.DB.prepare(`SELECT ${ITEM_COLS} FROM items WHERE id = ?`)
    .bind(id)
    .first<ItemRow>();
  return row ?? null;
}

export async function getNextSortOrder(env: Env, userId: string): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM items WHERE user_id = ?`,
  )
    .bind(userId)
    .first<{ max_order: number }>();
  return (row?.max_order ?? -1) + 1;
}

export async function insertItem(
  env: Env,
  params: {
    id: string;
    sort_order: number;
    raw_image_url: string;
    user_id: string;
    closet_id: string;
    status?: ItemStatus;
    metadata?: Record<string, unknown> | null;
  },
): Promise<ItemRow> {
  const status: ItemStatus = params.status ?? 'raw';
  const metadata = params.metadata ? JSON.stringify(params.metadata) : null;
  await env.DB.prepare(
    `INSERT INTO items (id, sort_order, raw_image_url, status, metadata, user_id, closet_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      params.id,
      params.sort_order,
      params.raw_image_url,
      status,
      metadata,
      params.user_id,
      params.closet_id,
    )
    .run();
  const row = await getItemRaw(env, params.id);
  if (!row) throw new Error('Insert succeeded but row not found');
  return row;
}

export async function updateItemProcessed(
  env: Env,
  id: string,
  userId: string,
  processed_image_url: string,
  status: ItemStatus,
): Promise<ItemRow | null> {
  await env.DB.prepare(
    `UPDATE items SET processed_image_url = ?, status = ?
     WHERE id = ? AND user_id = ?`,
  )
    .bind(processed_image_url, status, id, userId)
    .run();
  return getItem(env, id, userId);
}

export async function updateItemStatus(
  env: Env,
  id: string,
  userId: string,
  status: ItemStatus,
): Promise<void> {
  await env.DB.prepare(
    `UPDATE items SET status = ? WHERE id = ? AND user_id = ?`,
  )
    .bind(status, id, userId)
    .run();
}

/**
 * Merge a partial metadata patch into the existing JSON blob. Pass
 * `replace: true` to overwrite entirely (used when re-analyzing).
 */
export async function updateItemMetadata(
  env: Env,
  id: string,
  userId: string,
  patch: Record<string, unknown>,
  opts: { replace?: boolean } = {},
): Promise<ItemRow | null> {
  const current = await getItem(env, id, userId);
  if (!current) return null;
  let merged: Record<string, unknown>;
  if (opts.replace) {
    merged = { ...patch };
  } else {
    let existing: Record<string, unknown> = {};
    if (current.metadata) {
      try {
        existing = JSON.parse(current.metadata) as Record<string, unknown>;
      } catch {
        existing = {};
      }
    }
    merged = { ...existing, ...patch };
  }
  const json = Object.keys(merged).length > 0 ? JSON.stringify(merged) : null;
  await env.DB.prepare(
    `UPDATE items SET metadata = ? WHERE id = ? AND user_id = ?`,
  )
    .bind(json, id, userId)
    .run();
  return getItem(env, id, userId);
}

export async function deleteItem(
  env: Env,
  id: string,
  userId: string,
): Promise<boolean> {
  const result = await env.DB.prepare(
    `DELETE FROM items WHERE id = ? AND user_id = ?`,
  )
    .bind(id, userId)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

/**
 * Rewrite sort_order for the given ids in a single D1 batch transaction.
 * Position in the array = new sort_order. Ids must all belong to userId
 * and match the full set of that user's items.
 */
export async function reorderItems(
  env: Env,
  userId: string,
  ids: string[],
): Promise<number> {
  if (ids.length === 0) return 0;

  const existing = await env.DB.prepare(
    `SELECT id FROM items WHERE user_id = ?`,
  )
    .bind(userId)
    .all<{ id: string }>();
  const existingIds = new Set((existing.results ?? []).map((r) => r.id));
  if (existingIds.size !== ids.length) {
    throw new Error(
      `Reorder length mismatch: payload has ${ids.length}, your closet has ${existingIds.size}`,
    );
  }
  for (const id of ids) {
    if (!existingIds.has(id)) throw new Error(`Unknown item id: ${id}`);
  }

  const stmt = env.DB.prepare(
    `UPDATE items SET sort_order = ? WHERE id = ? AND user_id = ?`,
  );
  const statements = ids.map((id, index) => stmt.bind(index, id, userId));
  await env.DB.batch(statements);
  return ids.length;
}

/* ------------------------------- Users ------------------------------- */

const USER_COLS = 'id, google_sub, email, name, picture, created_at';

export async function getUserById(env: Env, id: string): Promise<UserRow | null> {
  const row = await env.DB.prepare(
    `SELECT ${USER_COLS} FROM users WHERE id = ?`,
  )
    .bind(id)
    .first<UserRow>();
  return row ?? null;
}

export async function getUserByGoogleSub(
  env: Env,
  sub: string,
): Promise<UserRow | null> {
  const row = await env.DB.prepare(
    `SELECT ${USER_COLS} FROM users WHERE google_sub = ?`,
  )
    .bind(sub)
    .first<UserRow>();
  return row ?? null;
}

export async function getUserByEmail(
  env: Env,
  email: string,
): Promise<UserRow | null> {
  const row = await env.DB.prepare(
    `SELECT ${USER_COLS} FROM users WHERE LOWER(email) = LOWER(?)`,
  )
    .bind(email)
    .first<UserRow>();
  return row ?? null;
}

export async function createUser(
  env: Env,
  params: {
    id: string;
    google_sub: string;
    email: string;
    name?: string | null;
    picture?: string | null;
  },
): Promise<UserRow> {
  await env.DB.prepare(
    `INSERT INTO users (id, google_sub, email, name, picture)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(
      params.id,
      params.google_sub,
      params.email,
      params.name ?? null,
      params.picture ?? null,
    )
    .run();
  const row = await getUserById(env, params.id);
  if (!row) throw new Error('User insert succeeded but row not found');
  return row;
}

export async function updateUserProfile(
  env: Env,
  id: string,
  patch: {
    email?: string;
    name?: string | null;
    picture?: string | null;
    google_sub?: string;
  },
): Promise<UserRow | null> {
  const current = await getUserById(env, id);
  if (!current) return null;
  await env.DB.prepare(
    `UPDATE users SET google_sub = ?, email = ?, name = ?, picture = ? WHERE id = ?`,
  )
    .bind(
      patch.google_sub ?? current.google_sub,
      patch.email ?? current.email,
      patch.name ?? current.name,
      patch.picture ?? current.picture,
      id,
    )
    .run();
  return getUserById(env, id);
}

/* ----------------------------- Sessions ----------------------------- */

export async function createSession(
  env: Env,
  params: { id: string; user_id: string; expires_at: number },
): Promise<SessionRow> {
  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`,
  )
    .bind(params.id, params.user_id, params.expires_at)
    .run();
  return { ...params, created_at: Math.floor(Date.now() / 1000) };
}

export async function getSessionWithUser(
  env: Env,
  id: string,
): Promise<{ session: SessionRow; user: UserRow } | null> {
  const row = await env.DB.prepare(
    `SELECT s.id AS s_id, s.user_id AS s_user_id, s.expires_at AS s_expires_at,
            s.created_at AS s_created_at,
            u.id AS u_id, u.google_sub AS u_google_sub, u.email AS u_email,
            u.name AS u_name, u.picture AS u_picture, u.created_at AS u_created_at
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ?`,
  )
    .bind(id)
    .first<Record<string, unknown>>();
  if (!row) return null;
  const expiresAt = Number(row.s_expires_at);
  if (expiresAt > 0 && expiresAt < Math.floor(Date.now() / 1000)) return null;
  return {
    session: {
      id: String(row.s_id),
      user_id: String(row.s_user_id),
      expires_at: expiresAt,
      created_at: Number(row.s_created_at),
    },
    user: {
      id: String(row.u_id),
      google_sub: String(row.u_google_sub),
      email: String(row.u_email),
      name: (row.u_name as string | null) ?? null,
      picture: (row.u_picture as string | null) ?? null,
      created_at: Number(row.u_created_at),
    },
  };
}

export async function deleteSession(env: Env, id: string): Promise<void> {
  await env.DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(id).run();
}

/* ------------------------------ Closets ----------------------------- */

const CLOSET_COLS = 'id, user_id, name, created_at';

export async function getDefaultClosetForUser(
  env: Env,
  userId: string,
): Promise<ClosetRow | null> {
  const row = await env.DB.prepare(
    `SELECT ${CLOSET_COLS} FROM closets WHERE user_id = ? ORDER BY created_at ASC LIMIT 1`,
  )
    .bind(userId)
    .first<ClosetRow>();
  return row ?? null;
}

export async function createClosetForUser(
  env: Env,
  params: { id: string; user_id: string; name?: string },
): Promise<ClosetRow> {
  await env.DB.prepare(
    `INSERT INTO closets (id, user_id, name) VALUES (?, ?, ?)`,
  )
    .bind(params.id, params.user_id, params.name ?? 'My closet')
    .run();
  const row = await env.DB.prepare(
    `SELECT ${CLOSET_COLS} FROM closets WHERE id = ?`,
  )
    .bind(params.id)
    .first<ClosetRow>();
  if (!row) throw new Error('Closet insert succeeded but row not found');
  return row;
}

/**
 * Get the user's default closet, creating one on the fly if missing.
 * The auth middleware calls this on every authenticated request and
 * stamps the id onto new items.
 */
export async function ensureDefaultCloset(
  env: Env,
  userId: string,
): Promise<ClosetRow> {
  const existing = await getDefaultClosetForUser(env, userId);
  if (existing) return existing;
  return createClosetForUser(env, {
    id: crypto.randomUUID(),
    user_id: userId,
    name: 'My closet',
  });
}
