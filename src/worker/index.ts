import { Hono } from 'hono';
import type { Env, Variables } from './types';
import { auth } from './middleware/auth';
import authRoutes from './routes/auth';
import uploadRoutes from './routes/upload';
import itemsRoutes from './routes/items';
import processRoutes from './routes/process';
import { getItemRaw } from './db/queries';
import { itemIdFromKey, keyBelongsToUser } from './lib/storage';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Health + auth flow are public. Everything else under /api/* requires a session.
app.get('/api/health', (c) =>
  c.json({ ok: true, env: c.env.APP_ENV ?? 'unknown' }),
);
app.route('/api/auth', authRoutes);

app.use('/api/*', auth());

app.route('/api/upload', uploadRoutes);
app.route('/api/items', itemsRoutes);
app.route('/api/items', processRoutes);

/**
 * GET /api/r2/* — stream private R2 objects through the Worker.
 *
 * Ownership rules:
 *   - Keys under `users/<currentUserId>/...` are always served.
 *   - Legacy keys (`raw/items/<id>.ext`, `processed/items/<id>.ext`)
 *     resolve to an item id; we look it up and serve only if the item
 *     belongs to the current user.
 *   - Anything else 404s — never serve another user's bytes by URL.
 */
app.get('/api/r2/*', async (c) => {
  const url = new URL(c.req.url);
  const key = decodeURIComponent(url.pathname.replace(/^\/api\/r2\//, ''));
  if (!key) return c.json({ error: 'Missing key' }, 400);

  const user = c.get('user');
  let allowed = keyBelongsToUser(key, user.id);

  if (!allowed) {
    const itemId = itemIdFromKey(key);
    if (itemId) {
      const row = await getItemRaw(c.env, itemId);
      if (row && row.user_id === user.id) allowed = true;
    }
  }

  if (!allowed) return c.json({ error: 'Not found' }, 404);

  const object = await c.env.BUCKET.get(key);
  if (!object) return c.json({ error: 'Not found' }, 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  // Per-item uuids are stable; cache aggressively at the edge.
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  return new Response(object.body, { headers });
});

app.notFound((c) => {
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
