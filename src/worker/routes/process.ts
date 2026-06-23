import { Hono } from 'hono';
import type { Env, ItemRow } from '../types';
import { rowToItem } from '../types';
import {
  getItem,
  updateItemProcessed,
  updateItemStatus,
} from '../db/queries';
import {
  keyFromUrl,
  processedKey,
  publicUrlForKey,
} from '../lib/storage';
import type { ProcessResponse } from '@shared/types';

const process = new Hono<{ Bindings: Env }>();

/** User-provided prompt that produces clean product photos in manual testing. */
const MAGIC_FIX_PROMPT =
  'Make this a clean product photo with a plain white background. ' +
  'Keep the garment realistic and accurate to the original photo. ' +
  'Centered composition, soft even lighting, sharp focus, true colors, ' +
  'e-commerce catalog style.';

const DEFAULT_MODEL = 'gemini-2.5-flash-image';

/**
 * POST /api/items/:id/process
 *
 * "Magic Fix" pipeline:
 *   1. Load raw source bytes (from R2 if our key, else fetch the URL).
 *   2. Call Gemini 2.5 Flash Image ("Nano Banana") with the bytes +
 *      MAGIC_FIX_PROMPT. Falls back to a byte copy if GEMINI_API_KEY
 *      is unset or the call fails — so the demo path still works.
 *   3. Write processed/items/<id>.<ext> to R2 and flip status to 'ready'.
 *
 * Re-runnable on items already in 'ready' (overwrites processed).
 */
process.post('/:id/process', async (c) => {
  const id = c.req.param('id');
  const row = await getItem(c.env, id);
  if (!row) return c.json({ error: 'Item not found' }, 404);

  const prevStatus = row.status;
  await updateItemStatus(c.env, id, 'processing');

  let srcBytes: Uint8Array;
  let srcMime: string;
  try {
    const loaded = await loadSourceBytes(c.env, row);
    srcBytes = loaded.bytes;
    srcMime = loaded.mime;
  } catch (err) {
    await updateItemStatus(c.env, id, prevStatus);
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

  const outExt = extFromMime(outMime);
  const destKey = processedKey(id, outExt);
  await c.env.BUCKET.put(destKey, outBytes, {
    httpMetadata: { contentType: outMime },
    customMetadata: { itemId: id, processedBy },
  });

  // Cache-bust: same R2 key on re-fix would return the same URL and the
  // browser would serve the stale processed image. A ?v=<ts> query is
  // ignored by R2 and the Worker proxy but breaks the browser cache.
  const versionedUrl = `${publicUrlForKey(c.env, destKey)}?v=${Date.now()}`;
  const updated = await updateItemProcessed(
    c.env,
    id,
    versionedUrl,
    'ready',
  );
  if (!updated) return c.json({ error: 'Item disappeared mid-process' }, 500);

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
 * placehold.co URLs can still be re-fixed. Returns bytes + sniffed
 * MIME so we can hand Gemini the right content type.
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

  const model = env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
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

  const json = (await res.json()) as GeminiResponse;
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
interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
}

function normalizeMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m === 'image/jpg') return 'image/jpeg';
  return m;
}

function extFromMime(mime: string): string {
  switch (normalizeMime(mime)) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/jpeg':
      return 'jpg';
    default:
      return 'png';
  }
}

/** First-bytes sniffing for the formats Gemini accepts. */
function sniffMime(bytes: Uint8Array): string {
  if (bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 &&
      bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes.length >= 3 &&
      bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 12 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 &&
      bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
  return 'image/jpeg';
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(s);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export default process;
