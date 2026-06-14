import 'server-only';

/**
 * SabMail full-text search layer — Meilisearch, degrade-safe.
 *
 * Meilisearch is OPTIONAL infrastructure. The `meilisearch` package is NOT a
 * hard dependency: this module dynamic-imports it via a NON-LITERAL specifier
 * (the same pattern as `pgp.ts` / `offline-cache.ts`) so TypeScript compiles
 * WITHOUT the package present, and bundlers never try to resolve it eagerly.
 *
 *   Install with:  npm i meilisearch
 *   Configure with: MEILISEARCH_URL  (+ optional MEILISEARCH_API_KEY / _KEY)
 *
 * The contract is intentionally tiny and degrade-safe:
 *
 *   • `searchSabmailMessagesIndex(...)` returns `SabmailMessageRow[]` on a hit,
 *     or `null` to signal "I can't serve this — fall back to the IMAP search".
 *     It returns `null` (never throws) when Meilisearch is not configured, the
 *     package is missing, the index is empty/absent, or any error occurs.
 *
 * Callers (the inbox `searchSabmailMessages` action) try this layer first and
 * fall back to the proven IMAP `SEARCH` when it returns `null` or throws — so
 * the search UX is identical whether or not Meilisearch is wired up.
 *
 * Index layout (one index per workspace keeps tenants isolated):
 *   index uid : `sabmail_messages_<workspaceId>`  (sanitized)
 *   documents : the `SabmailIndexedMessage` shape below — a superset of the
 *               `SabmailMessageRow` fields the inbox renders, plus `accountId`,
 *               `folder`, and a `body` field for full-text recall. Filterable
 *               on `accountId` + `folder`; sortable on `dateTs`.
 *
 * This module owns NO indexing/ingest path — it is read-only. Whatever process
 * keeps the index warm (a sync worker, a bind route, a backfill) writes the
 * `SabmailIndexedMessage` documents; here we only query and map back to the
 * inbox row shape. When nothing has indexed yet, every query returns `null`
 * and the inbox silently uses IMAP.
 */

import type { SabmailMessageRow } from '@/app/sabmail/inbox/actions';

/* ── env / config ────────────────────────────────────────────────────── */

interface MeiliConfig {
  host: string;
  apiKey?: string;
}

/** Read Meilisearch config from env; `null` when not configured (no host). */
function readMeiliConfig(): MeiliConfig | null {
  const host = (
    process.env.MEILISEARCH_URL ||
    process.env.MEILISEARCH_HOST ||
    ''
  ).trim();
  if (!host) return null;
  const apiKey = (
    process.env.MEILISEARCH_API_KEY ||
    process.env.MEILISEARCH_KEY ||
    process.env.MEILI_MASTER_KEY ||
    ''
  ).trim();
  return apiKey ? { host, apiKey } : { host };
}

/** True when Meilisearch is configured (host present) — does NOT prove reachability. */
export function isMeilisearchConfigured(): boolean {
  return readMeiliConfig() !== null;
}

/* ── lazy, optional client ───────────────────────────────────────────── */

/**
 * Lazily load `meilisearch` as an optional dep (null when not installed).
 * Non-literal specifier keeps tsc + bundlers from requiring the package.
 */
async function loadMeiliClient(config: MeiliConfig): Promise<any | null> {
  try {
    const mod = (await import(/* webpackIgnore: true */ ('meilisearch' as string)).catch(
      () => null,
    )) as any;
    if (!mod) return null;
    const MeiliSearch = mod.MeiliSearch ?? mod.default?.MeiliSearch ?? mod.default ?? mod;
    if (typeof MeiliSearch !== 'function') return null;
    return new MeiliSearch({ host: config.host, apiKey: config.apiKey });
  } catch {
    return null;
  }
}

/* ── document shape (index contract) ─────────────────────────────────── */

/**
 * The document shape stored in a workspace's Meilisearch index. A superset of
 * `SabmailMessageRow` (the fields the inbox list renders) plus routing fields
 * (`accountId`, `folder`) and `body` for full-text recall. `id` is the
 * Meilisearch primary key (`<accountId>:<folder>:<uid>`); `dateTs` is a numeric
 * epoch for sortable recency.
 */
export interface SabmailIndexedMessage {
  id: string;
  workspaceId: string;
  accountId: string;
  folder: string;
  uid: number;
  subject: string;
  fromName: string;
  fromEmail: string;
  to?: string;
  body?: string;
  date: string | null;
  dateTs: number;
  seen: boolean;
  flagged: boolean;
  hasAttachments: boolean;
  messageId: string | null;
  inReplyTo: string | null;
}

/** Meilisearch index uids must be a-z0-9_- only; sanitize the workspace id. */
function indexUidFor(workspaceId: string): string {
  const safe = String(workspaceId).replace(/[^a-zA-Z0-9_-]/g, '');
  return `sabmail_messages_${safe}`;
}

/** Map a stored index document back to the inbox row shape the UI renders. */
function toRow(doc: Partial<SabmailIndexedMessage>): SabmailMessageRow {
  return {
    uid: Number(doc.uid),
    subject: doc.subject || '(no subject)',
    fromName: doc.fromName ?? '',
    fromEmail: (doc.fromEmail ?? '').toLowerCase(),
    date: doc.date ?? null,
    seen: !!doc.seen,
    flagged: !!doc.flagged,
    hasAttachments: !!doc.hasAttachments,
    messageId: doc.messageId ?? null,
    inReplyTo: doc.inReplyTo ?? null,
    // screener verdict is annotated by the caller (post-query), like IMAP search.
    screenerDecision: null,
  };
}

/* ── public read API ─────────────────────────────────────────────────── */

export interface MeiliSearchOpts {
  /** Restrict to one folder/path (e.g. 'INBOX'); omit to search all folders. */
  folder?: string;
  /** Max hits to return (default 80, matching the IMAP search cap). */
  limit?: number;
}

/**
 * Search a workspace's Meilisearch index for `query` within `accountId`.
 *
 * Returns mapped `SabmailMessageRow[]` on success, or `null` to signal the
 * caller MUST fall back to IMAP search — when:
 *   • Meilisearch is not configured (no MEILISEARCH_URL), OR
 *   • the `meilisearch` package is not installed, OR
 *   • the index doesn't exist yet / has no documents, OR
 *   • any client/network error occurs (never throws).
 *
 * A successful-but-empty result (index exists, query matched nothing) returns
 * `[]` — distinct from `null`, so the caller can honor a genuine "no matches"
 * instead of re-running the IMAP search.
 */
export async function searchSabmailMessagesIndex(
  workspaceId: string,
  accountId: string,
  query: string,
  opts: MeiliSearchOpts = {},
): Promise<SabmailMessageRow[] | null> {
  const q = (query ?? '').trim();
  if (!workspaceId || !accountId || !q) return null;

  const config = readMeiliConfig();
  if (!config) return null; // not configured → fall back to IMAP

  const client = await loadMeiliClient(config);
  if (!client) return null; // package missing / bad config → fall back

  try {
    const index = client.index(indexUidFor(workspaceId));

    // Filter to the account (always) + the folder (when scoped). Mirrors the
    // IMAP search, which runs inside a single mailbox lock for one folder.
    const filters: string[] = [`accountId = "${accountId}"`];
    if (opts.folder) filters.push(`folder = "${opts.folder}"`);

    const res = (await index.search(q, {
      limit: Math.max(1, Math.min(opts.limit ?? 80, 200)),
      filter: filters,
      sort: ['dateTs:desc'],
      attributesToRetrieve: [
        'uid',
        'subject',
        'fromName',
        'fromEmail',
        'date',
        'seen',
        'flagged',
        'hasAttachments',
        'messageId',
        'inReplyTo',
      ],
    })) as { hits?: Array<Partial<SabmailIndexedMessage>> };

    const hits = Array.isArray(res?.hits) ? res.hits : null;
    // A missing/undefined hits array means the query never really ran — treat
    // as "can't serve" and fall back. An empty array is a genuine no-match.
    if (!hits) return null;

    return hits.map(toRow);
  } catch {
    // Index absent, server unreachable, auth failure, malformed filter, etc.
    // Always degrade to IMAP rather than surfacing an error to the inbox.
    return null;
  }
}
