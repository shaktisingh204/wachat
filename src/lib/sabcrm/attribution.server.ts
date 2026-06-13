import 'server-only';

/**
 * SabCRM — marketing attribution runtime (server-only).
 *
 * Three responsibilities, all best-effort (a downed DB / SabSense must never
 * break the CRM record mutation that triggered them):
 *
 *   1. {@link recordTouch} — append one marketing {@link Touch} onto a record's
 *      touch history in the `sabcrm_touches` collection (projectId-scoped, the
 *      native-Mongo config pattern of `./scoring.server.ts`). This is the raw
 *      data the attribution report aggregates over.
 *
 *   2. {@link emitCrmEventToSabsense} — forward a CRM lifecycle event
 *      (lead created / stage moved / deal won) to SabSense so it lands in the
 *      same funnel analytics as web events. It reuses the EXISTING public
 *      ingest endpoint `POST /api/sabsense/ingest` (see
 *      `src/app/api/sabsense/ingest/route.ts`) — resolving the project owner's
 *      first active SabSense site's `snippetKey` via `pagesenseSitesApi.list`
 *      and POSTing a synthetic event batch mapped onto the ingest envelope. No
 *      SabSense site → graceful no-op. No new external dependency, no new
 *      ingest surface.
 *
 *   3. {@link buildAttributionReport} — read the project's WON deals + their
 *      touch histories and roll won revenue up by source / campaign under the
 *      chosen {@link AttributionModel} (the pure math in `./attribution.ts`,
 *      re-exported here so callers only import from this file).
 *
 * ## Storage envelope
 *
 * Touches live in their OWN collection (`sabcrm_touches`), NOT on the record's
 * `data` bag — a record can accrue many touches over its lifetime, so a 1:N
 * side collection is the right shape (and it never bumps the record's
 * `updatedAt`). The attribution report reads won deals from `sabcrm_records`
 * (the shared Rust/Mongo records collection — scalar reads need no crate
 * change) and joins each to its touches by `recordId`.
 */

import { connectToDatabase } from '@/lib/mongodb';
import { pagesenseSitesApi } from '@/lib/rust-client/sabsense-sites';
import {
  buildCampaignRollup,
  ATTRIBUTION_MODELS,
  type AttributionModel,
  type AttributableDeal,
  type CampaignRollup,
  type Touch,
} from './attribution';

export {
  buildCampaignRollup,
  attributeDeal,
  creditedTouches,
  sortTouches,
  ATTRIBUTION_MODELS,
  DIRECT_SOURCE,
  NONE_CAMPAIGN,
  type AttributionModel,
  type AttributableDeal,
  type AttributionRow,
  type CampaignRollup,
  type Touch,
} from './attribution';

const TOUCHES_COLL = 'sabcrm_touches';
const RECORDS_COLL = 'sabcrm_records';

/** Touches stored per record (newest discarded above this cap, oldest kept). */
const MAX_TOUCHES_PER_RECORD = 100;
/** Won deals scanned per report (mirrors the forecast/snapshot caps). */
const MAX_DEALS_PER_REPORT = 20_000;

/** The CRM lifecycle events we emit to SabSense funnels. */
export type CrmLifecycleEvent =
  | { type: 'lead.created'; object: string; recordId: string; source?: string; campaign?: string }
  | { type: 'stage.moved'; object: string; recordId: string; fromStage?: string | null; toStage?: string | null }
  | { type: 'deal.won'; object: string; recordId: string; revenue?: number; source?: string; campaign?: string };

/* -------------------------------------------------------------------------- */
/* Coercion helpers (shared with the report aggregation)                       */
/* -------------------------------------------------------------------------- */

/** Numeric coercion tolerant of strings + Twenty CURRENCY (`{ amountMicros }`). */
function num(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o.amountMicros === 'number') return o.amountMicros / 1_000_000;
    if (typeof o.amount === 'number') return o.amount;
  }
  return 0;
}

/** Won/lost/open classification — same heuristic as the forecast snapshots. */
function outcome(data: Record<string, unknown>): 'won' | 'lost' | 'open' {
  const s = String(data.stage ?? data.status ?? '').toLowerCase();
  if (!s) return 'open';
  if (/\bwon\b|customer|closed.?won|complete/.test(s)) return 'won';
  if (/\blost\b|closed.?lost|cancel|reject|dead/.test(s)) return 'lost';
  return 'open';
}

/** Pull a source label from a record's `data` (UTM-style keys, then `source`). */
function dataSource(data: Record<string, unknown>): string | undefined {
  for (const k of ['source', 'leadSource', 'utmSource', 'utm_source', 'channel']) {
    const v = data[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

/** Pull a campaign label from a record's `data` (UTM-style keys). */
function dataCampaign(data: Record<string, unknown>): string | undefined {
  for (const k of ['campaign', 'utmCampaign', 'utm_campaign', 'campaignName']) {
    const v = data[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

/* -------------------------------------------------------------------------- */
/* 1) Touch recording                                                          */
/* -------------------------------------------------------------------------- */

/** Touch doc shape persisted in `sabcrm_touches`. */
interface TouchDoc extends Touch {
  projectId: string;
  object: string;
  recordId: string;
  /** What put this touch on the record (for debugging / future filters). */
  origin?: string;
  createdAt: string;
}

/**
 * Append one marketing touch onto a record's history. Idempotent-ish: a touch
 * with the SAME (recordId, source, campaign, at) is upserted, so re-firing the
 * same lifecycle event never double-counts. Best-effort — never throws.
 */
export async function recordTouch(
  projectId: string,
  object: string,
  recordId: string,
  touch: Touch & { origin?: string },
): Promise<boolean> {
  try {
    if (!projectId || !object || !recordId) return false;
    const source = (touch?.source ?? '').trim();
    if (!source) return false;
    const at = touch?.at && !Number.isNaN(Date.parse(touch.at))
      ? touch.at
      : new Date().toISOString();
    const campaign = touch?.campaign?.trim() || undefined;
    const medium = touch?.medium?.trim() || undefined;

    const { db } = await connectToDatabase();
    const now = new Date().toISOString();
    const doc: Partial<TouchDoc> = {
      source,
      campaign,
      medium,
      at,
      origin: touch?.origin,
    };
    await db.collection(TOUCHES_COLL).updateOne(
      { projectId, recordId, source, campaign: campaign ?? null, at },
      {
        $set: { ...doc, projectId, object, recordId },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );

    // Trim the oldest touches above the per-record cap (cheap, best-effort).
    const count = await db
      .collection(TOUCHES_COLL)
      .countDocuments({ projectId, recordId });
    if (count > MAX_TOUCHES_PER_RECORD) {
      const overflow = await db
        .collection(TOUCHES_COLL)
        .find({ projectId, recordId })
        .sort({ at: 1, _id: 1 })
        .limit(count - MAX_TOUCHES_PER_RECORD)
        .project({ _id: 1 })
        .toArray();
      const ids = overflow.map((d) => d._id);
      if (ids.length) {
        await db.collection(TOUCHES_COLL).deleteMany({ _id: { $in: ids } });
      }
    }
    return true;
  } catch {
    return false; // best-effort
  }
}

/** All touches on one record, oldest first (used to enrich the report). */
async function touchesForRecords(
  projectId: string,
  recordIds: string[],
): Promise<Map<string, Touch[]>> {
  const byRecord = new Map<string, Touch[]>();
  if (!projectId || recordIds.length === 0) return byRecord;
  const { db } = await connectToDatabase();
  const docs = (await db
    .collection(TOUCHES_COLL)
    .find({ projectId, recordId: { $in: recordIds } })
    .sort({ at: 1, _id: 1 })
    .limit(MAX_DEALS_PER_REPORT * 4)
    .toArray()) as unknown as TouchDoc[];
  for (const d of docs) {
    const list = byRecord.get(d.recordId) ?? [];
    list.push({ source: d.source, campaign: d.campaign, medium: d.medium, at: d.at });
    byRecord.set(d.recordId, list);
  }
  return byRecord;
}

/* -------------------------------------------------------------------------- */
/* 2) SabSense emit                                                            */
/* -------------------------------------------------------------------------- */

/** Resolve this project owner's first active SabSense site key (or null). */
async function resolveSabsenseSnippetKey(): Promise<string | null> {
  try {
    const res = await pagesenseSitesApi.list({ limit: 1, status: 'active' });
    const site = res.items?.find((s) => s.isActive !== false) ?? res.items?.[0];
    return site?.snippetKey ?? null;
  } catch {
    return null;
  }
}

/** App origin for the internal ingest POST (Vercel/native both honor this). */
function appBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (url) return url.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

/**
 * Map a CRM lifecycle event onto the SabSense ingest event envelope (the
 * heatmap-event shape the public `/api/sabsense/ingest` validator accepts) and
 * forward it. The mapping is deliberate:
 *
 *   - `url`        — a synthetic `crm://<object>/<event>` URL, so funnel steps
 *                    can match on `url` (the funnel `matchType: 'url'` path).
 *   - `eventType`  — always `'click'` (the funnel engine treats any event as a
 *                    step hit; click is the canonical interaction type).
 *   - `sessionId`  — the recordId, so a deal's whole journey shares a session.
 *   - `variant`    — the source/campaign label, surfaced as the event's tag.
 *
 * Best-effort: any failure (no SabSense site, ingest down, network) is
 * swallowed. Returns true only when SabSense accepted the batch.
 */
export async function emitCrmEventToSabsense(
  projectId: string,
  event: CrmLifecycleEvent,
): Promise<boolean> {
  try {
    if (!projectId || !event?.recordId) return false;
    const snippetKey = await resolveSabsenseSnippetKey();
    if (!snippetKey) return false; // project has no SabSense site → no-op

    const tag =
      'source' in event && event.source
        ? `${event.source}${'campaign' in event && event.campaign ? `/${event.campaign}` : ''}`
        : event.type;

    const payload = {
      snippetKey,
      events: [
        {
          url: `crm://${event.object}/${event.type}`,
          eventType: 'click' as const,
          x: 0,
          y: 0,
          viewportW: 0,
          viewportH: 0,
          sessionId: event.recordId,
          variant: tag,
          ts: Date.now(),
        },
      ],
    };

    const res = await fetch(`${appBaseUrl()}/api/sabsense/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    return res.ok;
  } catch {
    return false; // best-effort
  }
}

/* -------------------------------------------------------------------------- */
/* 3) Attribution report                                                       */
/* -------------------------------------------------------------------------- */

export interface AttributionReportOptions {
  model: AttributionModel;
  /** Optional object slug to scope to (default: every object with won deals). */
  objectSlug?: string;
  /** Optional won-date window (ISO strings); filters by `data.closeDate`/won meta. */
  dateRange?: { from?: string; to?: string };
}

export interface AttributionReport extends CampaignRollup {
  /** Echo of the object scope (or `all`). */
  objectSlug: string;
  /** Number of won deals that had at least one recorded touch. */
  dealsWithTouches: number;
}

/** Coerce a model string to a valid {@link AttributionModel} (default linear). */
export function coerceModel(m: unknown): AttributionModel {
  return ATTRIBUTION_MODELS.includes(m as AttributionModel)
    ? (m as AttributionModel)
    : 'linear';
}

/** A record's won-date for the date filter (closeDate → outcomeAt → updatedAt). */
function wonAt(data: Record<string, unknown>, fallback?: string): string | undefined {
  for (const k of ['closeDate', 'wonAt', 'outcomeAt', 'expectedCloseDate']) {
    const v = data[k];
    if (typeof v === 'string' && v.trim()) return v;
    if (v instanceof Date) return v.toISOString();
  }
  return fallback;
}

/** True when `iso` is within the (optional) inclusive `dateRange`. */
function inRange(iso: string | undefined, range?: { from?: string; to?: string }): boolean {
  if (!range || (!range.from && !range.to)) return true;
  if (!iso) return true; // undated deals are never filtered out
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return true;
  if (range.from) {
    const f = Date.parse(range.from);
    if (Number.isFinite(f) && t < f) return false;
  }
  if (range.to) {
    const to = Date.parse(range.to);
    if (Number.isFinite(to) && t > to) return false;
  }
  return true;
}

/**
 * Build the attribution report: aggregate WON-deal revenue by source / campaign
 * under `model`. Deals are read from `sabcrm_records` (won via the stage
 * heuristic), joined to their touch history in `sabcrm_touches`, and a deal with
 * NO recorded touches falls back to its own `data` UTM/source fields (then the
 * synthetic `(direct)` channel) so its revenue is never dropped. Best-effort —
 * a read failure returns a zeroed report rather than throwing.
 */
export async function buildAttributionReport(
  projectId: string,
  options: AttributionReportOptions,
): Promise<AttributionReport> {
  const model = coerceModel(options?.model);
  const objectSlug = options?.objectSlug?.trim() || '';
  const empty: AttributionReport = {
    model,
    objectSlug: objectSlug || 'all',
    totalRevenue: 0,
    totalDeals: 0,
    dealsWithTouches: 0,
    bySource: [],
    byCampaign: [],
  };
  try {
    if (!projectId) return empty;
    const { db } = await connectToDatabase();

    const query: Record<string, unknown> = {
      projectId,
      deletedAt: { $in: [null] },
    };
    if (objectSlug) query.object = objectSlug;

    const recs = (await db
      .collection(RECORDS_COLL)
      .find(query)
      .project({ data: 1, updatedAt: 1 })
      .limit(MAX_DEALS_PER_REPORT)
      .toArray()) as Array<{ _id: unknown; data?: Record<string, unknown>; updatedAt?: string }>;

    // Keep only won deals inside the date window with positive revenue.
    const won = recs
      .map((r) => ({ id: String(r._id), data: r.data ?? {}, updatedAt: r.updatedAt }))
      .filter((r) => outcome(r.data) === 'won')
      .filter((r) => inRange(wonAt(r.data, r.updatedAt), options?.dateRange))
      .map((r) => ({ id: r.id, data: r.data, revenue: num(r.data.amount) }));

    if (won.length === 0) return empty;

    const touchMap = await touchesForRecords(
      projectId,
      won.map((w) => w.id),
    );

    let dealsWithTouches = 0;
    const deals: AttributableDeal[] = won.map((w) => {
      const recorded = touchMap.get(w.id) ?? [];
      if (recorded.length > 0) {
        dealsWithTouches += 1;
        return { recordId: w.id, revenue: w.revenue, touches: recorded };
      }
      // Fallback to the record's own source/campaign fields (single touch).
      const src = dataSource(w.data);
      const touches: Touch[] = src
        ? [{ source: src, campaign: dataCampaign(w.data), at: wonAt(w.data, '') ?? '' }]
        : [];
      return { recordId: w.id, revenue: w.revenue, touches };
    });

    const rollup = buildCampaignRollup(deals, model);
    return {
      ...rollup,
      objectSlug: objectSlug || 'all',
      dealsWithTouches,
    };
  } catch {
    return empty;
  }
}

/** Ensure the touch lookup index (best-effort; called from the report path). */
export async function ensureTouchIndexes(): Promise<void> {
  try {
    const { db } = await connectToDatabase();
    await db
      .collection(TOUCHES_COLL)
      .createIndex({ projectId: 1, recordId: 1, at: 1 });
  } catch {
    /* best-effort */
  }
}
