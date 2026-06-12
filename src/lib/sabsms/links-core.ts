/**
 * Pure logic for the SabSMS link shortener (V2.4 track B).
 *
 * No DB access and no `server-only` import so `node:test` (via tsx) can
 * exercise everything here directly — the same split `segments.ts` /
 * `render.ts` use. The Mongo-bound API lives in `./links.ts`.
 */

import { createHash, randomBytes } from 'node:crypto';

// ─── Slugs ─────────────────────────────────────────────────────────────────

export const SLUG_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export const SLUG_LENGTH = 7;

/**
 * Cryptographically random base62 slug. Rejection sampling keeps the
 * distribution uniform (bytes ≥ 248 = 4×62 would bias `% 62`).
 */
export function generateSlug(length: number = SLUG_LENGTH): string {
  const out: string[] = [];
  while (out.length < length) {
    const bytes = randomBytes(length * 2);
    for (const b of bytes) {
      if (b >= 248) continue;
      out.push(SLUG_ALPHABET[b % 62]);
      if (out.length === length) break;
    }
  }
  return out.join('');
}

// ─── URL extraction ────────────────────────────────────────────────────────

const URL_RE = /https?:\/\/[^\s<>"']+/gi;
// SMS bodies put URLs mid-sentence — "see https://x.co/a, thanks!" must
// not swallow the comma. Closing brackets are stripped too; balanced
// "(...)" URLs are rare in SMS and not worth the heuristic.
const TRAILING_PUNCT_RE = /[.,!?;:)\]}>'"”’…]+$/;

/** True when the string parses as an absolute http(s) URL. */
export function isValidTargetUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Find every http(s) URL in a message body, in order of first
 * appearance, deduplicated, with trailing sentence punctuation stripped.
 */
export function extractUrls(body: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of body.matchAll(URL_RE)) {
    const url = m[0].replace(TRAILING_PUNCT_RE, '');
    if (!url || !isValidTargetUrl(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

/** True when `url` already lives under one of our short-link bases. */
export function isAlreadyShortened(url: string, bases: string[]): boolean {
  const lower = url.toLowerCase();
  return bases.some((base) => {
    const b = base.replace(/\/+$/, '').toLowerCase();
    return !!b && (lower === b || lower.startsWith(`${b}/`));
  });
}

/**
 * Replace every occurrence of each `from` URL with its `to` short URL.
 * Longest-first so `https://x.co` never corrupts `https://x.co/page`.
 */
export function replaceUrls(
  body: string,
  mapping: Array<{ from: string; to: string }>,
): string {
  const sorted = [...mapping].sort((a, b) => b.from.length - a.from.length);
  let out = body;
  for (const { from, to } of sorted) {
    out = out.split(from).join(to);
  }
  return out;
}

// ─── Short-link base resolution ────────────────────────────────────────────

const HOSTNAME_RE =
  /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

/**
 * Normalize a branded short-link domain to a bare lowercase hostname
 * ("https://Sab.SM/" → "sab.sm"). Returns null when the input is not a
 * plain hostname (paths, ports, spaces, missing TLD all reject).
 */
export function normalizeShortLinkDomain(input: string): string | null {
  let v = (input ?? '').trim();
  if (!v) return null;
  v = v.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  if (!HOSTNAME_RE.test(v)) return null;
  return v.toLowerCase();
}

export interface ShortLinkBaseEnv {
  SABSMS_SHORT_LINK_BASE?: string;
  NEXT_PUBLIC_APP_URL?: string;
}

/**
 * Resolve the absolute base short URLs are minted under, in priority
 * order: workspace branded domain → `SABSMS_SHORT_LINK_BASE` →
 * `NEXT_PUBLIC_APP_URL` + `/s` (the shared `/s/[shortCode]` segment).
 */
export function resolveShortLinkBase(
  opts: { workspaceDomain?: string | null; env?: ShortLinkBaseEnv } = {},
): string {
  const env = opts.env ?? (process.env as ShortLinkBaseEnv);
  if (opts.workspaceDomain) {
    const domain = normalizeShortLinkDomain(opts.workspaceDomain);
    if (domain) return `https://${domain}`;
  }
  const fromEnv = (env.SABSMS_SHORT_LINK_BASE ?? '').trim().replace(/\/+$/, '');
  if (fromEnv) return fromEnv;
  const app = (env.NEXT_PUBLIC_APP_URL ?? '').trim().replace(/\/+$/, '');
  return `${app || 'http://localhost:3000'}/s`;
}

// ─── Reuse + privacy helpers ───────────────────────────────────────────────

export interface ShortLinkTuple {
  workspaceId: string;
  targetUrl: string;
  campaignId?: string;
  contactId?: string;
}

/**
 * Mongo filter identifying the reuse tuple (workspaceId, target,
 * campaignId, contactId). `undefined` attribution normalizes to `null`,
 * which Mongo matches against documents where the field is absent — so
 * a second identical send reuses the existing slug instead of minting.
 */
export function reuseFilterFor(input: ShortLinkTuple): {
  workspaceId: string;
  target: string;
  campaignId: string | null;
  contactId: string | null;
} {
  return {
    workspaceId: input.workspaceId,
    target: input.targetUrl,
    campaignId: input.campaignId ?? null,
    contactId: input.contactId ?? null,
  };
}

/** Privacy-preserving IP fingerprint — sha256 hex truncated to 16 chars. */
export function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}
