import 'server-only';

/**
 * SabCRM — CPQ pricing runtime (server-only).
 *
 * Two responsibilities, both on the native-Mongo config pattern of
 * `./scoring.server.ts` / `./sequences.server.ts` (projectId-scoped, own
 * `updatedAt` bump on the config collection — never the record's):
 *
 *   1. **Price-book CRUD** in `sabcrm_price_books` — a project's catalog list
 *      prices + volume tiers + the discount-approval threshold.
 *   2. **`computeQuotePricing`** — runs the PURE waterfall (`./pricing.ts`,
 *      re-exported here so callers import from one file) against a project's
 *      enabled price book, returning the per-line breakdown + totals + trace.
 *   3. **Discount-approval flow** in `sabcrm_discount_approvals` — request /
 *      decide. We do NOT reuse the Rust `sabcrm-approvals` crate: that crate is
 *      coupled to pipeline STAGE-GATE entry approvals (see
 *      `./stage-gates.server.ts`), whereas a discount approval is a quote-scoped
 *      money decision with its own audit trail. A decision is best-effort logged
 *      as a NOTE activity on the linked deal record via `createActivity`.
 *
 * Reuse: the line-item math is NOT re-implemented — `./pricing.ts` builds on
 * `./finance-doc-math.ts`'s `round2`/`safeNum`, the same module the finance
 * quotation surface uses, so a CPQ-priced quote and a hand-built quotation can
 * never drift.
 *
 * Everything is best-effort where it touches records (a downed DB must never
 * break a quote save); the config CRUD surfaces its errors so the settings page
 * can report them.
 */

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { createActivity } from './activities.server';
import {
  priceWaterfall,
  needsDiscountApproval,
  DEFAULT_DISCOUNT_THRESHOLD_PCT,
  type PriceBook,
  type PriceBookInput,
  type PriceBookEntry,
  type PriceTier,
  type PricingRules,
  type PricedTotals,
  type QuoteLineInput,
  type DiscountApprovalDecision,
} from './pricing';

export {
  priceWaterfall,
  priceLine,
  bestVolumeTier,
  findPriceBookEntry,
  needsDiscountApproval,
  DEFAULT_DISCOUNT_THRESHOLD_PCT,
  type PriceBook,
  type PriceBookInput,
  type PriceBookEntry,
  type PriceTier,
  type PricingRules,
  type PricedTotals,
  type PricedLine,
  type WaterfallStep,
  type WaterfallStepKind,
  type QuoteLineInput,
  type DiscountApprovalDecision,
} from './pricing';

const BOOKS_COLL = 'sabcrm_price_books';
const APPROVALS_COLL = 'sabcrm_discount_approvals';

/* -------------------------------------------------------------------------- */
/* Price-book persistence                                                       */
/* -------------------------------------------------------------------------- */

interface PriceBookDoc {
  _id: ObjectId | string;
  projectId: string;
  name: string;
  currency?: string;
  enabled?: boolean;
  entries?: PriceBookEntry[];
  thresholdPct?: number;
  createdAt?: string;
  updatedAt?: string;
}

function idHex(id: ObjectId | string): string {
  return id instanceof ObjectId ? id.toHexString() : String(id);
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : fallback;
}

/** Sanitize one persisted/inbound entry into the API {@link PriceBookEntry}. */
function cleanEntry(e: PriceBookEntry): PriceBookEntry {
  const tiers: PriceTier[] = Array.isArray(e?.tiers)
    ? e.tiers
        .filter((t) => t && Number.isFinite(num(t.minQty)))
        .map((t) => ({
          minQty: Math.max(0, num(t.minQty)),
          discountPct: Math.min(100, Math.max(0, num(t.discountPct))),
          label: t.label?.trim() || undefined,
        }))
        .sort((a, b) => a.minQty - b.minQty)
    : [];
  return {
    itemId: String(e?.itemId ?? '').trim(),
    itemLabel: e?.itemLabel?.trim() || undefined,
    listPrice: Math.max(0, num(e?.listPrice)),
    tiers,
  };
}

function toPriceBook(doc: PriceBookDoc): PriceBook {
  return {
    id: idHex(doc._id),
    projectId: doc.projectId,
    name: doc.name,
    currency: doc.currency || 'INR',
    enabled: doc.enabled !== false,
    entries: Array.isArray(doc.entries) ? doc.entries.map(cleanEntry) : [],
    thresholdPct:
      doc.thresholdPct === undefined
        ? DEFAULT_DISCOUNT_THRESHOLD_PCT
        : num(doc.thresholdPct, DEFAULT_DISCOUNT_THRESHOLD_PCT),
    createdAt: doc.createdAt ?? '',
    updatedAt: doc.updatedAt ?? '',
  };
}

/** All price books for a project (newest first). */
export async function listPriceBooks(projectId: string): Promise<PriceBook[]> {
  if (!projectId) return [];
  const { db } = await connectToDatabase();
  const docs = (await db
    .collection(BOOKS_COLL)
    .find({ projectId })
    .sort({ updatedAt: -1 })
    .limit(200)
    .toArray()) as unknown as PriceBookDoc[];
  return docs.map(toPriceBook);
}

/** One price book by id (scoped to the project), or null. */
export async function getPriceBook(
  projectId: string,
  id: string,
): Promise<PriceBook | null> {
  if (!projectId || !ObjectId.isValid(id)) return null;
  const { db } = await connectToDatabase();
  const doc = (await db
    .collection(BOOKS_COLL)
    .findOne({ _id: new ObjectId(id), projectId })) as PriceBookDoc | null;
  return doc ? toPriceBook(doc) : null;
}

/** The single enabled price book for a project (the active one), or null. */
export async function getActivePriceBook(
  projectId: string,
): Promise<PriceBook | null> {
  if (!projectId) return null;
  const { db } = await connectToDatabase();
  const doc = (await db
    .collection(BOOKS_COLL)
    .find({ projectId, enabled: { $ne: false } })
    .sort({ updatedAt: -1 })
    .limit(1)
    .next()) as PriceBookDoc | null;
  return doc ? toPriceBook(doc) : null;
}

/** Insert (no id) or update (valid id) a price book; returns the saved shape. */
export async function upsertPriceBook(
  projectId: string,
  input: PriceBookInput,
): Promise<PriceBook> {
  const { db } = await connectToDatabase();
  const now = new Date().toISOString();
  const fields = {
    name: input.name?.trim() || 'Untitled price book',
    currency: (input.currency || 'INR').trim().toUpperCase(),
    enabled: input.enabled !== false,
    entries: Array.isArray(input.entries)
      ? input.entries.map(cleanEntry).filter((e) => e.itemId)
      : [],
    thresholdPct: Math.min(
      100,
      Math.max(
        0,
        input.thresholdPct === undefined
          ? DEFAULT_DISCOUNT_THRESHOLD_PCT
          : num(input.thresholdPct, DEFAULT_DISCOUNT_THRESHOLD_PCT),
      ),
    ),
    updatedAt: now,
  };

  if (input.id && ObjectId.isValid(input.id)) {
    await db
      .collection(BOOKS_COLL)
      .updateOne(
        { _id: new ObjectId(input.id), projectId },
        { $set: fields, $setOnInsert: { createdAt: now, projectId } },
        { upsert: true },
      );
    const saved = await getPriceBook(projectId, input.id);
    if (saved) return saved;
  }

  const res = await db
    .collection(BOOKS_COLL)
    .insertOne({ projectId, createdAt: now, ...fields });
  return toPriceBook({ _id: res.insertedId, projectId, createdAt: now, ...fields });
}

/** Delete a price book by id. Returns true when a doc was removed. */
export async function deletePriceBook(
  projectId: string,
  id: string,
): Promise<boolean> {
  if (!projectId || !ObjectId.isValid(id)) return false;
  const { db } = await connectToDatabase();
  const res = await db
    .collection(BOOKS_COLL)
    .deleteOne({ _id: new ObjectId(id), projectId });
  return res.deletedCount > 0;
}

/* -------------------------------------------------------------------------- */
/* Quote pricing                                                                */
/* -------------------------------------------------------------------------- */

/** The minimal quote shape `computeQuotePricing` accepts. */
export interface QuoteForPricing {
  lines: QuoteLineInput[];
  /** Force a specific price book; otherwise the project's active one is used. */
  priceBookId?: string;
  rules?: PricingRules;
}

/** The result of pricing a quote: the waterfall + the approval verdict. */
export interface QuotePricingResult extends PricedTotals {
  /** Currency of the price book used (informational). */
  currency: string;
  /** Id of the price book applied, or null when none was found. */
  priceBookId: string | null;
  /** The discount-approval verdict against the project threshold. */
  approval: DiscountApprovalDecision;
}

/**
 * Price a quote against the project's price book and decide whether the
 * resolved discount needs approval. Reuses the PURE waterfall + the approval
 * gate so the server is authoritative and the client preview can never drift.
 */
export async function computeQuotePricing(
  projectId: string,
  quote: QuoteForPricing,
): Promise<QuotePricingResult> {
  const book = quote.priceBookId
    ? await getPriceBook(projectId, quote.priceBookId)
    : await getActivePriceBook(projectId);

  const totals = priceWaterfall(quote.lines ?? [], book, quote.rules ?? {});
  const thresholdPct = book?.thresholdPct ?? DEFAULT_DISCOUNT_THRESHOLD_PCT;
  const approval = needsDiscountApproval(
    {
      totals: {
        grossTotal: totals.grossTotal,
        discountTotal: totals.discountTotal,
      },
    },
    thresholdPct,
  );

  return {
    ...totals,
    currency: book?.currency ?? 'INR',
    priceBookId: book?.id ?? null,
    approval,
  };
}

/* -------------------------------------------------------------------------- */
/* Discount-approval flow                                                        */
/* -------------------------------------------------------------------------- */

/** Lifecycle of a discount-approval request. */
export type DiscountApprovalStatus = 'pending' | 'approved' | 'rejected';

/** A persisted discount-approval request (API shape minus the Mongo `_id`). */
export interface DiscountApproval {
  id: string;
  projectId: string;
  /** The deal/quote record the discount sits on (object slug + record id). */
  targetObject?: string;
  targetRecordId?: string;
  /** Free-text quote reference (e.g. quotation number) for the audit trail. */
  quoteRef?: string;
  /** Snapshot of the quote's resolved discount + totals at request time. */
  effectiveDiscountPct: number;
  thresholdPct: number;
  grossTotal: number;
  discountTotal: number;
  total: number;
  currency: string;
  /** Why the rep wants the override. */
  reason?: string;
  status: DiscountApprovalStatus;
  requestedBy: string;
  /** Decider + note, present once decided. */
  decidedBy?: string;
  decisionNote?: string;
  createdAt: string;
  updatedAt: string;
}

interface DiscountApprovalDoc {
  _id: ObjectId | string;
  projectId: string;
  targetObject?: string;
  targetRecordId?: string;
  quoteRef?: string;
  effectiveDiscountPct?: number;
  thresholdPct?: number;
  grossTotal?: number;
  discountTotal?: number;
  total?: number;
  currency?: string;
  reason?: string;
  status?: DiscountApprovalStatus;
  requestedBy?: string;
  decidedBy?: string;
  decisionNote?: string;
  createdAt?: string;
  updatedAt?: string;
}

function toApproval(doc: DiscountApprovalDoc): DiscountApproval {
  const status: DiscountApprovalStatus =
    doc.status === 'approved' || doc.status === 'rejected'
      ? doc.status
      : 'pending';
  return {
    id: idHex(doc._id),
    projectId: doc.projectId,
    targetObject: doc.targetObject || undefined,
    targetRecordId: doc.targetRecordId || undefined,
    quoteRef: doc.quoteRef || undefined,
    effectiveDiscountPct: num(doc.effectiveDiscountPct),
    thresholdPct: num(doc.thresholdPct),
    grossTotal: num(doc.grossTotal),
    discountTotal: num(doc.discountTotal),
    total: num(doc.total),
    currency: doc.currency || 'INR',
    reason: doc.reason || undefined,
    status,
    requestedBy: doc.requestedBy || '',
    decidedBy: doc.decidedBy || undefined,
    decisionNote: doc.decisionNote || undefined,
    createdAt: doc.createdAt ?? '',
    updatedAt: doc.updatedAt ?? '',
  };
}

/** Input to raise a discount-approval request. */
export interface RequestDiscountApprovalInput {
  targetObject?: string;
  targetRecordId?: string;
  quoteRef?: string;
  reason?: string;
  /** The priced quote (its totals snapshot is stored). */
  quote: QuoteForPricing;
}

/**
 * Raise a discount-approval request for a quote. Re-prices the quote
 * server-side (never trusts a client total) and snapshots the resolved
 * discount/totals onto the request. Returns the verdict + the created request
 * (the request is only persisted when approval is actually required).
 */
export async function requestDiscountApproval(
  projectId: string,
  requestedBy: string,
  input: RequestDiscountApprovalInput,
): Promise<{
  approval: DiscountApprovalDecision;
  request: DiscountApproval | null;
}> {
  const priced = await computeQuotePricing(projectId, input.quote);
  if (!priced.approval.needsApproval) {
    // No approval needed — nothing to persist, the rep may proceed.
    return { approval: priced.approval, request: null };
  }

  const { db } = await connectToDatabase();
  const now = new Date().toISOString();
  const doc = {
    projectId,
    targetObject: input.targetObject?.trim() || undefined,
    targetRecordId: input.targetRecordId?.trim() || undefined,
    quoteRef: input.quoteRef?.trim() || undefined,
    effectiveDiscountPct: priced.approval.effectiveDiscountPct,
    thresholdPct: priced.approval.thresholdPct,
    grossTotal: priced.grossTotal,
    discountTotal: priced.discountTotal,
    total: priced.total,
    currency: priced.currency,
    reason: input.reason?.trim() || undefined,
    status: 'pending' as DiscountApprovalStatus,
    requestedBy,
    createdAt: now,
    updatedAt: now,
  };
  const res = await db.collection(APPROVALS_COLL).insertOne(doc);
  return {
    approval: priced.approval,
    request: toApproval({ _id: res.insertedId, ...doc }),
  };
}

/** List discount-approval requests for a project (optionally by status). */
export async function listDiscountApprovals(
  projectId: string,
  status?: DiscountApprovalStatus,
): Promise<DiscountApproval[]> {
  if (!projectId) return [];
  const { db } = await connectToDatabase();
  const filter: Record<string, unknown> = { projectId };
  if (status) filter.status = status;
  const docs = (await db
    .collection(APPROVALS_COLL)
    .find(filter)
    .sort({ updatedAt: -1 })
    .limit(200)
    .toArray()) as unknown as DiscountApprovalDoc[];
  return docs.map(toApproval);
}

/**
 * Approve or reject a pending discount request. Only a `pending` request can be
 * decided (idempotency guard via the status filter). Best-effort logs a NOTE
 * activity on the linked deal record so the decision shows on the timeline.
 */
export async function decideDiscountApproval(
  projectId: string,
  deciderId: string,
  id: string,
  decision: 'approved' | 'rejected',
  note?: string,
): Promise<DiscountApproval | null> {
  if (!projectId || !deciderId || !ObjectId.isValid(id)) return null;
  if (decision !== 'approved' && decision !== 'rejected') return null;
  const { db } = await connectToDatabase();
  const now = new Date().toISOString();
  // Driver 7.x returns the updated document directly (or null), not { value }.
  const doc = (await db.collection(APPROVALS_COLL).findOneAndUpdate(
    { _id: new ObjectId(id), projectId, status: 'pending' },
    {
      $set: {
        status: decision,
        decidedBy: deciderId,
        decisionNote: note?.trim() || undefined,
        updatedAt: now,
      },
    },
    { returnDocument: 'after' },
  )) as DiscountApprovalDoc | null;
  if (!doc) return null;
  const approval = toApproval(doc);

  // Best-effort timeline note on the linked deal — never fail the decision.
  if (approval.targetObject && approval.targetRecordId) {
    try {
      const verb = decision === 'approved' ? 'approved' : 'rejected';
      await createActivity({
        projectId,
        type: 'NOTE',
        title: `Discount ${verb}: ${approval.effectiveDiscountPct}% (threshold ${approval.thresholdPct}%)`,
        body: [
          `Discount approval ${verb}.`,
          approval.quoteRef ? `Quote: ${approval.quoteRef}.` : '',
          `Effective discount ${approval.effectiveDiscountPct}% on ${approval.currency} ${approval.grossTotal} gross.`,
          approval.decisionNote ? `Note: ${approval.decisionNote}` : '',
        ]
          .filter(Boolean)
          .join(' '),
        targetObject: approval.targetObject,
        targetRecordId: approval.targetRecordId,
        authorId: deciderId,
      });
    } catch {
      /* best-effort */
    }
  }
  return approval;
}
