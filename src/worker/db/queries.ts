import type { Env, ItemRow } from '../types';
import type { ItemStatus } from '@shared/types';

export async function listItems(env: Env): Promise<ItemRow[]> {
  const result = await env.DB.prepare(
    `SELECT id, created_at, sort_order, raw_image_url, processed_image_url, status, metadata
     FROM items
     ORDER BY sort_order ASC`,
  ).all<ItemRow>();
  return result.results ?? [];
}

export async function getItem(env: Env, id: string): Promise<ItemRow | null> {
  const row = await env.DB.prepare(
    `SELECT id, created_at, sort_order, raw_image_url, processed_image_url, status, metadata
     FROM items
     WHERE id = ?`,
  )
    .bind(id)
    .first<ItemRow>();
  return row ?? null;
}

export async function getNextSortOrder(env: Env): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM items`,
  ).first<{ max_order: number }>();
  return (row?.max_order ?? -1) + 1;
}

export async function insertItem(
  env: Env,
  params: {
    id: string;
    sort_order: number;
    raw_image_url: string;
    status?: ItemStatus;
    metadata?: Record<string, unknown> | null;
  },
): Promise<ItemRow> {
  const status: ItemStatus = params.status ?? 'raw';
  const metadata = params.metadata ? JSON.stringify(params.metadata) : null;
  await env.DB.prepare(
    `INSERT INTO items (id, sort_order, raw_image_url, status, metadata)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(params.id, params.sort_order, params.raw_image_url, status, metadata)
    .run();
  const row = await getItem(env, params.id);
  if (!row) throw new Error('Insert succeeded but row not found');
  return row;
}

export async function updateItemProcessed(
  env: Env,
  id: string,
  processed_image_url: string,
  status: ItemStatus,
): Promise<ItemRow | null> {
  await env.DB.prepare(
    `UPDATE items SET processed_image_url = ?, status = ? WHERE id = ?`,
  )
    .bind(processed_image_url, status, id)
    .run();
  return getItem(env, id);
}

export async function updateItemStatus(
  env: Env,
  id: string,
  status: ItemStatus,
): Promise<void> {
  await env.DB.prepare(`UPDATE items SET status = ? WHERE id = ?`)
    .bind(status, id)
    .run();
}

/**
 * Merge a partial metadata patch into the existing JSON blob. Pass
 * `replace: true` to overwrite entirely (used when re-analyzing).
 * Returns the latest row.
 */
export async function updateItemMetadata(
  env: Env,
  id: string,
  patch: Record<string, unknown>,
  opts: { replace?: boolean } = {},
): Promise<ItemRow | null> {
  const current = await getItem(env, id);
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
  await env.DB.prepare(`UPDATE items SET metadata = ? WHERE id = ?`)
    .bind(json, id)
    .run();
  return getItem(env, id);
}

export async function deleteItem(env: Env, id: string): Promise<boolean> {
  const result = await env.DB.prepare(`DELETE FROM items WHERE id = ?`)
    .bind(id)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

/**
 * Rewrite sort_order for the given ids in a single D1 batch transaction.
 * Position in the array = new sort_order.
 *
 * Validates that the ids set matches the table exactly so a partial
 * reorder can't desync the gallery.
 */
export async function reorderItems(env: Env, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;

  // Cheap integrity check: every id must exist and no ids missing.
  const existing = await env.DB.prepare(`SELECT id FROM items`).all<{ id: string }>();
  const existingIds = new Set((existing.results ?? []).map((r) => r.id));
  if (existingIds.size !== ids.length) {
    throw new Error(
      `Reorder length mismatch: payload has ${ids.length}, table has ${existingIds.size}`,
    );
  }
  for (const id of ids) {
    if (!existingIds.has(id)) throw new Error(`Unknown item id: ${id}`);
  }

  const stmt = env.DB.prepare(`UPDATE items SET sort_order = ? WHERE id = ?`);
  const statements = ids.map((id, index) => stmt.bind(index, id));
  await env.DB.batch(statements);
  return ids.length;
}
