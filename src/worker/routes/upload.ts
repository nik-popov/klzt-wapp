import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { rowToItem } from '../types';
import { getNextSortOrder, insertItem } from '../db/queries';
import {
  ALLOWED_MIME,
  MAX_UPLOAD_BYTES,
  extFromMime,
  publicUrlForKey,
  rawKey,
} from '../lib/storage';
import { analyzeImage } from '../lib/gemini';
import type { UploadResponse } from '@shared/types';

const upload = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * POST /api/upload
 *
 * Multipart form upload. Accepts one or many `file` parts (or `files`).
 * For each file we:
 *   1. Read bytes once (so we can both store to R2 and feed Gemini).
 *   2. In parallel: write users/<uid>/raw/items/<uuid>.<ext> to R2 +
 *      analyze with Gemini Flash to extract title/tags/attrs.
 *   3. Insert the row with status='raw', stamped with user_id/closet_id.
 *
 * Auto-analysis is best-effort: a Gemini failure just means the item
 * gets created without metadata (still uploads, still displays).
 */
upload.post('/', async (c) => {
  const user = c.get('user');
  const closetId = c.get('closetId');

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
  }

  let nextSort = await getNextSortOrder(c.env, user.id);

  const created = await Promise.all(
    parts.map(async (file) => {
      const id = crypto.randomUUID();
      const ext = extFromMime(file.type);
      const key = rawKey(user.id, id, ext);
      const sort_order = nextSort++;

      const bytes = new Uint8Array(await file.arrayBuffer());

      const [, meta] = await Promise.all([
        c.env.BUCKET.put(key, bytes, {
          httpMetadata: { contentType: file.type },
          customMetadata: { itemId: id, original: file.name, userId: user.id },
        }),
        analyzeImage(c.env, bytes, file.type).catch((err) => {
          console.warn(`Gemini analyze failed for ${file.name}:`, err);
          return null;
        }),
      ]);

      const row = await insertItem(c.env, {
        id,
        sort_order,
        raw_image_url: publicUrlForKey(c.env, key),
        user_id: user.id,
        closet_id: closetId,
        status: 'raw',
        metadata: meta && Object.keys(meta).length > 0 ? meta : null,
      });
      return rowToItem(row);
    }),
  );

  const body: UploadResponse = { items: created };
  return c.json(body, 201);
});

export default upload;

