import { Hono } from 'hono';
import type { Env } from '../types';
import { rowToItem } from '../types';
import { deleteItem, getItem, listItems, reorderItems } from '../db/queries';
import { keyFromUrl } from '../lib/storage';
import type {
  ListItemsResponse,
  ReorderRequest,
  ReorderResponse,
} from '@shared/types';

const items = new Hono<{ Bindings: Env }>();

/** GET /api/items — all items, ordered by sort_order ASC. */
items.get('/', async (c) => {
  const rows = await listItems(c.env);
  const body: ListItemsResponse = { items: rows.map(rowToItem) };
  return c.json(body);
});

/**
 * PUT /api/items/reorder
 * Body: { ids: string[] } in the new desired order.
 * Runs a single DB.batch transaction.
 */
items.put('/reorder', async (c) => {
  let payload: ReorderRequest;
  try {
    payload = (await c.req.json()) as ReorderRequest;
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!payload || !Array.isArray(payload.ids)) {
    return c.json({ error: 'Body must be { ids: string[] }' }, 400);
  }
  if (payload.ids.some((id) => typeof id !== 'string' || id.length === 0)) {
    return c.json({ error: 'ids must be non-empty strings' }, 400);
  }

  try {
    const count = await reorderItems(c.env, payload.ids);
    const body: ReorderResponse = { ok: true, count };
    return c.json(body);
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : 'Reorder failed' },
      400,
    );
  }
});

/**
 * DELETE /api/items/:id
 * Removes the row from D1 and deletes any matching R2 objects (raw and
 * processed). External-URL items (e.g. demo placehold rows) skip R2
 * cleanup automatically since keyFromUrl returns null for them.
 */
items.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const row = await getItem(c.env, id);
  if (!row) return c.json({ error: 'Item not found' }, 404);

  const keys = [
    keyFromUrl(c.env, row.raw_image_url),
    keyFromUrl(c.env, row.processed_image_url),
  ].filter((k): k is string => Boolean(k));

  if (keys.length > 0) {
    // R2Bucket.delete accepts a single key or an array (up to 1000).
    await c.env.BUCKET.delete(keys);
  }

  const removed = await deleteItem(c.env, id);
  if (!removed) return c.json({ error: 'Item not found' }, 404);

  return c.json({ ok: true, id, item: rowToItem(row) });
});

export default items;
