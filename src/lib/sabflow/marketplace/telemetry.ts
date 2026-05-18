/**
 * SabFlow Marketplace — telemetry helpers.
 *
 * Phase C.10.10 — Marketplace telemetry & analytics.
 *
 * All three functions are fire-and-forget: they kick off an async write to
 * `sabflow_marketplace_events` but never block the caller. Any error is
 * swallowed (with a dev-mode console warning) so a telemetry failure never
 * degrades the user-facing request.
 *
 * Collection shape (per event type):
 *
 *   { type: 'view',    templateId, userId, ts }
 *   { type: 'install', templateId, userId, ts }
 *   { type: 'search',  query, resultCount, userId, ts }
 *
 * Indexes are bootstrapped lazily on the first write.
 *
 * INTENTIONALLY not marked `server-only` — the analytics route and the
 * install route both import this, and bundler boundaries are enforced by
 * those files' own `runtime = 'nodejs'` / `server-only` guards.
 */

import { connectToDatabase } from '@/lib/mongodb';

/* ── Collection name ────────────────────────────────────────────────────── */

export const MARKETPLACE_EVENTS_COLLECTION = 'sabflow_marketplace_events';

/* ── Event shapes ───────────────────────────────────────────────────────── */

interface ViewEvent {
  type: 'view';
  templateId: string;
  userId: string;
  ts: number;
}

interface InstallEvent {
  type: 'install';
  templateId: string;
  userId: string;
  ts: number;
}

interface SearchEvent {
  type: 'search';
  query: string;
  resultCount: number;
  userId: string;
  ts: number;
}

type MarketplaceEvent = ViewEvent | InstallEvent | SearchEvent;

/* ── Internal write helper ──────────────────────────────────────────────── */

async function writeEvent(event: MarketplaceEvent): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection<MarketplaceEvent>(MARKETPLACE_EVENTS_COLLECTION);

  // Lazy-create indexes — idempotent and only fires the first time per
  // collection lifetime; MongoDB deduplicates subsequent calls internally.
  await col.createIndex({ type: 1, ts: -1 }, { background: true });
  await col.createIndex({ templateId: 1, type: 1 }, { background: true });
  await col.createIndex({ userId: 1, ts: -1 }, { background: true });

  await col.insertOne(event);
}

/* ── Public API ─────────────────────────────────────────────────────────── */

/**
 * Record a template page-view. Fire-and-forget — never throws.
 */
export function trackTemplateView(templateId: string, userId: string): void {
  writeEvent({ type: 'view', templateId, userId, ts: Date.now() }).catch(
    (err) => {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[sabflow/marketplace/telemetry] trackTemplateView failed:', err);
      }
    },
  );
}

/**
 * Record a successful template install. Fire-and-forget — never throws.
 */
export function trackTemplateInstall(templateId: string, userId: string): void {
  writeEvent({ type: 'install', templateId, userId, ts: Date.now() }).catch(
    (err) => {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[sabflow/marketplace/telemetry] trackTemplateInstall failed:', err);
      }
    },
  );
}

/**
 * Record a marketplace search query and its result count.
 * Fire-and-forget — never throws.
 */
export function trackTemplateSearch(
  query: string,
  resultCount: number,
  userId: string,
): void {
  writeEvent({ type: 'search', query, resultCount, userId, ts: Date.now() }).catch(
    (err) => {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[sabflow/marketplace/telemetry] trackTemplateSearch failed:', err);
      }
    },
  );
}
