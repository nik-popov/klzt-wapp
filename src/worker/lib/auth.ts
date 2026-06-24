import type { Env } from '../types';

export const SESSION_COOKIE = 'klzt_session';
export const OAUTH_STATE_COOKIE = 'klzt_oauth_state';
const DEFAULT_SESSION_TTL_DAYS = 30;
const OAUTH_STATE_TTL_SECONDS = 10 * 60;

export const BOOTSTRAP_USER_ID = 'admin-bootstrap';
export const BOOTSTRAP_PENDING_SUB = 'bootstrap-pending';

export function sessionTtlSeconds(env: Env): number {
  const days = Number(env.SESSION_TTL_DAYS) || DEFAULT_SESSION_TTL_DAYS;
  return Math.max(1, Math.floor(days)) * 24 * 60 * 60;
}

export function parseCookie(
  header: string | null | undefined,
  name: string,
): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    if (k === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

export interface CookieOptions {
  maxAgeSeconds?: number;
  secure?: boolean;
  sameSite?: 'Lax' | 'Strict' | 'None';
  path?: string;
  httpOnly?: boolean;
}

export function serializeCookie(
  name: string,
  value: string,
  opts: CookieOptions = {},
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${opts.path ?? '/'}`);
  parts.push(`SameSite=${opts.sameSite ?? 'Lax'}`);
  if (opts.maxAgeSeconds !== undefined) parts.push(`Max-Age=${opts.maxAgeSeconds}`);
  if (opts.secure !== false) parts.push('Secure');
  if (opts.httpOnly !== false) parts.push('HttpOnly');
  return parts.join('; ');
}

export function clearCookie(name: string, path = '/'): string {
  return `${name}=; Path=${path}; Max-Age=0; SameSite=Lax; Secure; HttpOnly`;
}

export function oauthStateTtlSeconds(): number {
  return OAUTH_STATE_TTL_SECONDS;
}

/**
 * Decode a JWT payload without signature verification.
 *
 * Safe here because we receive the ID token directly from Google's token
 * endpoint over a TLS-secured channel authenticated with our client
 * secret — that's the moment OAuth 2.0 / OIDC explicitly allows skipping
 * signature checks. Do NOT use this on tokens received from clients.
 */
export function decodeJwtPayload<T = Record<string, unknown>>(jwt: string): T {
  const parts = jwt.split('.');
  if (parts.length < 2) throw new Error('Invalid JWT');
  const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text) as T;
}

export interface GoogleIdTokenClaims {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  iss?: string;
  aud?: string;
  exp?: number;
}

export function randomToken(byteLen = 32): string {
  const arr = new Uint8Array(byteLen);
  crypto.getRandomValues(arr);
  let s = '';
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function googleAuthorizeUrl(
  env: Env,
  state: string,
  redirectUri: string,
): string {
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.searchParams.set('client_id', env.GOOGLE_CLIENT_ID ?? '');
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', 'openid email profile');
  u.searchParams.set('state', state);
  u.searchParams.set('prompt', 'select_account');
  u.searchParams.set('access_type', 'online');
  return u.toString();
}

export interface GoogleTokenResponse {
  id_token: string;
  access_token: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

export async function exchangeCodeForTokens(
  env: Env,
  code: string,
  redirectUri: string,
): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id: env.GOOGLE_CLIENT_ID ?? '',
    client_secret: env.GOOGLE_CLIENT_SECRET ?? '',
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Google token exchange failed: HTTP ${res.status} ${text.slice(0, 300)}`,
    );
  }
  return (await res.json()) as GoogleTokenResponse;
}

/**
 * Resolve the OAuth callback URI. Explicit env var wins (useful when the
 * Worker sits behind a custom domain whose origin differs from the URL
 * Google was configured with); otherwise derive from the request origin.
 */
export function resolveRedirectUri(env: Env, req: Request): string {
  const explicit = env.GOOGLE_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  const u = new URL(req.url);
  return `${u.origin}/api/auth/callback`;
}

export function oauthConfigured(env: Env): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID?.trim() && env.GOOGLE_CLIENT_SECRET?.trim());
}
