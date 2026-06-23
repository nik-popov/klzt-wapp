import { Hono } from 'hono';
import type { Env } from './types';
import { auth } from './middleware/auth';
import uploadRoutes from './routes/upload';
import itemsRoutes from './routes/items';
import processRoutes from './routes/process';

const app = new Hono<{ Bindings: Env }>();

// All /api/* routes require auth (bypassed in dev when AUTH_TOKEN unset).
app.use('/api/*', auth());

app.get('/api/health', (c) =>
  c.json({ ok: true, env: c.env.APP_ENV ?? 'unknown' }),
);

app.route('/api/upload', uploadRoutes);
app.route('/api/items', itemsRoutes);
app.route('/api/items', processRoutes);

/**
 * GET /api/r2/* — stream private R2 objects through the Worker.
 * Only used when R2_PUBLIC_BASE_URL isn't configured. Keep the route
 * authed to avoid making the bucket effectively public-via-Worker.
 */
app.get('/api/r2/*', async (c) => {
  // Strip the "/api/r2/" prefix to get the object key.
  const url = new URL(c.req.url);
  const key = decodeURIComponent(url.pathname.replace(/^\/api\/r2\//, ''));
  if (!key) return c.json({ error: 'Missing key' }, 400);

  const object = await c.env.BUCKET.get(key);
  if (!object) return c.json({ error: 'Not found' }, 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'private, max-age=3600');
  return new Response(object.body, { headers });
});

app.notFound((c) => {
  // Only API 404s reach here; SPA paths fall through to ASSETS via the
  // assets binding's not_found_handling = "single-page-application".
  if (c.req.path.startsWith('/api/')) {
    return c.json({ error: 'Not found' }, 404);
  }
  return c.env.ASSETS.fetch(c.req.raw);
});

app.onError((err, c) => {
  console.error('Worker error:', err);
  return c.json({ error: err.message || 'Internal error' }, 500);
});

export default app;
