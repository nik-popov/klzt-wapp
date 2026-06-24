import type { Env } from '../types';
import type { ItemMetadata } from '@shared/types';

/** Image-generation model used for Magic Fix. */
export const DEFAULT_IMAGE_MODEL = 'gemini-2.5-flash-image';
/** Vision/text model used for auto-analysis (title, item_type, tags...). */
export const DEFAULT_TEXT_MODEL = 'gemini-2.5-flash';

const ANALYZE_INSTRUCTIONS =
  'You are a wardrobe-cataloguing assistant. The photo shows a single ' +
  'clothing or accessory item. Return concise structured metadata as JSON. ' +
  'Title must be 2-5 words like "Navy denim jacket". For uncertain fields, ' +
  'omit them — do not guess. Tags should be 3-6 short descriptive keywords ' +
  '(style, vibe, season, occasion), lowercase, no leading hash.';

const ANALYZE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    item_type: { type: 'string' },
    color: { type: 'string' },
    material: { type: 'string' },
    pattern: { type: 'string' },
    brand: { type: 'string' },
    fit: { type: 'string' },
    occasion: { type: 'string' },
    season: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
  },
} as const;

/** Subset of ItemMetadata the analyzer is allowed to populate. */
export type AnalyzeResult = Pick<
  ItemMetadata,
  | 'title'
  | 'item_type'
  | 'color'
  | 'material'
  | 'pattern'
  | 'brand'
  | 'fit'
  | 'occasion'
  | 'season'
  | 'tags'
>;

/**
 * Call Gemini 2.5 Flash with the image bytes + a structured-output
 * schema. Returns null when GEMINI_API_KEY is unset or the response
 * isn't usable so callers can decide what to do (we treat it as a
 * non-fatal best-effort step).
 */
export async function analyzeImage(
  env: Env,
  bytes: Uint8Array,
  mime: string,
): Promise<AnalyzeResult | null> {
  const key = env.GEMINI_API_KEY?.trim();
  if (!key) return null;

  const model = env.GEMINI_TEXT_MODEL?.trim() || DEFAULT_TEXT_MODEL;
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(model)}:generateContent`;

  const body = {
    contents: [
      {
        parts: [
          { text: ANALYZE_INSTRUCTIONS },
          {
            inlineData: {
              mimeType: normalizeMime(mime),
              data: bytesToBase64(bytes),
            },
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: ANALYZE_SCHEMA,
      temperature: 0.2,
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
    throw new Error(`Gemini analyze HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as GeminiTextResponse;
  const text = json.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text;
  if (!text) return null;

  let parsed: AnalyzeResult;
  try {
    parsed = JSON.parse(text) as AnalyzeResult;
  } catch {
    return null;
  }
  return cleanResult(parsed);
}

/** Drop empty strings/empty-array fields so they don't clutter the UI. */
function cleanResult(r: AnalyzeResult): AnalyzeResult {
  const out: AnalyzeResult = {};
  for (const [k, v] of Object.entries(r) as Array<[keyof AnalyzeResult, unknown]>) {
    if (typeof v === 'string' && v.trim().length > 0) {
      (out as Record<string, unknown>)[k] = v.trim();
    } else if (Array.isArray(v)) {
      const arr = v
        .map((x) => (typeof x === 'string' ? x.trim() : ''))
        .filter((x) => x.length > 0);
      if (arr.length > 0) (out as Record<string, unknown>)[k] = arr;
    }
  }
  return out;
}

interface GeminiTextResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}

// ---- Shared byte / mime helpers used by both image-gen and analyze. ----

export function normalizeMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m === 'image/jpg') return 'image/jpeg';
  return m;
}

export function imageExtFromMime(mime: string): string {
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

/** Magic-byte sniffing for the formats Gemini accepts. */
export function sniffMime(bytes: Uint8Array): string {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  )
    return 'image/png';
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  )
    return 'image/jpeg';
  if (
    bytes.length >= 12 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
    return 'image/webp';
  return 'image/jpeg';
}

export function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(s);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
