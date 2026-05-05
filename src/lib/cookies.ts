/**
 * Shared helpers for session cookie flags.
 *
 * The old code used `secure: process.env.NODE_ENV === 'production'`, which
 * silently breaks any production deployment served over plain HTTP — the
 * browser drops Secure cookies received on non-HTTPS connections, so the
 * user appears logged out on every refresh.
 *
 * Resolution order:
 *   1. Explicit override via `COOKIE_SECURE` env var (`'true'` | `'false'`).
 *   2. Protocol inferred from `NEXT_PUBLIC_APP_URL` (uses HTTPS ⇒ secure).
 *   3. Default: false. Safer than breaking the session silently.
 *
 * Set `COOKIE_SECURE=true` (or `NEXT_PUBLIC_APP_URL=https://…`) once you
 * terminate TLS in front of the server.
 */
export function getCookieSecureFlag(): boolean {
  const override = process.env.COOKIE_SECURE?.toLowerCase().trim();
  if (override === 'true') return true;
  if (override === 'false') return false;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl && /^https:\/\//i.test(appUrl)) return true;

  return false;
}

/**
 * Optional Domain attribute. When set (e.g. `.sabnode.com`), the
 * session cookie is shared between the apex host and every subdomain
 * — required if users hop between `sabnode.com` and `www.sabnode.com`.
 * Leave unset for host-only cookies (the safe default).
 */
function getCookieDomain(): string | undefined {
  const explicit = process.env.COOKIE_DOMAIN?.trim();
  if (explicit) return explicit;
  return undefined;
}

/**
 * Standard session cookie options used by every login surface.
 */
export function sessionCookieOptions(maxAgeSeconds: number) {
  const domain = getCookieDomain();
  return {
    httpOnly: true as const,
    secure: getCookieSecureFlag(),
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
    ...(domain ? { domain } : {}),
  };
}
