import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { rowToItem } from '../types';
import {
  deleteItem,
  getItem,
  listItems,
  reorderItems,
  updateItemMetadata,
} from '../db/queries';
import { keyFromUrl } from '../lib/storage';
import type {
  ListItemsResponse,
  PatchItemRequest,
  PatchItemResponse,
  ReorderRequest,
  ReorderResponse,
} from '@shared/types';

const items = new Hono<{ Bindings: Env; Variables: Variables }>();

/** GET /api/items — all of the current user's items, sort_order ASC. */
items.get('/', async (c) => {
  const user = c.get('user');
  const rows = await listItems(c.env, user.id);
  const body: ListItemsResponse = { items: rows.map(rowToItem) };
  return c.json(body);
});

/**
 * PUT /api/items/reorder
 * Body: { ids: string[] } in the new desired order.
 */
items.put('/reorder', async (c) => {
  const user = c.get('user');
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
    const count = await reorderItems(c.env, user.id, payload.ids);
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
 * PATCH /api/items/:id
 * Body: { metadata: Partial<ItemMetadata> }
 *
 * Shallow-merges the patch into the existing metadata JSON. Used for
 * inline rename, rotation, and (in later phases) field/tag edits.
 */
items.patch('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const row = await getItem(c.env, id, user.id);
  if (!row) return c.json({ error: 'Item not found' }, 404);

  let payload: PatchItemRequest;
  try {
    payload = (await c.req.json()) as PatchItemRequest;
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }
  if (
    !payload ||
    typeof payload.metadata !== 'object' ||
    payload.metadata === null ||
    Array.isArray(payload.metadata)
  ) {
    return c.json({ error: 'Body must be { metadata: object }' }, 400);
  }

  const updated = await updateItemMetadata(
    c.env,
    id,
    user.id,
    payload.metadata as Record<string, unknown>,
  );
  if (!updated) return c.json({ error: 'Item not found' }, 404);

  const body: PatchItemResponse = { item: rowToItem(updated) };
  return c.json(body);
});

/**
 * DELETE /api/items/:id
 * Removes the row from D1 and deletes any matching R2 objects (raw and
 * processed). External-URL items (e.g. demo placehold rows) skip R2
 * cleanup automatically since keyFromUrl returns null for them.
 */
items.delete('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const row = await getItem(c.env, id, user.id);
  if (!row) return c.json({ error: 'Item not found' }, 404);

  const keys = [
    keyFromUrl(c.env, row.raw_image_url),
    keyFromUrl(c.env, row.processed_image_url),
  ].filter((k): k is string => Boolean(k));

  if (keys.length > 0) {
    await c.env.BUCKET.delete(keys);
  }

  const removed = await deleteItem(c.env, id, user.id);
  if (!removed) return c.json({ error: 'Item not found' }, 404);

  return c.json({ ok: true, id, item: rowToItem(row) });
});

export default items;
