import { Hono } from 'hono';
import type { Env, ItemRow, Variables } from '../types';
import { rowToItem } from '../types';
import {
  getItem,
  updateItemMetadata,
  updateItemProcessed,
  updateItemStatus,
} from '../db/queries';
import {
  keyFromUrl,
  processedKey,
  publicUrlForKey,
} from '../lib/storage';
import {
  DEFAULT_IMAGE_MODEL,
  analyzeImage,
  base64ToBytes,
  bytesToBase64,
  imageExtFromMime,
  normalizeMime,
  sniffMime,
} from '../lib/gemini';
import type { ProcessResponse } from '@shared/types';

const process = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * Flat-lay product-photo prompt. Targets ZARA / Aritzia / Net-a-Porter
 * style catalog shots: garment arranged flat on a near-white surface,
 * top-down framing, soft natural shadow. Explicitly forbids models,
 * mannequins, hangers and props so the result reads as a real product
 * photo rather than a background-erased snapshot.
 */
const MAGIC_FIX_PROMPT = [
  'Recreate this garment as a premium flat-lay product photo for an',
  'e-commerce catalog (think ZARA, Aritzia, Net-a-Porter).',
  '',
  'Composition:',
  '- Top-down camera angle, garment laid flat and centered.',
  '- Arrange the fabric to show the full silhouette: sleeves spread,',
  '  collar/neckline visible, hem straight, any hardware (buttons, zips)',
  '  legible.',
  '- Add a soft, realistic natural shadow under the fabric for depth.',
  '',
  'Background and lighting:',
  '- Pale, almost-white neutral surface (subtle warm or cool gray, no',
  '  pure #FFFFFF). No props, no hangers, no model, no mannequin.',
  '- Soft, even, diffused studio lighting. Sharp focus throughout.',
  '',
  'Fidelity rules (most important):',
  '- Keep colors, prints, fabric texture, stitching and proportions',
  '  exactly as in the original photo.',
  '- Do not invent new details, do not restyle the garment, do not crop',
  '  out any part of it.',
  '- If the original is wrinkled, gently smooth it; do not iron away',
  '  intentional structure (pleats, drape, distressing).',
].join('\n');

/**
 * POST /api/items/:id/process
 *
 * "Magic Fix" pipeline:
 *   1. Load raw source bytes (from R2 if our key, else fetch the URL).
 *   2. Call Gemini 2.5 Flash Image ("Nano Banana") with the bytes +
 *      MAGIC_FIX_PROMPT. Falls back to a byte copy if GEMINI_API_KEY
 *      is unset or the call fails — so the demo path still works.
 *   3. Write processed/items/<id>.<ext> to R2 and flip status to 'ready'.
 *   4. Re-analyze the processed image to refresh title/tags/attrs.
 */
process.post('/:id/process', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const row = await getItem(c.env, id, user.id);
  if (!row) return c.json({ error: 'Item not found' }, 404);

  const prevStatus = row.status;
  await updateItemStatus(c.env, id, user.id, 'processing');

  let srcBytes: Uint8Array;
  let srcMime: string;
  try {
    const loaded = await loadSourceBytes(c.env, row);
    srcBytes = loaded.bytes;
    srcMime = loaded.mime;
  } catch (err) {
    await updateItemStatus(c.env, id, user.id, prevStatus);
    return c.json(
      { error: err instanceof Error ? err.message : 'Failed to load raw image' },
      500,
    );
  }

  let outBytes: Uint8Array = srcBytes;
  let outMime = srcMime;
  let processedBy: 'gemini' | 'fallback' = 'fallback';
  let lastError: string | null = null;
  try {
    const result = await runMagicFix(c.env, srcBytes, srcMime);
    outBytes = result.bytes;
    outMime = result.mime;
    processedBy = 'gemini';
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    console.warn('Gemini Magic Fix failed, falling back to byte copy:', lastError);
  }

  const outExt = imageExtFromMime(outMime);
  const destKey = processedKey(user.id, id, outExt);
  await c.env.BUCKET.put(destKey, outBytes, {
    httpMetadata: { contentType: outMime },
    customMetadata: { itemId: id, userId: user.id, processedBy },
  });

  // Cache-bust: same R2 key on re-fix would return the same URL and the
  // browser would serve the stale processed image. A ?v=<ts> query is
  // ignored by R2 and the Worker proxy but breaks the browser cache.
  const versionedUrl = `${publicUrlForKey(c.env, destKey)}?v=${Date.now()}`;
  let updated = await updateItemProcessed(
    c.env,
    id,
    user.id,
    versionedUrl,
    'ready',
  );
  if (!updated) return c.json({ error: 'Item disappeared mid-process' }, 500);

  // Re-analyze using the cleaner processed image. Best-effort — failures
  // here don't block the response since the fix itself already succeeded.
  try {
    const meta = await analyzeImage(c.env, outBytes, outMime);
    if (meta && Object.keys(meta).length > 0) {
      const reanalyzed = await updateItemMetadata(c.env, id, user.id, meta);
      if (reanalyzed) updated = reanalyzed;
    }
  } catch (err) {
    console.warn('Gemini re-analyze failed:', err);
  }

  const body: ProcessResponse = {
    item: rowToItem(updated),
    processedBy,
    warning: lastError ?? undefined,
  };
  return c.json(body);
});

/**
 * Pull raw bytes for processing. If raw_image_url points at our R2
 * (Worker proxy or public custom domain), read from the bucket;
 * otherwise fetch the external URL so seeded demo rows with
 * placehold.co URLs can still be re-fixed.
 */
async function loadSourceBytes(
  env: Env,
  row: ItemRow,
): Promise<{ bytes: Uint8Array; mime: string }> {
  const key = keyFromUrl(env, row.raw_image_url);
  if (key) {
    const obj = await env.BUCKET.get(key);
    if (obj) {
      const bytes = new Uint8Array(await obj.arrayBuffer());
      const mime = obj.httpMetadata?.contentType ?? sniffMime(bytes);
      return { bytes, mime };
    }
  }
  if (/^https?:\/\//i.test(row.raw_image_url)) {
    const res = await fetch(row.raw_image_url);
    if (!res.ok) throw new Error(`Failed to fetch raw URL: HTTP ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const mime = res.headers.get('content-type')?.split(';')[0]?.trim() ||
      sniffMime(bytes);
    return { bytes, mime };
  }
  throw new Error(`Cannot load raw bytes for ${row.id}`);
}

/**
 * Call Gemini 2.5 Flash Image with the raw image + edit prompt.
 * Throws when the key is missing or the response contains no image
 * part — the caller falls back to a byte copy.
 */
async function runMagicFix(
  env: Env,
  srcBytes: Uint8Array,
  srcMime: string,
): Promise<{ bytes: Uint8Array; mime: string }> {
  const key = env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error('GEMINI_API_KEY not set');

  const model = env.GEMINI_MODEL?.trim() || DEFAULT_IMAGE_MODEL;
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(model)}:generateContent`;

  const body = {
    contents: [
      {
        parts: [
          { text: MAGIC_FIX_PROMPT },
          {
            inlineData: {
              mimeType: normalizeMime(srcMime),
              data: bytesToBase64(srcBytes),
            },
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ['IMAGE', 'TEXT'],
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': key,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Gemini HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as GeminiImageResponse;
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    const inline = p.inlineData ?? p.inline_data;
    if (inline?.data) {
      return {
        bytes: base64ToBytes(inline.data),
        mime: inline.mimeType ?? inline.mime_type ?? 'image/png',
      };
    }
  }
  throw new Error('Gemini response contained no image part');
}

interface GeminiInlineData {
  data?: string;
  mimeType?: string;
  mime_type?: string;
}
interface GeminiPart {
  text?: string;
  inlineData?: GeminiInlineData;
  inline_data?: GeminiInlineData;
}
interface GeminiImageResponse {
  candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
}

export default process;
