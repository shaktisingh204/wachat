import 'server-only';

/**
 * SabSMS link shortener — Mongo-bound API (V2.4 track B).
 *
 * Short links live in `sabsms_short_links` ({ slug } unique index),
 * clicks in `sabsms_link_clicks` — both schemas are the contract in
 * `./types.ts` / `./db/collections.ts` and indexes are ensured through
 * `ensureSabsmsIndexes()` on first use.
 *
 * Pure logic (slug generation, URL extraction, base resolution, reuse
 * filter, IP hashing) lives in `./links-core.ts` so it stays testable
 * without a DB.
 */

import type { Filter } from 'mongodb';

import { getSabsmsCollections, ensureSabsmsIndexes } from './db/collections';
import type { SabsmsLinkClick, SabsmsShortLink } from './types';
import {
  extractUrls,
  generateSlug,
  hashIp,
  isAlreadyShortened,
  isValidTargetUrl,
  replaceUrls,
  resolveShortLinkBase,
  reuseFilterFor,
} from './links-core';

const MAX_SLUG_ATTEMPTS = 5;

/**
 * Effective short-link base for a workspace: branded domain from
 * `sabsms_settings.shortLinkDomain` when set, else
 * `SABSMS_SHORT_LINK_BASE`, else `NEXT_PUBLIC_APP_URL` + `/s`.
 */
export async function resolveWorkspaceShortLinkBase(
  workspaceId: string,
): Promise<string> {
  const { cols } = await getSabsmsCollections();
  const settings = await cols.settings.findOne(
    { workspaceId },
    { projection: { shortLinkDomain: 1 } },
  );
  return resolveShortLinkBase({ workspaceDomain: settings?.shortLinkDomain });
}

export interface CreateShortLinkInput {
  workspaceId: string;
  targetUrl: string;
  campaignId?: string;
  contactId?: string;
  messageId?: string;
  /** Pre-resolved base — avoids a settings lookup per URL in batch paths. */
  baseOverride?: string;
}

export interface CreateShortLinkResult {
  slug: string;
  shortUrl: string;
}

/**
 * Mint (or reuse) a short link. An existing slug for the same
 * (workspaceId, target, campaignId, contactId) tuple is returned
 * instead of minting a new one; otherwise a 7-char base62 slug is
 * inserted, retrying on duplicate-key against the unique slug index.
 */
export async function createShortLink(
  input: CreateShortLinkInput,
): Promise<CreateShortLinkResult> {
  if (!isValidTargetUrl(input.targetUrl)) {
    throw new Error('targetUrl must be an absolute http(s) URL');
  }
  await ensureSabsmsIndexes();
  const { cols } = await getSabsmsCollections();
  const base =
    input.baseOverride ??
    (await resolveWorkspaceShortLinkBase(input.workspaceId));

  // `null` in the filter matches docs where the field is absent — see
  // `reuseFilterFor`. The cast is needed because Filter<T> doesn't model
  // null-matches-missing for optional string fields.
  const existing = await cols.shortLinks.findOne(
    reuseFilterFor(input) as unknown as Filter<SabsmsShortLink>,
  );
  if (existing) {
    return { slug: existing.slug, shortUrl: `${base}/${existing.slug}` };
  }

  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const slug = generateSlug();
    const doc: SabsmsShortLink = {
      workspaceId: input.workspaceId,
      slug,
      target: input.targetUrl,
      ...(input.campaignId ? { campaignId: input.campaignId } : {}),
      ...(input.contactId ? { contactId: input.contactId } : {}),
      ...(input.messageId ? { messageId: input.messageId } : {}),
      clickCount: 0,
      createdAt: new Date(),
    };
    try {
      await cols.shortLinks.insertOne(doc);
      return { slug, shortUrl: `${base}/${slug}` };
    } catch (e) {
      // 11000 = duplicate key on the unique slug index — re-roll.
      if ((e as { code?: number })?.code === 11000) continue;
      throw e;
    }
  }
  throw new Error('could not allocate a unique short-link slug');
}

export interface ShortLinkInfo {
  slug: string;
  shortUrl: string;
  targetUrl: string;
}

export interface ShortenContext {
  workspaceId: string;
  campaignId?: string;
  contactId?: string;
}

/**
 * Find every http(s) URL in `body`, shorten each (skipping URLs that
 * already live under a short-link base), and return the rewritten body
 * plus the minted links for attribution follow-up.
 */
export async function shortenUrlsInBody(
  body: string,
  ctx: ShortenContext,
): Promise<{ body: string; links: ShortLinkInfo[] }> {
  const base = await resolveWorkspaceShortLinkBase(ctx.workspaceId);
  // Skip URLs under the workspace base AND the env defaults — a branded
  // workspace may still carry older `${APP_URL}/s/...` links in drafts.
  const knownBases = [base, resolveShortLinkBase()];
  const urls = extractUrls(body).filter(
    (url) => !isAlreadyShortened(url, knownBases),
  );
  if (urls.length === 0) return { body, links: [] };

  const links: ShortLinkInfo[] = [];
  for (const targetUrl of urls) {
    const { slug, shortUrl } = await createShortLink({
      workspaceId: ctx.workspaceId,
      targetUrl,
      campaignId: ctx.campaignId,
      contactId: ctx.contactId,
      baseOverride: base,
    });
    links.push({ slug, shortUrl, targetUrl });
  }

  return {
    body: replaceUrls(
      body,
      links.map((l) => ({ from: l.targetUrl, to: l.shortUrl })),
    ),
    links,
  };
}

/** Slug lookup for the public redirect route. */
export async function getShortLinkBySlug(
  slug: string,
): Promise<SabsmsShortLink | null> {
  if (!slug || slug.length > 64) return null;
  const { cols } = await getSabsmsCollections();
  return cols.shortLinks.findOne({ slug });
}

export interface RecordClickInput {
  slug: string;
  ua?: string;
  ip?: string;
  /**
   * Accepted for API symmetry with the redirect route but NOT persisted
   * — `SabsmsLinkClick` (the Rust-shared contract) has no referer field.
   */
  referer?: string;
}

/**
 * Record one click: insert a `sabsms_link_clicks` doc (campaign/contact
 * attribution copied from the link) and `$inc` the link's clickCount.
 * Raw IPs are never stored — only a truncated sha256 fingerprint.
 */
export async function recordClick(input: RecordClickInput): Promise<boolean> {
  const { cols } = await getSabsmsCollections();
  const link = await cols.shortLinks.findOne({ slug: input.slug });
  if (!link) return false;

  const click: SabsmsLinkClick = {
    workspaceId: link.workspaceId,
    shortLinkId: String(link._id),
    ...(link.campaignId ? { campaignId: link.campaignId } : {}),
    ...(link.contactId ? { contactId: link.contactId } : {}),
    ...(input.ip ? { ip: hashIp(input.ip) } : {}),
    ...(input.ua ? { userAgent: input.ua } : {}),
    clickedAt: new Date(),
  };
  await cols.linkClicks.insertOne(click);
  await cols.shortLinks.updateOne({ _id: link._id }, { $inc: { clickCount: 1 } });
  return true;
}

/**
 * Late messageId attribution: the engine id only exists after enqueue,
 * so the send path shortens first and back-fills here (fire-and-forget).
 * Only links that don't carry a messageId yet are touched — a reused
 * slug keeps the message that minted it.
 */
export async function attachMessageIdToLinks(
  workspaceId: string,
  slugs: string[],
  messageId: string,
): Promise<void> {
  if (slugs.length === 0 || !messageId) return;
  const { cols } = await getSabsmsCollections();
  await cols.shortLinks.updateMany(
    { workspaceId, slug: { $in: slugs }, messageId: { $exists: false } },
    { $set: { messageId } },
  );
}
