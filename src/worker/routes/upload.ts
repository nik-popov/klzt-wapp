import { Hono } from 'hono';
import type { Env } from '../types';
import { rowToItem } from '../types';
import { getNextSortOrder, insertItem } from '../db/queries';
import {
  ALLOWED_MIME,
  MAX_UPLOAD_BYTES,
  extFromMime,
  publicUrlForKey,
  rawKey,
} from '../lib/storage';
import type { UploadResponse } from '@shared/types';

const upload = new Hono<{ Bindings: Env }>();

/**
 * POST /api/upload
 *
 * Multipart form upload. Accepts one or many `file` parts (or `files`).
 * Each file is streamed into R2 under raw/items/<uuid>.<ext> and a row
 * is inserted with status='raw' and an incremented sort_order.
 *
 * Returns { items: Item[] }.
 */
upload.post('/', async (c) => {
  const contentType = c.req.header('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    return c.json({ error: 'Expected multipart/form-data' }, 415);
  }

  const form = await c.req.formData();
  const parts: File[] = [];
  const collect = (values: Array<string | File>) => {
    for (const v of values) {
      if (typeof v !== 'string') parts.push(v);
    }
  };
  collect(form.getAll('file') as Array<string | File>);
  collect(form.getAll('files') as Array<string | File>);

  if (parts.length === 0) {
    return c.json({ error: 'No files provided' }, 400);
  }

  // Reserve a contiguous run of sort_order values up front so concurrent
  // uploads in the same request don't collide.
  let nextSort = await getNextSortOrder(c.env);
  const created = [];

  for (const file of parts) {
    if (!ALLOWED_MIME.has(file.type)) {
      return c.json({ error: `Unsupported mime type: ${file.type}` }, 415);
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return c.json(
        { error: `File too large (${file.size} > ${MAX_UPLOAD_BYTES})` },
        413,
      );
    }

    const id = crypto.randomUUID();
    const ext = extFromMime(file.type);
    const key = rawKey(id, ext);

    await c.env.BUCKET.put(key, file.stream(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { itemId: id, original: file.name },
    });

    const row = await insertItem(c.env, {
      id,
      sort_order: nextSort++,
      raw_image_url: publicUrlForKey(c.env, key),
      status: 'raw',
    });
    created.push(rowToItem(row));
  }

  const body: UploadResponse = { items: created };
  return c.json(body, 201);
});

export default upload;
