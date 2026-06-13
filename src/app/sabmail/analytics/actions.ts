'use server';

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSabmailWorkspaceId } from '@/lib/sabmail/workspace';
import { SABMAIL_COLLECTIONS } from '@/lib/sabmail/db/collections';
import { getErrorMessage } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────────────────
 * SabMail analytics — read-only dashboard aggregation.
 *
 * Reads from EXISTING collections only (no writes, no new collection):
 *   · campaigns  → total count, summed `sent` / `failed`, recent rows
 *   · accounts   → connected mailbox count
 *   · contacts   → contact count
 *   · events     → deliverability stream (delivered/open/click/bounce/…)
 *                  written by the signed webhook
 *                  `/api/webhooks/sabmail-events/[provider]`.
 *
 * Every query is scoped by the active workspace (`{ workspaceId }`); a single
 * `Result<T>` discriminated union mirrors the inbox actions pattern.
 * ──────────────────────────────────────────────────────────────────── */

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

export interface SabmailAnalyticsKpis {
  campaigns: number;
  sent: number;
  failed: number;
  accounts: number;
  contacts: number;
}

export interface SabmailRecentCampaign {
  id: string;
  name: string;
  status: string;
  sent: number;
  failed: number;
  createdAt: string | null;
}

/** Loose shape for a campaign doc — only the fields this dashboard reads. */
interface CampaignDoc {
  _id: unknown;
  name?: unknown;
  status?: unknown;
  sent?: unknown;
  failed?: unknown;
  createdAt?: unknown;
}

function num(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value as string | number);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function getSabmailAnalytics(): Promise<
  Result<{
    kpis: SabmailAnalyticsKpis;
    recentCampaigns: SabmailRecentCampaign[];
  }>
> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };

  try {
    const { db } = await connectToDatabase();
    const campaignsCol = db.collection(SABMAIL_COLLECTIONS.campaigns);
    const accountsCol = db.collection(SABMAIL_COLLECTIONS.accounts);
    const contactsCol = db.collection(SABMAIL_COLLECTIONS.contacts);

    const [campaignCount, accounts, contacts, totals, recentDocs] =
      await Promise.all([
        campaignsCol.countDocuments({ workspaceId }),
        accountsCol.countDocuments({ workspaceId, status: 'active' }),
        contactsCol.countDocuments({ workspaceId }),
        campaignsCol
          .aggregate<{ sent: number; failed: number }>([
            { $match: { workspaceId } },
            {
              $group: {
                _id: null,
                sent: { $sum: { $ifNull: ['$sent', 0] } },
                failed: { $sum: { $ifNull: ['$failed', 0] } },
              },
            },
          ])
          .toArray(),
        campaignsCol
          .find({ workspaceId })
          .sort({ createdAt: -1 })
          .limit(8)
          .toArray(),
      ]);

    const agg = totals[0] ?? { sent: 0, failed: 0 };

    const recentCampaigns: SabmailRecentCampaign[] = (
      recentDocs as unknown as CampaignDoc[]
    ).map((d) => ({
      id: String(d._id),
      name: typeof d.name === 'string' && d.name.trim() ? d.name : 'Untitled campaign',
      status: typeof d.status === 'string' && d.status ? d.status : 'draft',
      sent: num(d.sent),
      failed: num(d.failed),
      createdAt: toIso(d.createdAt),
    }));

    return {
      ok: true,
      kpis: {
        campaigns: campaignCount,
        sent: num(agg.sent),
        failed: num(agg.failed),
        accounts,
        contacts,
      },
      recentCampaigns,
    };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

/* ──────────────────────────────────────────────────────────────────────
 * Deliverability — aggregate the `events` stream (sabmail_events).
 *
 * The event doc (written by the webhook) carries: { workspaceId, provider,
 * event ∈ delivered|open|click|bounce|complaint|unsubscribe|deferred|
 * dropped|other, email, messageId, ts (ms epoch number), bounceType,
 * machineOpen, raw, createdAt, … }.  `campaignId` is OPTIONAL — present only
 * once the sender stamps it; the per-campaign breakdown is forward-compatible
 * and simply returns an empty list until then.
 *
 * Every aggregate lives in its OWN try/catch returning zeros so one malformed
 * doc can never 500 the dashboard. `sent` is sourced from the campaign rollup
 * (the webhook never emits a "sent" event) so delivery-rate has a denominator.
 * ──────────────────────────────────────────────────────────────────── */

const EVENT_NAMES = [
  'delivered',
  'open',
  'click',
  'bounce',
  'complaint',
  'unsubscribe',
  'deferred',
  'dropped',
  'other',
] as const;

type SabmailEventName = (typeof EVENT_NAMES)[number];

/** Counts keyed by every known event name (always fully populated). */
export type SabmailEventCounts = Record<SabmailEventName, number>;

export interface SabmailDeliverabilityRates {
  /** delivered / (delivered + bounce) — share of accepted mail. */
  deliveryRate: number;
  /** open / delivered. */
  openRate: number;
  /** click / delivered. */
  clickRate: number;
  /** bounce / (delivered + bounce). */
  bounceRate: number;
  /** complaint / delivered. */
  complaintRate: number;
  /** unsubscribe / delivered. */
  unsubRate: number;
}

export interface SabmailDeliverabilityWindow {
  counts: SabmailEventCounts;
  rates: SabmailDeliverabilityRates;
  /** Sum of all recorded events in this window. */
  total: number;
}

export interface SabmailDeliverabilityDay {
  /** UTC day key `YYYY-MM-DD`. */
  date: string;
  delivered: number;
  open: number;
  click: number;
  bounce: number;
}

export interface SabmailDeliverabilityCampaign {
  campaignId: string;
  name: string;
  delivered: number;
  open: number;
  click: number;
  bounce: number;
  openRate: number;
  clickRate: number;
}

export interface SabmailDeliverabilityStats {
  /** All-time. */
  overall: SabmailDeliverabilityWindow;
  /** Rolling last-30-days window. */
  last30d: SabmailDeliverabilityWindow;
  /** Per-day series, last 14 UTC days (gap-filled, oldest → newest). */
  series: SabmailDeliverabilityDay[];
  /** Top campaigns by delivered volume (best-effort name join). */
  topCampaigns: SabmailDeliverabilityCampaign[];
  /** True when the events collection has at least one doc for this workspace. */
  hasEvents: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function emptyCounts(): SabmailEventCounts {
  return {
    delivered: 0,
    open: 0,
    click: 0,
    bounce: 0,
    complaint: 0,
    unsubscribe: 0,
    deferred: 0,
    dropped: 0,
    other: 0,
  };
}

function safeRate(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return 0;
  if (denominator <= 0) return 0;
  const r = numerator / denominator;
  return Number.isFinite(r) ? Math.max(0, Math.min(1, r)) : 0;
}

function ratesFromCounts(counts: SabmailEventCounts): SabmailDeliverabilityRates {
  const accepted = counts.delivered + counts.bounce; // attempted-and-resolved
  return {
    deliveryRate: safeRate(counts.delivered, accepted),
    openRate: safeRate(counts.open, counts.delivered),
    clickRate: safeRate(counts.click, counts.delivered),
    bounceRate: safeRate(counts.bounce, accepted),
    complaintRate: safeRate(counts.complaint, counts.delivered),
    unsubRate: safeRate(counts.unsubscribe, counts.delivered),
  };
}

function emptyWindow(): SabmailDeliverabilityWindow {
  const counts = emptyCounts();
  return { counts, rates: ratesFromCounts(counts), total: 0 };
}

/** Fold a `$group _id:$event` aggregation result into a full counts map. */
function foldCounts(
  rows: Array<{ _id: unknown; count: unknown }>,
): SabmailDeliverabilityWindow {
  const counts = emptyCounts();
  for (const row of rows) {
    const name = String(row._id ?? 'other');
    const key = (EVENT_NAMES as readonly string[]).includes(name)
      ? (name as SabmailEventName)
      : 'other';
    counts[key] += num(row.count);
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { counts, rates: ratesFromCounts(counts), total };
}

function utcDayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export async function getSabmailDeliverabilityStats(): Promise<
  Result<{ stats: SabmailDeliverabilityStats }>
> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };

  let db;
  try {
    ({ db } = await connectToDatabase());
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }

  const events = db.collection(SABMAIL_COLLECTIONS.events);
  const campaignsCol = db.collection(SABMAIL_COLLECTIONS.campaigns);
  const now = Date.now();
  const since30 = now - 30 * DAY_MS;
  const since14 = now - 14 * DAY_MS;

  // --- hasEvents (own try/catch) -------------------------------------
  let hasEvents = false;
  try {
    hasEvents = (await events.countDocuments({ workspaceId }, { limit: 1 })) > 0;
  } catch {
    hasEvents = false;
  }

  // --- overall counts (own try/catch) --------------------------------
  let overall = emptyWindow();
  try {
    const rows = await events
      .aggregate<{ _id: unknown; count: unknown }>([
        { $match: { workspaceId } },
        { $group: { _id: '$event', count: { $sum: 1 } } },
      ])
      .toArray();
    overall = foldCounts(rows);
  } catch {
    overall = emptyWindow();
  }

  // --- last-30-days counts (own try/catch) ---------------------------
  let last30d = emptyWindow();
  try {
    const rows = await events
      .aggregate<{ _id: unknown; count: unknown }>([
        { $match: { workspaceId, ts: { $gte: since30 } } },
        { $group: { _id: '$event', count: { $sum: 1 } } },
      ])
      .toArray();
    last30d = foldCounts(rows);
  } catch {
    last30d = emptyWindow();
  }

  // --- 14-day per-day series (own try/catch, gap-filled) -------------
  let series: SabmailDeliverabilityDay[] = [];
  try {
    const rows = await events
      .aggregate<{
        _id: { day: unknown; event: unknown };
        count: unknown;
      }>([
        { $match: { workspaceId, ts: { $gte: since14 } } },
        {
          $group: {
            _id: {
              day: {
                // Day-truncate the numeric `ts` (ms epoch) in UTC.
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: { $toDate: '$ts' },
                  timezone: 'UTC',
                },
              },
              event: '$event',
            },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    // Index counts by day → event.
    const byDay = new Map<string, Partial<Record<SabmailEventName, number>>>();
    for (const row of rows) {
      const day = String(row._id?.day ?? '');
      if (!day) continue;
      const name = String(row._id?.event ?? 'other');
      const key = (EVENT_NAMES as readonly string[]).includes(name)
        ? (name as SabmailEventName)
        : 'other';
      const bucket = byDay.get(day) ?? {};
      bucket[key] = (bucket[key] ?? 0) + num(row.count);
      byDay.set(day, bucket);
    }

    // Gap-fill the last 14 UTC days oldest → newest.
    const out: SabmailDeliverabilityDay[] = [];
    for (let i = 13; i >= 0; i -= 1) {
      const date = utcDayKey(now - i * DAY_MS);
      const b = byDay.get(date) ?? {};
      out.push({
        date,
        delivered: num(b.delivered),
        open: num(b.open),
        click: num(b.click),
        bounce: num(b.bounce),
      });
    }
    series = out;
  } catch {
    series = [];
  }

  // --- top campaigns (own try/catch, best-effort name join) ----------
  let topCampaigns: SabmailDeliverabilityCampaign[] = [];
  try {
    const rows = await events
      .aggregate<{
        _id: { campaignId: unknown; event: unknown };
        count: unknown;
      }>([
        // Only events that actually carry a campaignId contribute.
        {
          $match: {
            workspaceId,
            campaignId: { $exists: true, $nin: [null, ''] },
          },
        },
        {
          $group: {
            _id: { campaignId: '$campaignId', event: '$event' },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    const byCampaign = new Map<
      string,
      { delivered: number; open: number; click: number; bounce: number }
    >();
    for (const row of rows) {
      const cid = String(row._id?.campaignId ?? '');
      if (!cid) continue;
      const name = String(row._id?.event ?? 'other');
      const bucket =
        byCampaign.get(cid) ?? { delivered: 0, open: 0, click: 0, bounce: 0 };
      if (name === 'delivered') bucket.delivered += num(row.count);
      else if (name === 'open') bucket.open += num(row.count);
      else if (name === 'click') bucket.click += num(row.count);
      else if (name === 'bounce') bucket.bounce += num(row.count);
      byCampaign.set(cid, bucket);
    }

    const ranked = [...byCampaign.entries()]
      .sort((a, b) => b[1].delivered - a[1].delivered)
      .slice(0, 6);

    // Best-effort name join — skip silently if the lookup fails.
    const names = new Map<string, string>();
    if (ranked.length > 0) {
      try {
        const ids = ranked.map(([id]) => id);
        const objectIds: ObjectId[] = [];
        for (const id of ids) {
          if (ObjectId.isValid(id)) objectIds.push(new ObjectId(id));
        }
        const or: Record<string, unknown>[] = [{ _id: { $in: ids } }];
        if (objectIds.length > 0) or.push({ _id: { $in: objectIds } });
        const docs = await campaignsCol
          .find(
            { workspaceId, $or: or },
            { projection: { name: 1 } },
          )
          .toArray();
        for (const d of docs as unknown as CampaignDoc[]) {
          const nm =
            typeof d.name === 'string' && d.name.trim() ? d.name : '';
          if (nm) names.set(String(d._id), nm);
        }
      } catch {
        /* name join is best-effort */
      }
    }

    topCampaigns = ranked.map(([cid, b]) => ({
      campaignId: cid,
      name: names.get(cid) ?? 'Untitled campaign',
      delivered: b.delivered,
      open: b.open,
      click: b.click,
      bounce: b.bounce,
      openRate: safeRate(b.open, b.delivered),
      clickRate: safeRate(b.click, b.delivered),
    }));
  } catch {
    topCampaigns = [];
  }

  return {
    ok: true,
    stats: { overall, last30d, series, topCampaigns, hasEvents },
  };
}
