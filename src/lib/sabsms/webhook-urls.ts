/**
 * SabSMS webhook-URL builder + credential masking — pure helpers.
 *
 * Kept free of `'use server'` / `'server-only'` so the node:test suites
 * (`__tests__/webhook-urls.test.ts`) can import them directly via
 * `npx tsx --test`.
 *
 * URL scheme (display-only; the Rust engine serves these routes):
 *
 *   inbound: `${base}/webhook/${provider}/${accountId}/inbound?secret=${webhookSecret}`
 *   dlr:     `${base}/webhook/${provider}/${accountId}/dlr?secret=${webhookSecret}`
 *
 * `base` = SABSMS_ENGINE_PUBLIC_URL ?? SABSMS_ENGINE_URL ?? http://localhost:4002
 * (trailing slashes stripped).
 */

export interface SabsmsWebhookUrls {
  inbound: string;
  dlr: string;
}

const DEFAULT_BASE = 'http://localhost:4002';

/** Resolve the public engine base URL (trailing slashes stripped). */
export function resolveSabsmsWebhookBase(
  env: Record<string, string | undefined> = process.env,
): string {
  const raw = env.SABSMS_ENGINE_PUBLIC_URL ?? env.SABSMS_ENGINE_URL ?? DEFAULT_BASE;
  return raw.replace(/\/+$/, '');
}

/**
 * Build the inbound + DLR webhook URLs for a provider account.
 * The secret is embedded as a query parameter — that is its purpose
 * (msg91/gupshup webhook authenticity relies on it), so callers may
 * show these URLs to the account owner, but must never log them.
 */
export function buildSabsmsWebhookUrls(
  provider: string,
  accountId: string,
  webhookSecret: string,
  base?: string,
): SabsmsWebhookUrls {
  const b = (base ?? resolveSabsmsWebhookBase()).replace(/\/+$/, '');
  const p = encodeURIComponent(provider);
  const a = encodeURIComponent(accountId);
  const s = encodeURIComponent(webhookSecret);
  return {
    inbound: `${b}/webhook/${p}/${a}/inbound?secret=${s}`,
    dlr: `${b}/webhook/${p}/${a}/dlr?secret=${s}`,
  };
}

/**
 * Mask a credential value for display: keep the first 2 + last 4
 * characters with '••••' in between. Values shorter than 8 characters
 * are fully masked.
 */
export function maskCredentialValue(value: string): string {
  if (typeof value !== 'string' || value.length === 0) return '••••';
  if (value.length < 8) return '••••';
  return `${value.slice(0, 2)}••••${value.slice(-4)}`;
}
