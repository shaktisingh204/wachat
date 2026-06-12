/**
 * SabSMS rollup reconciliation (V2.10) — recompute one (workspace, day)
 * from the RAW collections and compare/replace the `sabsms_stats_daily`
 * docs.
 *
 * The live consumer's `$inc` path is at-least-once (replays can
 * over-count) and carries no pricing data — this module is the
 * corrector. The recompute logic is split into pure functions
 * ([`foldRawIntoDay`], [`diffDayStats`]) so the drift math is
 * unit-testable without Mongo; [`reconcileDay`] is the thin db wrapper
 * the analytics page's "Recompute" action calls.
 *
 * Pricing enrichment: `costCents` comes from `sabsms_messages.cost`
 * (stored in currency units → ×100, rounded) and `creditsSpent` from
 * the live rate card (`creditCostFor`) — both bucketed on the SENT day,
 * mirroring when the spend was incurred.
 *
 * Worker-safe: relative imports only, no `server-only`.
 */

import { countryFromE164 } from '../phone';
import { creditCostFor } from '../credits/rates';
import type { SabsmsChannel } from '../types';
import {
  COUNTER_FIELDS,
  dimCombos,
  dimsKey,
  normalizeCounters,
  zeroCounters,
  SABSMS_STATS_DAILY_COLLECTION,
  type SabsmsStatsCounters,
  type SabsmsStatsDims,
} from './rollups';

// ─── Raw shapes (projections of the canonical collections) ────────────────

export interface RawMessageSlice {
  direction?: string;
  provider?: string;
  campaignId?: string;
  channel?: string;
  to?: string;
  segmentsCount?: number;
  cost?: number;
  createdAt?: Date;
  queuedAt?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
}

export interface RawClickSlice {
  campaignId?: string;
  clickedAt?: Date;
}

export interface RawConsentSlice {
  kind?: string;
  createdAt?: Date;
}

export interface RawDayInput {
  messages: RawMessageSlice[];
  clicks: RawClickSlice[];
  optOuts: RawConsentSlice[];
}

export interface ComputedDayStats {
  /** dimsKey → { dims, counters } for the bounded three granularities. */
  byKey: Map<string, { dims: SabsmsStatsDims; counters: SabsmsStatsCounters }>;
}

const OPT_OUT_KINDS = new Set([
  'opt_out_stop',
  'opt_out_manual',
  'opt_out_complaint',
  'opt_out_carrier_block',
]);

function dayWindow(date: string): { from: Date; to: Date } {
  const from = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(from.getTime())) {
    throw new Error(`reconcileDay: invalid date "${date}" (expected YYYY-MM-DD)`);
  }
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  return { from, to };
}

function inWindow(d: Date | undefined, from: Date, to: Date): boolean {
  return d instanceof Date && d >= from && d < to;
}

function addInto(
  out: ComputedDayStats,
  dims: SabsmsStatsDims,
  inc: Partial<SabsmsStatsCounters>,
): void {
  for (const combo of dimCombos(dims)) {
    const key = dimsKey(combo);
    let slot = out.byKey.get(key);
    if (!slot) {
      slot = { dims: combo, counters: zeroCounters() };
      out.byKey.set(key, slot);
    }
    for (const f of COUNTER_FIELDS) {
      const v = inc[f];
      if (typeof v === 'number' && v !== 0) slot.counters[f] += v;
    }
  }
}

/**
 * Pure fold: raw day slices → expected rollup counter map. Mirrors the
 * live `bumpStats` event semantics (each lifecycle stamp counts on its
 * own day) plus the pricing enrichment the live path can't do.
 */
export function foldRawIntoDay(date: string, raw: RawDayInput): ComputedDayStats {
  const { from, to } = dayWindow(date);
  const out: ComputedDayStats = { byKey: new Map() };

  for (const m of raw.messages) {
    const dims: SabsmsStatsDims = {};
    if (m.provider) dims.provider = m.provider;
    if (m.campaignId) dims.campaignId = m.campaignId;

    if (m.direction === 'inbound') {
      if (inWindow(m.createdAt, from, to)) addInto(out, dims, { inbound: 1 });
      continue;
    }

    if (inWindow(m.queuedAt ?? m.createdAt, from, to)) {
      addInto(out, dims, { queued: 1 });
    }
    if (inWindow(m.sentAt, from, to)) {
      const segments =
        typeof m.segmentsCount === 'number' && m.segmentsCount > 0
          ? Math.floor(m.segmentsCount)
          : 1;
      const costCents =
        typeof m.cost === 'number' && Number.isFinite(m.cost)
          ? Math.round(m.cost * 100)
          : 0;
      const channel: SabsmsChannel =
        m.channel === 'mms' || m.channel === 'rcs' ? m.channel : 'sms';
      const creditsSpent = creditCostFor({
        segments,
        destinationCountry: countryFromE164(m.to ?? ''),
        channel,
      });
      addInto(out, dims, { sent: 1, segments, costCents, creditsSpent });
    }
    if (inWindow(m.deliveredAt, from, to)) addInto(out, dims, { delivered: 1 });
    if (inWindow(m.failedAt, from, to)) addInto(out, dims, { failed: 1 });
  }

  for (const c of raw.clicks) {
    if (!inWindow(c.clickedAt, from, to)) continue;
    const dims: SabsmsStatsDims = {};
    if (c.campaignId) dims.campaignId = c.campaignId;
    addInto(out, dims, { clicks: 1 });
  }

  for (const o of raw.optOuts) {
    if (!inWindow(o.createdAt, from, to)) continue;
    if (o.kind && !OPT_OUT_KINDS.has(o.kind)) continue;
    addInto(out, {}, { optOuts: 1 });
  }

  return out;
}

// ─── Drift diff (pure) ────────────────────────────────────────────────────

export interface StatsDrift {
  dimsKey: string;
  field: keyof SabsmsStatsCounters;
  expected: number;
  actual: number;
}

export interface ExistingDayDoc {
  dimsKey: string;
  counters?: Partial<SabsmsStatsCounters>;
}

/** Compare expected vs stored counters; every mismatch is one entry. */
export function diffDayStats(
  expected: ComputedDayStats,
  existing: ExistingDayDoc[],
): StatsDrift[] {
  const drift: StatsDrift[] = [];
  const existingByKey = new Map(existing.map((d) => [d.dimsKey, d]));
  const keys = new Set<string>([
    ...expected.byKey.keys(),
    ...existingByKey.keys(),
  ]);
  for (const key of keys) {
    const exp = expected.byKey.get(key)?.counters ?? zeroCounters();
    const act = normalizeCounters(existingByKey.get(key)?.counters);
    for (const f of COUNTER_FIELDS) {
      if (exp[f] !== act[f]) {
        drift.push({ dimsKey: key, field: f, expected: exp[f], actual: act[f] });
      }
    }
  }
  return drift;
}

// ─── Db wrapper ───────────────────────────────────────────────────────────

/** Narrow db surface so tests can stub with canned arrays. */
export interface ReconcileDbLike {
  collection(name: string): {
    find(filter: unknown, options?: unknown): { toArray(): Promise<unknown[]> };
    deleteMany(filter: unknown): Promise<unknown>;
    updateOne(filter: unknown, update: unknown, options?: unknown): Promise<unknown>;
  };
}

export interface ReconcileDayResult {
  workspaceId: string;
  date: string;
  drift: StatsDrift[];
  /** Rollup docs written (only when drift was found). */
  replaced: number;
  /** Stale rollup docs removed (dim-combos no longer present in raw). */
  removed: number;
}

/**
 * Recompute one (workspace, UTC day) from raw, report the drift, and —
 * when any exists — REPLACE the day's rollup docs with the recomputed
 * truth (delete stale combos + upsert fresh ones).
 */
export async function reconcileDay(
  db: ReconcileDbLike,
  workspaceId: string,
  date: string,
): Promise<ReconcileDayResult> {
  const { from, to } = dayWindow(date);
  const stamp = { $gte: from, $lt: to };

  const [messages, clicks, optOuts, existing] = await Promise.all([
    db
      .collection('sabsms_messages')
      .find(
        {
          workspaceId,
          $or: [
            { queuedAt: stamp },
            { sentAt: stamp },
            { deliveredAt: stamp },
            { failedAt: stamp },
            { createdAt: stamp },
          ],
        },
        {
          projection: {
            direction: 1,
            provider: 1,
            campaignId: 1,
            channel: 1,
            to: 1,
            segmentsCount: 1,
            cost: 1,
            createdAt: 1,
            queuedAt: 1,
            sentAt: 1,
            deliveredAt: 1,
            failedAt: 1,
          },
        },
      )
      .toArray() as Promise<RawMessageSlice[]>,
    db
      .collection('sabsms_link_clicks')
      .find(
        { workspaceId, clickedAt: stamp },
        { projection: { campaignId: 1, clickedAt: 1 } },
      )
      .toArray() as Promise<RawClickSlice[]>,
    db
      .collection('sabsms_consent_log')
      .find(
        { workspaceId, createdAt: stamp, kind: { $in: [...OPT_OUT_KINDS] } },
        { projection: { kind: 1, createdAt: 1 } },
      )
      .toArray() as Promise<RawConsentSlice[]>,
    db
      .collection(SABSMS_STATS_DAILY_COLLECTION)
      .find({ workspaceId, date }, { projection: { dimsKey: 1, counters: 1 } })
      .toArray() as Promise<ExistingDayDoc[]>,
  ]);

  const expected = foldRawIntoDay(date, { messages, clicks, optOuts });
  const drift = diffDayStats(expected, existing);
  if (drift.length === 0) {
    return { workspaceId, date, drift, replaced: 0, removed: 0 };
  }

  const col = db.collection(SABSMS_STATS_DAILY_COLLECTION);
  const expectedKeys = new Set(expected.byKey.keys());
  const staleKeys = existing
    .map((d) => d.dimsKey)
    .filter((k) => !expectedKeys.has(k));
  if (staleKeys.length > 0) {
    await col.deleteMany({ workspaceId, date, dimsKey: { $in: staleKeys } });
  }
  let replaced = 0;
  for (const [key, slot] of expected.byKey) {
    await col.updateOne(
      { workspaceId, date, dimsKey: key },
      {
        $set: { dims: slot.dims, counters: slot.counters, updatedAt: new Date() },
        $setOnInsert: { workspaceId, date, dimsKey: key },
      },
      { upsert: true },
    );
    replaced += 1;
  }

  return { workspaceId, date, drift, replaced, removed: staleKeys.length };
}
