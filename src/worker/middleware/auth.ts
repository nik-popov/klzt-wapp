import type { MiddlewareHandler } from 'hono';
import type { Env, UserRow, Variables } from '../types';
import { rowToUser } from '../types';
import {
  createUser,
  ensureDefaultCloset,
  getSessionWithUser,
  getUserByEmail,
} from '../db/queries';
import { SESSION_COOKIE, parseCookie } from '../lib/auth';

/**
 * Cookie-session middleware for /api/*.
 *
 * Order of resolution:
 *   1. DEV_USER_EMAIL set       -> bypass cookie; auto-create that user
 *      so local `wrangler dev` works without Google credentials.
 *   2. klzt_session cookie set  -> resolve session row + user.
 *   3. Otherwise                -> 401 Unauthorized.
 *
 * On success the user + default closet id are attached to the request
 * context for downstream handlers (`c.get('user')`, `c.get('closetId')`).
 */
export const auth = (): MiddlewareHandler<{ Bindings: Env; Variables: Variables }> => {
  return async (c, next) => {
    let userRow: UserRow | null = null;

    const devEmail = c.env.DEV_USER_EMAIL?.trim();
    if (devEmail) {
      userRow = await ensureDevUser(c.env, devEmail);
    } else {
      const cookie = parseCookie(c.req.header('cookie'), SESSION_COOKIE);
      if (cookie) {
        const result = await getSessionWithUser(c.env, cookie);
        if (result) userRow = result.user;
      }
    }

    if (!userRow) return c.json({ error: 'Unauthorized' }, 401);

    const closet = await ensureDefaultCloset(c.env, userRow.id);
    c.set('user', rowToUser(userRow));
    c.set('closetId', closet.id);
    return next();
  };
};

/**
 * Find or create the dev-mode user. Keyed by email so the same dev
 * identity persists across `wrangler dev` restarts.
 */
async function ensureDevUser(env: Env, email: string): Promise<UserRow> {
  const existing = await getUserByEmail(env, email);
  if (existing) return existing;
  return createUser(env, {
    id: crypto.randomUUID(),
    google_sub: `dev:${email}`,
    email,
    name: 'Dev user',
  });
}
