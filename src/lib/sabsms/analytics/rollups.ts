/**
 * SabSMS analytics rollups (V2.10) — `sabsms_stats_daily`.
 *
 * One document per (workspace, UTC day, dim-combo). The events consumer
 * calls [`bumpStats`] for every engine event; the analytics pages run
 * cheap range queries over this collection instead of aggregating
 * millions of `sabsms_messages` docs per page load.
 *
 * Dim-combo policy (BOUNDED on purpose): every event writes at most
 * THREE granularities —
 *
 *   1. total        dims `{}`               (always)
 *   2. by-provider  dims `{ provider }`     (when the provider is known)
 *   3. by-campaign  dims `{ campaignId }`   (when the campaign is known)
 *
 * `country` / `channel` / `category` exist in the dims type for the
 * backfill/reconcile path to use later, but the live consumer never
 * fans out beyond the three combos above, so the collection grows
 * O(days × (1 + providers + campaigns)) per workspace.
 *
 * Counter semantics: counters are EVENT counts bucketed on the event's
 * own day (a message sent on Mon and delivered on Tue increments
 * Mon.sent and Tue.delivered). `costCents`/`creditsSpent` cannot be
 * derived from the event payloads (they carry no pricing), so the live
 * consumer leaves them at 0 — the backfill script and
 * [`../analytics/reconcile`] fill them from `sabsms_messages`.
 *
 * Replay caveat: `$inc` is not idempotent under the stream's
 * at-least-once delivery. Rare redeliveries can over-count by a few
 * events; the nightly/On-demand reconcile recomputes the day from raw
 * and replaces the rollup, which is the designed corrector.
 *
 * Worker-safe: relative imports only, no `server-only`.
 */

import { ObjectId, type Db } from 'mongodb';

import type { SabsmsEngineEvent } from '../events/consumer';

export const SABSMS_STATS_DAILY_COLLECTION = 'sabsms_stats_daily';

// ─── Shapes ────────────────────────────────────────────────────────────────

export interface SabsmsStatsDims {
  provider?: string;
  country?: string;
  campaignId?: string;
  channel?: string;
  category?: string;
}

export interface SabsmsStatsCounters {
  queued: number;
  sent: number;
  delivered: number;
  failed: number;
  inbound: number;
  optOuts: number;
  clicks: number;
  segments: number;
  costCents: number;
  creditsSpent: number;
}

export interface SabsmsStatsDailyDoc {
  workspaceId: string;
  /** UTC day, `YYYY-MM-DD`. */
  date: string;
  dims: SabsmsStatsDims;
  /** Stable stringified dims — the unique-index key component. */
  dimsKey: string;
  counters: Partial<SabsmsStatsCounters>;
  updatedAt: Date;
}

export const COUNTER_FIELDS = [
  'queued',
  'sent',
  'delivered',
  'failed',
  'inbound',
  'optOuts',
  'clicks',
  'segments',
  'costCents',
  'creditsSpent',
] as const satisfies ReadonlyArray<keyof SabsmsStatsCounters>;

export function zeroCounters(): SabsmsStatsCounters {
  return {
    queued: 0,
    sent: 0,
    delivered: 0,
    failed: 0,
    inbound: 0,
    optOuts: 0,
    clicks: 0,
    segments: 0,
    costCents: 0,
    creditsSpent: 0,
  };
}

/** Fill sparse Mongo counters (live `$inc` docs omit untouched fields). */
export function normalizeCounters(
  raw: Partial<SabsmsStatsCounters> | undefined,
): SabsmsStatsCounters {
  const out = zeroCounters();
  if (!raw) return out;
  for (const f of COUNTER_FIELDS) {
    const v = raw[f];
    if (typeof v === 'number' && Number.isFinite(v)) out[f] = v;
  }
  return out;
}

/**
 * Stable stringified dims: keys sorted, empty/undefined values dropped.
 * `{}` for the total row. The SAME input dims must always produce the
 * SAME key regardless of property insertion order.
 */
export function dimsKey(dims: SabsmsStatsDims): string {
  const entries = Object.entries(dims)
    .filter((e): e is [string, string] => typeof e[1] === 'string' && e[1] !== '')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return JSON.stringify(Object.fromEntries(entries));
}

/** UTC `YYYY-MM-DD` for an epoch-ms stamp (0/invalid → today). */
export function utcDateKey(atMs: number): string {
  const t = Number.isFinite(atMs) && atMs > 0 ? atMs : Date.now();
  return new Date(t).toISOString().slice(0, 10);
}

// ─── Event → counter mapping (pure; unit-tested) ──────────────────────────

/**
 * Map one engine event to counter increments. Returns `null` for kinds
 * the rollup ignores (campaign lifecycle, compliance, routeFailover,
 * and any UNKNOWN/future kind — otpSent / otpVerified / fraudBlocked
 * land here gracefully until they get their own counters).
 */
export function incrementsForEvent(
  event: Pick<SabsmsEngineEvent, 'kind' | 'payload'>,
): Partial<SabsmsStatsCounters> | null {
  switch (event.kind) {
    case 'messageQueued':
      return { queued: 1 };
    case 'messageSent': {
      const raw = Number(event.payload.segments);
      const segments = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1;
      return { sent: 1, segments };
    }
    case 'messageDelivered':
      return { delivered: 1 };
    case 'messageFailed':
      return { failed: 1 };
    case 'messageInbound':
      return { inbound: 1 };
    case 'contactUnsubscribed':
      return { optOuts: 1 };
    case 'linkClicked':
      return { clicks: 1 };
    default:
      return null;
  }
}

const MESSAGE_SCOPED_KINDS = new Set([
  'messageQueued',
  'messageSent',
  'messageDelivered',
  'messageFailed',
  'messageInbound',
]);

/** Minimal db surface so tests can stub without a real MongoClient. */
export interface StatsDbLike {
  collection(name: string): {
    updateOne(filter: unknown, update: unknown, options?: unknown): Promise<unknown>;
    findOne(filter: unknown, options?: unknown): Promise<Record<string, unknown> | null>;
  };
}

/**
 * Resolve the dims for an event. Message-scoped kinds do ONE indexed
 * `sabsms_messages` `_id` read to attribute provider + campaign (the
 * payloads only carry ids); `linkClicked` reads its campaignId straight
 * off the pseudo-event payload.
 */
export async function dimsForEvent(
  db: StatsDbLike,
  event: Pick<SabsmsEngineEvent, 'kind' | 'payload'>,
): Promise<SabsmsStatsDims> {
  const dims: SabsmsStatsDims = {};

  if (event.kind === 'linkClicked') {
    const campaignId = event.payload.campaignId;
    if (typeof campaignId === 'string' && campaignId) dims.campaignId = campaignId;
    return dims;
  }

  if (typeof event.payload.provider === 'string' && event.payload.provider) {
    dims.provider = event.payload.provider;
  }

  if (MESSAGE_SCOPED_KINDS.has(event.kind)) {
    const messageId = event.payload.messageId;
    if (typeof messageId === 'string' && ObjectId.isValid(messageId)) {
      const msg = await db.collection('sabsms_messages').findOne(
        { _id: new ObjectId(messageId) },
        { projection: { provider: 1, campaignId: 1 } },
      );
      if (msg) {
        if (!dims.provider && typeof msg.provider === 'string' && msg.provider) {
          dims.provider = msg.provider;
        }
        if (typeof msg.campaignId === 'string' && msg.campaignId) {
          dims.campaignId = msg.campaignId;
        }
      }
    }
  }

  return dims;
}

/** The bounded dim-combo fan-out: total, by-provider, by-campaign. */
export function dimCombos(dims: SabsmsStatsDims): SabsmsStatsDims[] {
  const combos: SabsmsStatsDims[] = [{}];
  if (dims.provider) combos.push({ provider: dims.provider });
  if (dims.campaignId) combos.push({ campaignId: dims.campaignId });
  return combos;
}

// ─── Live consumer write path ─────────────────────────────────────────────

/**
 * `$inc` the day's rollup docs for one engine event. Unknown kinds are
 * a graceful no-op. Returns the number of dim-combo docs bumped.
 */
export async function bumpStats(
  db: StatsDbLike,
  event: SabsmsEngineEvent,
): Promise<{ bumped: number }> {
  const inc = incrementsForEvent(event);
  if (!inc) return { bumped: 0 };

  const workspaceId =
    typeof event.payload.workspaceId === 'string' ? event.payload.workspaceId : '';
  if (!workspaceId) return { bumped: 0 };

  const date = utcDateKey(event.at);
  const dims = await dimsForEvent(db, event);
  const combos = dimCombos(dims);
  const col = db.collection(SABSMS_STATS_DAILY_COLLECTION);

  const incDoc: Record<string, number> = {};
  for (const [k, v] of Object.entries(inc)) {
    if (typeof v === 'number' && v !== 0) incDoc[`counters.${k}`] = v;
  }
  if (Object.keys(incDoc).length === 0) return { bumped: 0 };

  for (const combo of combos) {
    await col.updateOne(
      { workspaceId, date, dimsKey: dimsKey(combo) },
      {
        $inc: incDoc,
        $set: { updatedAt: new Date() },
        $setOnInsert: { workspaceId, date, dims: combo, dimsKey: dimsKey(combo) },
      },
      { upsert: true },
    );
  }
  return { bumped: combos.length };
}

// ─── Indexes ──────────────────────────────────────────────────────────────

export async function ensureStatsIndexes(db: Db): Promise<void> {
  const col = db.collection(SABSMS_STATS_DAILY_COLLECTION);
  await col.createIndex({ workspaceId: 1, date: 1, dimsKey: 1 }, { unique: true });
  // Range scans by day for the dashboard's "by provider/campaign" views.
  await col.createIndex({ workspaceId: 1, dimsKey: 1, date: 1 });
}

// ─── Read path (analytics pages) ──────────────────────────────────────────

export type SabsmsStatsDim = 'total' | 'provider' | 'campaignId';

export interface SabsmsStatsRow {
  date: string;
  dims: SabsmsStatsDims;
  counters: SabsmsStatsCounters;
}

export interface StatsRangeQuery {
  workspaceId: string;
  /** Inclusive UTC day keys, `YYYY-MM-DD`. */
  fromDate: string;
  toDate: string;
  dim: SabsmsStatsDim;
}

/**
 * Range query over the rollups. `dim: 'total'` returns the `{}` rows;
 * `'provider'` / `'campaignId'` return the single-dim rows for that
 * dimension. Sorted by date ascending.
 */
export async function queryDailyStats(
  db: Db,
  q: StatsRangeQuery,
): Promise<SabsmsStatsRow[]> {
  const filter: Record<string, unknown> = {
    workspaceId: q.workspaceId,
    date: { $gte: q.fromDate, $lte: q.toDate },
  };
  if (q.dim === 'total') {
    filter.dimsKey = '{}';
  } else {
    filter[`dims.${q.dim}`] = { $exists: true };
  }
  const docs = await db
    .collection<SabsmsStatsDailyDoc>(SABSMS_STATS_DAILY_COLLECTION)
    .find(filter as never)
    .sort({ date: 1 })
    .limit(5_000)
    .toArray();
  return docs.map((d) => ({
    date: d.date,
    dims: d.dims ?? {},
    counters: normalizeCounters(d.counters),
  }));
}

/** Sum a row set into one counter block. */
export function sumCounters(rows: SabsmsStatsRow[]): SabsmsStatsCounters {
  const total = zeroCounters();
  for (const row of rows) {
    for (const f of COUNTER_FIELDS) total[f] += row.counters[f];
  }
  return total;
}

export interface SabsmsStatsKpis extends SabsmsStatsCounters {
  /**
   * delivered / sent, % 1dp. Unlike the status-bucket KPIs, rollup
   * `sent` counts every messageSent EVENT (later-delivered messages
   * included), so delivered is a subset of sent.
   */
  deliveryRatePct: number;
  /** clicks / delivered, % 1dp. */
  ctrPct: number;
}

export function kpisFromRows(rows: SabsmsStatsRow[]): SabsmsStatsKpis {
  const t = sumCounters(rows);
  const deliveryRatePct = t.sent > 0 ? Math.round((t.delivered / t.sent) * 1000) / 10 : 0;
  const ctrPct = t.delivered > 0 ? Math.round((t.clicks / t.delivered) * 1000) / 10 : 0;
  return { ...t, deliveryRatePct, ctrPct };
}

/** Collapse single-dim rows into per-bucket totals (provider/campaign tables). */
export function groupRowsByDim(
  rows: SabsmsStatsRow[],
  dim: 'provider' | 'campaignId',
): Array<{ bucket: string; counters: SabsmsStatsCounters }> {
  const map = new Map<string, SabsmsStatsCounters>();
  for (const row of rows) {
    const bucket = row.dims[dim];
    if (!bucket) continue;
    let acc = map.get(bucket);
    if (!acc) {
      acc = zeroCounters();
      map.set(bucket, acc);
    }
    for (const f of COUNTER_FIELDS) acc[f] += row.counters[f];
  }
  return Array.from(map.entries())
    .map(([bucket, counters]) => ({ bucket, counters }))
    .sort(
      (a, b) =>
        b.counters.sent + b.counters.delivered - (a.counters.sent + a.counters.delivered),
    );
}

/** Merge total-rows into a dense day series (missing days → zeros). */
export function seriesFromRows(
  rows: SabsmsStatsRow[],
  fromDate: string,
  toDate: string,
): Array<{ date: string } & SabsmsStatsCounters> {
  const byDate = new Map<string, SabsmsStatsCounters>();
  for (const row of rows) {
    const acc = byDate.get(row.date) ?? zeroCounters();
    for (const f of COUNTER_FIELDS) acc[f] += row.counters[f];
    byDate.set(row.date, acc);
  }
  const out: Array<{ date: string } & SabsmsStatsCounters> = [];
  const cursor = new Date(`${fromDate}T00:00:00.000Z`);
  const end = new Date(`${toDate}T00:00:00.000Z`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime())) return out;
  // Hard cap so a bad range can never spin (366 days).
  for (let i = 0; cursor <= end && i < 366; i += 1) {
    const key = cursor.toISOString().slice(0, 10);
    out.push({ date: key, ...(byDate.get(key) ?? zeroCounters()) });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}
