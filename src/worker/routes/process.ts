import { Hono } from 'hono';
import type { Env } from '../types';
import { rowToItem } from '../types';
import {
  getItem,
  updateItemProcessed,
  updateItemStatus,
} from '../db/queries';
import { processedKey, publicUrlForKey } from '../lib/storage';
import type { ProcessResponse } from '@shared/types';

const process = new Hono<{ Bindings: Env }>();

/**
 * POST /api/items/:id/process
 *
 * Mocked "Magic Fix": copy raw → processed in R2, mark status=ready.
 * Real implementation will eventually do background removal, square
 * cropping, lighting normalization, etc.
 */
process.post('/:id/process', async (c) => {
  const id = c.req.param('id');
  const row = await getItem(c.env, id);
  if (!row) return c.json({ error: 'Item not found' }, 404);

  await updateItemStatus(c.env, id, 'processing');

  // Locate the raw object. The raw key encodes the extension; we derive
  // it from raw_image_url's tail, falling back to 'jpg'.
  const rawTail = row.raw_image_url.split('/').pop() ?? `${id}.jpg`;
  const ext = rawTail.includes('.') ? rawTail.split('.').pop()! : 'jpg';
  const srcKey = `raw/items/${id}.${ext}`;
  const destKey = processedKey(id, ext);

  const src = await c.env.BUCKET.get(srcKey);
  if (!src) {
    await updateItemStatus(c.env, id, 'raw');
    return c.json({ error: `Raw object missing at ${srcKey}` }, 500);
  }

  // Mock pass-through: same bytes, same content-type. Swap for real
  // image transform pipeline later.
  await c.env.BUCKET.put(destKey, src.body, {
    httpMetadata: src.httpMetadata,
    customMetadata: { ...(src.customMetadata ?? {}), processed: 'mock' },
  });

  const updated = await updateItemProcessed(
    c.env,
    id,
    publicUrlForKey(c.env, destKey),
    'ready',
  );
  if (!updated) return c.json({ error: 'Item disappeared mid-process' }, 500);

  const body: ProcessResponse = { item: rowToItem(updated) };
  return c.json(body);
});

export default process;
