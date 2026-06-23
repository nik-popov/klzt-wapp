import type { MiddlewareHandler } from 'hono';
import type { Env } from '../types';

/**
 * Bearer-token middleware for /api/*.
 *
 * Behavior:
 *   - If AUTH_TOKEN is set, requires `Authorization: Bearer <AUTH_TOKEN>`.
 *   - If AUTH_TOKEN is unset/empty AND APP_ENV === 'dev', auth is bypassed
 *     so local development works out of the box.
 *   - In any other env without a token, requests are rejected (fail closed).
 */
export const auth = (): MiddlewareHandler<{ Bindings: Env }> => {
  return async (c, next) => {
    const configured = c.env.AUTH_TOKEN?.trim();

    if (!configured) {
      if (c.env.APP_ENV === 'dev') return next();
      return c.json({ error: 'Server auth not configured' }, 500);
    }

    const header = c.req.header('Authorization') ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token || token !== configured) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    return next();
  };
};
