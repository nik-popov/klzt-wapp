import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { rowToUser } from '../types';
import {
  createSession,
  createUser,
  deleteSession,
  getSessionWithUser,
  getUserByEmail,
  getUserByGoogleSub,
  updateUserProfile,
} from '../db/queries';
import {
  BOOTSTRAP_PENDING_SUB,
  BOOTSTRAP_USER_ID,
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  clearCookie,
  decodeJwtPayload,
  exchangeCodeForTokens,
  googleAuthorizeUrl,
  oauthConfigured,
  oauthStateTtlSeconds,
  parseCookie,
  randomToken,
  resolveRedirectUri,
  serializeCookie,
  sessionTtlSeconds,
  type GoogleIdTokenClaims,
} from '../lib/auth';
import type { MeResponse, LogoutResponse } from '@shared/types';

const auth = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * GET /api/auth/login
 *
 * Plants a short-lived CSRF state cookie and redirects to Google. The
 * callback verifies the state matches before exchanging the code.
 */
auth.get('/login', (c) => {
  if (!oauthConfigured(c.env)) {
    return c.json(
      { error: 'Google OAuth not configured (GOOGLE_CLIENT_ID/SECRET missing)' },
      500,
    );
  }
  const state = randomToken();
  const redirectUri = resolveRedirectUri(c.env, c.req.raw);
  const url = googleAuthorizeUrl(c.env, state, redirectUri);

  const headers = new Headers({ Location: url });
  headers.append(
    'Set-Cookie',
    serializeCookie(OAUTH_STATE_COOKIE, state, {
      maxAgeSeconds: oauthStateTtlSeconds(),
      sameSite: 'Lax',
    }),
  );
  return new Response(null, { status: 302, headers });
});

/**
 * GET /api/auth/callback?code=...&state=...
 *
 * Verifies the CSRF state, exchanges the code for tokens, upserts the
 * user keyed by Google `sub`, mints a session row, and sets the session
 * cookie. Redirects to `/` on success and `/login?error=...` on failure.
 */
auth.get('/callback', async (c) => {
  const url = new URL(c.req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = parseCookie(c.req.header('cookie'), OAUTH_STATE_COOKIE);

  if (!code || !state || !cookieState || state !== cookieState) {
    return redirectToLoginWithError('invalid_state');
  }

  let user;
  try {
    const redirectUri = resolveRedirectUri(c.env, c.req.raw);
    const tokens = await exchangeCodeForTokens(c.env, code, redirectUri);
    const claims = decodeJwtPayload<GoogleIdTokenClaims>(tokens.id_token);
    if (!claims.sub || !claims.email) {
      return redirectToLoginWithError('missing_claims');
    }
    user = await upsertGoogleUser(c.env, claims);
  } catch (err) {
    console.warn('OAuth callback failed:', err);
    return redirectToLoginWithError('oauth_failed');
  }

  const sessionId = randomToken();
  const ttl = sessionTtlSeconds(c.env);
  const expiresAt = Math.floor(Date.now() / 1000) + ttl;
  await createSession(c.env, {
    id: sessionId,
    user_id: user.id,
    expires_at: expiresAt,
  });

  const headers = new Headers({ Location: '/' });
  headers.append(
    'Set-Cookie',
    serializeCookie(SESSION_COOKIE, sessionId, {
      maxAgeSeconds: ttl,
      sameSite: 'Lax',
    }),
  );
  headers.append('Set-Cookie', clearCookie(OAUTH_STATE_COOKIE));
  return new Response(null, { status: 302, headers });
});

/**
 * GET /api/auth/me
 *
 * Returns the signed-in user. 401 when the cookie is missing or expired.
 * Public on purpose — the frontend uses this to decide whether to show
 * the gallery or redirect to /login.
 */
auth.get('/me', async (c) => {
  const cookie = parseCookie(c.req.header('cookie'), SESSION_COOKIE);
  if (!cookie) return c.json({ error: 'Unauthorized' }, 401);
  const sessionAndUser = await getSessionWithUser(c.env, cookie);
  if (!sessionAndUser) return c.json({ error: 'Unauthorized' }, 401);
  const body: MeResponse = { user: rowToUser(sessionAndUser.user) };
  return c.json(body);
});

/**
 * POST /api/auth/logout
 *
 * Deletes the session row (if any) and clears the cookie. Idempotent.
 */
auth.post('/logout', async (c) => {
  const cookie = parseCookie(c.req.header('cookie'), SESSION_COOKIE);
  if (cookie) {
    try {
      await deleteSession(c.env, cookie);
    } catch (err) {
      console.warn('Logout session delete failed:', err);
    }
  }
  const headers = new Headers({ 'Content-Type': 'application/json' });
  headers.append('Set-Cookie', clearCookie(SESSION_COOKIE));
  const body: LogoutResponse = { ok: true };
  return new Response(JSON.stringify(body), { status: 200, headers });
});

/**
 * Look up (or create) the local user that maps to this Google account.
 *
 * Bootstrap claim: when BOOTSTRAP_USER_EMAIL matches the incoming email
 * AND the placeholder admin row still exists, we rewrite that row to
 * claim it instead of creating a new account. Effect: the very first
 * authorized login inherits all of the pre-Phase-2 seed items.
 */
async function upsertGoogleUser(
  env: Env,
  claims: GoogleIdTokenClaims,
) {
  const existing = await getUserByGoogleSub(env, claims.sub);
  if (existing) {
    // Refresh profile fields in case display name / picture changed.
    const updated = await updateUserProfile(env, existing.id, {
      email: claims.email,
      name: claims.name ?? existing.name,
      picture: claims.picture ?? existing.picture,
    });
    return updated ?? existing;
  }

  const bootstrapEmail = env.BOOTSTRAP_USER_EMAIL?.trim().toLowerCase();
  if (bootstrapEmail && claims.email.toLowerCase() === bootstrapEmail) {
    const bootstrap = await getUserByGoogleSub(env, BOOTSTRAP_PENDING_SUB);
    if (bootstrap && bootstrap.id === BOOTSTRAP_USER_ID) {
      const claimed = await updateUserProfile(env, BOOTSTRAP_USER_ID, {
        google_sub: claims.sub,
        email: claims.email,
        name: claims.name ?? null,
        picture: claims.picture ?? null,
      });
      if (claimed) return claimed;
    }
  }

  // Email collisions with an existing local user are treated as a fresh
  // signup keyed by the new google_sub — we never merge two distinct
  // Google accounts that happen to share an email.
  const _byEmail = await getUserByEmail(env, claims.email);
  void _byEmail;

  return createUser(env, {
    id: crypto.randomUUID(),
    google_sub: claims.sub,
    email: claims.email,
    name: claims.name ?? null,
    picture: claims.picture ?? null,
  });
}

function redirectToLoginWithError(code: string): Response {
  const headers = new Headers({ Location: `/login?error=${encodeURIComponent(code)}` });
  headers.append('Set-Cookie', clearCookie(OAUTH_STATE_COOKIE));
  return new Response(null, { status: 302, headers });
}

export default auth;
