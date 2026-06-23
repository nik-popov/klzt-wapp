import { Hono } from 'hono';
import type { Env } from '../types';
import { rowToItem } from '../types';
import { listItems, reorderItems } from '../db/queries';
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

export default items;
