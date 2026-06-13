import 'server-only';

import { ObjectId, type Collection } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';

import type { CreditCostInput } from '../credits/rates';
import { SABSMS_CREDIT_COLLECTIONS, type SabsmsCreditLedgerRow } from '../credits/ledger';
import { SABSMS_STATS_DAILY_COLLECTION } from '../analytics/rollups';
import {
  creditCostWithCard,
  pickRateCard,
  type SabsmsRateCardLike,
  type SabsmsRateCardRate,
} from './resolve';

/**
 * SabSMS reseller rate cards — Mongo store (V2.13).
 *
 * Collection `sabsms_rate_cards`:
 *   { workspaceId (the RESELLER), name, rates[], childWorkspaceIds[],
 *     marginNote?, effectiveFrom, createdAt }
 *
 * Hot path: [`creditCostForWorkspace`] is consulted by the engine's
 * credit-reservation callback (`/api/sabsms/credits`) on EVERY send, so
 * the child→card resolution is cached in-process for 60 s.
 */

export const SABSMS_RATE_CARDS_COLLECTION = 'sabsms_rate_cards';

export interface SabsmsRateCardDoc extends SabsmsRateCardLike {
  _id?: ObjectId;
}

let indexesEnsured = false;

async function cards(): Promise<Collection<SabsmsRateCardDoc>> {
  const { db } = await connectToDatabase();
  const col = db.collection<SabsmsRateCardDoc>(SABSMS_RATE_CARDS_COLLECTION);
  if (!indexesEnsured) {
    indexesEnsured = true;
    void Promise.all([
      col.createIndex({ workspaceId: 1, createdAt: -1 }),
      col.createIndex({ childWorkspaceIds: 1, effectiveFrom: -1 }),
    ]).catch(() => {
      indexesEnsured = false;
    });
  }
  return col;
}

// ─── CRUD (settings reseller card) ─────────────────────────────────────────

export async function listRateCards(resellerWorkspaceId: string): Promise<SabsmsRateCardDoc[]> {
  const col = await cards();
  return col.find({ workspaceId: resellerWorkspaceId }).sort({ createdAt: -1 }).limit(100).toArray();
}

/**
 * Upper bound on a single rate row (V2.13 IDOR hardening). Without a
 * ceiling, a hostile reseller could attach a child and bill astronomical
 * credits per segment; clamp to a sane maximum so a mis-set or malicious
 * card cannot drain a child's balance with one send.
 */
const MAX_CREDITS_PER_SEGMENT = 1000;

function sanitizeRates(rates: SabsmsRateCardRate[]): SabsmsRateCardRate[] {
  return (rates ?? [])
    .map((r) => ({
      country: String(r.country ?? '').trim().toUpperCase() || '*',
      ...(r.channel ? { channel: r.channel } : {}),
      ...(r.category ? { category: r.category } : {}),
      creditsPerSegment: Math.min(
        MAX_CREDITS_PER_SEGMENT,
        Math.max(0.01, Number(r.creditsPerSegment) || 0),
      ),
    }))
    .filter((r) => r.creditsPerSegment > 0)
    .slice(0, 200);
}

export async function upsertRateCard(input: {
  resellerWorkspaceId: string;
  id?: string;
  name: string;
  rates: SabsmsRateCardRate[];
  childWorkspaceIds: string[];
  marginNote?: string;
  effectiveFrom: Date;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: 'Name is required' };
  const rates = sanitizeRates(input.rates);
  if (rates.length === 0) return { ok: false, error: 'At least one rate row is required' };

  const childWorkspaceIds = [...new Set(input.childWorkspaceIds.map((s) => s.trim()).filter(Boolean))];
  for (const child of childWorkspaceIds) {
    if (!ObjectId.isValid(child)) {
      return { ok: false, error: `"${child}" is not a valid workspace id` };
    }
    if (child === input.resellerWorkspaceId) {
      return { ok: false, error: 'A reseller cannot attach itself as a child workspace' };
    }
  }

  const col = await cards();

  // SECURITY (V2.13 IDOR): there is no platform-level parent/child
  // workspace hierarchy yet, so attaching a child is the act that creates
  // the reseller→child relationship. Without a guard, ANY workspace could
  // attach ANY other workspace as a "child" and re-price its sends
  // (findRateCardForChild resolves purely by `childWorkspaceIds`).
  //
  // Chosen rule (first-claim ownership / no-poaching): a child may be
  // attached only if it is NOT already claimed by a DIFFERENT reseller's
  // rate card. This makes the first attach authoritative and blocks a
  // hostile reseller from hijacking and over-pricing a workspace that
  // another reseller already legitimately prices. Combined with the
  // self-attach rejection above and the per-segment clamp, a unilateral
  // re-pricing attack on an already-served tenant cannot stand. (When a
  // real opt-in / admin-attach link model lands, swap this for a verified
  // parent→child lookup.)
  if (childWorkspaceIds.length > 0) {
    const claimQuery: Record<string, unknown> = {
      childWorkspaceIds: { $in: childWorkspaceIds },
      workspaceId: { $ne: input.resellerWorkspaceId },
    };
    if (input.id && ObjectId.isValid(input.id)) {
      claimQuery._id = { $ne: new ObjectId(input.id) };
    }
    const conflicting = await col
      .find(claimQuery)
      .project<{ childWorkspaceIds: string[] }>({ childWorkspaceIds: 1 })
      .limit(50)
      .toArray();
    const claimed = new Set(
      conflicting
        .flatMap((c) => c.childWorkspaceIds ?? [])
        .filter((id) => childWorkspaceIds.includes(id)),
    );
    if (claimed.size > 0) {
      const [first] = [...claimed];
      return {
        ok: false,
        error: `Workspace "${first}" is already attached to another reseller's rate card`,
      };
    }
  }

  const effectiveFrom =
    input.effectiveFrom instanceof Date && !Number.isNaN(input.effectiveFrom.getTime())
      ? input.effectiveFrom
      : new Date();

  if (input.id) {
    if (!ObjectId.isValid(input.id)) return { ok: false, error: 'Invalid card id' };
    const res = await col.updateOne(
      { _id: new ObjectId(input.id), workspaceId: input.resellerWorkspaceId },
      {
        $set: {
          name,
          rates,
          childWorkspaceIds,
          marginNote: input.marginNote?.trim() || undefined,
          effectiveFrom,
        },
      },
    );
    if (res.matchedCount === 0) return { ok: false, error: 'Rate card not found' };
    invalidateRateCardCache();
    return { ok: true, id: input.id };
  }

  const _id = new ObjectId();
  await col.insertOne({
    _id,
    workspaceId: input.resellerWorkspaceId,
    name,
    rates,
    childWorkspaceIds,
    ...(input.marginNote?.trim() ? { marginNote: input.marginNote.trim() } : {}),
    effectiveFrom,
    createdAt: new Date(),
  });
  invalidateRateCardCache();
  return { ok: true, id: _id.toHexString() };
}

export async function deleteRateCard(
  resellerWorkspaceId: string,
  id: string,
): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const col = await cards();
  const res = await col.deleteOne({ _id: new ObjectId(id), workspaceId: resellerWorkspaceId });
  invalidateRateCardCache();
  return res.deletedCount === 1;
}

// ─── Hot-path resolution (credits route) ───────────────────────────────────

const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  card: SabsmsRateCardDoc | null;
  at: number;
}

const cardCache = new Map<string, CacheEntry>();

export function invalidateRateCardCache(): void {
  cardCache.clear();
}

/** Active card for a CHILD workspace (cached 60 s; null = no reseller). */
export async function findRateCardForChild(
  childWorkspaceId: string,
  now: Date = new Date(),
): Promise<SabsmsRateCardDoc | null> {
  const cached = cardCache.get(childWorkspaceId);
  if (cached && now.getTime() - cached.at < CACHE_TTL_MS) return cached.card;

  const col = await cards();
  const candidates = await col
    .find({ childWorkspaceIds: childWorkspaceId, effectiveFrom: { $lte: now } })
    .sort({ effectiveFrom: -1 })
    .limit(20)
    .toArray();
  const card = pickRateCard(candidates, childWorkspaceId, now);
  cardCache.set(childWorkspaceId, { card, at: now.getTime() });
  return card;
}

/**
 * Integer credit cost for one message in `workspaceId` — the V2.13
 * entry point the credits route calls. Resolution: child's active rate
 * card → matching row, else the platform default table. NEVER throws:
 * a rate-card lookup failure falls back to the default table so credit
 * reservation (and therefore sending) keeps working.
 */
export async function creditCostForWorkspace(
  workspaceId: string,
  input: CreditCostInput,
): Promise<number> {
  let card: SabsmsRateCardDoc | null = null;
  try {
    card = await findRateCardForChild(workspaceId);
  } catch (err) {
    console.error('[sabsms/ratecards] resolution failed; using default table', err);
  }
  return creditCostWithCard(card, input);
}

// ─── Margin report ─────────────────────────────────────────────────────────

export interface MarginReportRow {
  childWorkspaceId: string;
  /** UTC month, `YYYY-MM`. */
  month: string;
  /** Credits charged to the child (ledger debits net of adjustments). */
  creditsCharged: number;
  /** Wholesale provider cost in cents (analytics rollups). */
  costCents: number;
}

/**
 * Price-vs-cost per child per month for a reseller:
 *   price = child's `sabsms_credit_ledger` debit/adjust rows (negated sum)
 *   cost  = child's `sabsms_stats_daily` costCents
 */
export async function marginReport(
  resellerWorkspaceId: string,
  opts: { from?: Date; to?: Date } = {},
): Promise<MarginReportRow[]> {
  const col = await cards();
  const owned = await col
    .find({ workspaceId: resellerWorkspaceId })
    .project<{ childWorkspaceIds: string[] }>({ childWorkspaceIds: 1 })
    .toArray();
  const children = [...new Set(owned.flatMap((c) => c.childWorkspaceIds ?? []))];
  if (children.length === 0) return [];

  const to = opts.to ?? new Date();
  const from = opts.from ?? new Date(to.getTime() - 365 * 24 * 60 * 60 * 1000);

  const { db } = await connectToDatabase();

  // Price: ledger debits + adjustments per (child, month).
  const ledger = db.collection<SabsmsCreditLedgerRow>(SABSMS_CREDIT_COLLECTIONS.ledger);
  const priceAgg = await ledger
    .aggregate<{ _id: { workspaceId: string; month: string }; credits: number }>([
      {
        $match: {
          workspaceId: { $in: children },
          kind: { $in: ['debit', 'adjust'] },
          createdAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: {
            workspaceId: '$workspaceId',
            month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          },
          credits: { $sum: { $multiply: ['$delta', -1] } },
        },
      },
    ])
    .toArray();

  // Cost: rollup costCents per (child, month) — total rows only.
  const fromDay = from.toISOString().slice(0, 10);
  const toDay = to.toISOString().slice(0, 10);
  const costAgg = await db
    .collection(SABSMS_STATS_DAILY_COLLECTION)
    .aggregate<{ _id: { workspaceId: string; month: string }; costCents: number }>([
      {
        $match: {
          workspaceId: { $in: children },
          dimsKey: '{}',
          date: { $gte: fromDay, $lte: toDay },
        },
      },
      {
        $group: {
          _id: {
            workspaceId: '$workspaceId',
            month: { $substrCP: ['$date', 0, 7] },
          },
          costCents: { $sum: { $ifNull: ['$counters.costCents', 0] } },
        },
      },
    ])
    .toArray();

  const rows = new Map<string, MarginReportRow>();
  const keyOf = (ws: string, month: string) => `${ws}:${month}`;
  for (const p of priceAgg) {
    rows.set(keyOf(p._id.workspaceId, p._id.month), {
      childWorkspaceId: p._id.workspaceId,
      month: p._id.month,
      creditsCharged: Math.round(p.credits),
      costCents: 0,
    });
  }
  for (const c of costAgg) {
    const key = keyOf(c._id.workspaceId, c._id.month);
    const row = rows.get(key) ?? {
      childWorkspaceId: c._id.workspaceId,
      month: c._id.month,
      creditsCharged: 0,
      costCents: 0,
    };
    row.costCents = Math.round(c.costCents);
    rows.set(key, row);
  }

  return [...rows.values()].sort(
    (a, b) =>
      b.month.localeCompare(a.month) || a.childWorkspaceId.localeCompare(b.childWorkspaceId),
  );
}
