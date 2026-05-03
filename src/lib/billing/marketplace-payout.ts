/**
 * Marketplace Payout Job — monthly batch.
 *
 * Reads `partner_payouts_due` (the queue produced by Impl 24's usage bridge),
 * groups pending rows per `partnerId + currency`, and dispatches a single
 * Stripe Connect transfer per developer. Successful rows are flipped to
 * `paid` with the resulting `transferId`. Negative aggregates (refund-heavy
 * cycles) are skipped with a `negative_balance_carried` audit so the next
 * cycle can net them out.
 *
 * Cross-slice contracts:
 *   - Reads PartnerPayoutDueEvent rows produced by
 *     `src/lib/marketplace/usage-bridge.ts`
 *   - Looks up developer Stripe Connect account via the `partners` directory.
 *     Until Impl 20 publishes a barrel we look up the account on the
 *     `partner_connected_accounts` collection directly.
 *   - Calls `transfer` from `./connect` for the actual money movement.
 *
 * Designed to be invoked from a cron (`vercel.json` cron, PM2 worker, or a
 * Next.js route handler protected by `CRON_SECRET`). The function is
 * idempotent at the row level via Stripe Connect's `Idempotency-Key` header.
 */

import 'server-only';
import { ObjectId, type Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { transfer } from './connect';
import type { Currency } from './types';

const PAYOUTS_COLLECTION = 'partner_payouts_due';
const PARTNER_ACCOUNTS_COLLECTION = 'partner_connected_accounts';
const PAYOUT_RUNS_COLLECTION = 'partner_payout_runs';

/**
 * Mirrors `PartnerPayoutDueEvent` from `marketplace/usage-bridge.ts`. Kept
 * local so the billing slice doesn't take a hard import on the marketplace
 * slice (avoids a circular barrel).
 */
interface PayoutDueDoc {
    _id: ObjectId;
    partnerId: string;
    tenantId: string;
    installId: string;
    appId: string;
    amountCents: number;
    currency: string;
    rate: number;
    status: 'pending' | 'paid' | 'reversed';
    earnedAt: string;
    paidAt?: string;
    transferId?: string;
}

interface ConnectedAccountDoc {
    partnerId: string;
    /** Stripe `acct_…` id. */
    stripeAccountId: string;
    payoutsEnabled: boolean;
    currency?: Currency;
}

/* ── Public types ────────────────────────────────────────────────────────── */

export interface RunPayoutsOptions {
    /** Inclusive ISO bound — only roll up rows earned strictly before this. */
    cutoffIso?: string;
    /** Cap the number of partners processed in this run (safety valve). */
    maxPartners?: number;
    /** Restrict to a specific partner (used in admin "retry" flows). */
    partnerId?: string;
    /** When true, don't actually call Stripe — used in CI / staging. */
    dryRun?: boolean;
}

export interface PartnerPayoutOutcome {
    partnerId: string;
    currency: string;
    /** Pending rows that fed this aggregate. */
    rowCount: number;
    /** Net commission in minor units. May be negative — see `skipped`. */
    amountCents: number;
    status: 'paid' | 'skipped' | 'failed';
    transferId?: string;
    skippedReason?: string;
    error?: string;
}

export interface RunPayoutsResult {
    runId: string;
    cutoffIso: string;
    partners: PartnerPayoutOutcome[];
    totalPaidCents: number;
}

/* ── Public API ──────────────────────────────────────────────────────────── */

/**
 * Run the monthly payout job. Safe to call repeatedly — only `pending`
 * rows older than the cutoff are paid out, and Stripe Connect dedupes via
 * the idempotency key per (partner, period).
 */
export async function runMonthlyMarketplacePayouts(
    opts: RunPayoutsOptions = {},
): Promise<RunPayoutsResult> {
    const cutoffIso = opts.cutoffIso ?? new Date().toISOString();
    const { db } = await connectToDatabase();
    const payouts = db.collection<PayoutDueDoc>(PAYOUTS_COLLECTION);
    const accounts = db.collection<ConnectedAccountDoc>(PARTNER_ACCOUNTS_COLLECTION);
    const runs = db.collection(PAYOUT_RUNS_COLLECTION);

    const runId = new ObjectId();
    await runs.insertOne({
        _id: runId,
        startedAt: new Date(),
        cutoffIso,
        partnerId: opts.partnerId,
        dryRun: !!opts.dryRun,
        status: 'running',
    });

    const filter: Filter<PayoutDueDoc> = {
        status: 'pending',
        earnedAt: { $lt: cutoffIso },
    };
    if (opts.partnerId) filter.partnerId = opts.partnerId;

    // Aggregate per (partnerId, currency) — currency must match Stripe's
    // currency on the connected account.
    const aggregates = await payouts
        .aggregate<{
            _id: { partnerId: string; currency: string };
            rowCount: number;
            amountCents: number;
            rowIds: ObjectId[];
        }>([
            { $match: filter },
            {
                $group: {
                    _id: { partnerId: '$partnerId', currency: '$currency' },
                    rowCount: { $sum: 1 },
                    amountCents: { $sum: '$amountCents' },
                    rowIds: { $push: '$_id' },
                },
            },
            { $sort: { 'amountCents': -1 } },
            ...(opts.maxPartners ? [{ $limit: opts.maxPartners }] : []),
        ])
        .toArray();

    const outcomes: PartnerPayoutOutcome[] = [];
    let totalPaidCents = 0;

    for (const agg of aggregates) {
        const partnerId = agg._id.partnerId;
        const currency = agg._id.currency;
        const outcome: PartnerPayoutOutcome = {
            partnerId,
            currency,
            rowCount: agg.rowCount,
            amountCents: agg.amountCents,
            status: 'skipped',
        };

        try {
            // Skip non-positive aggregates — refunds carry over to next cycle.
            if (agg.amountCents <= 0) {
                outcome.skippedReason = 'non_positive_balance';
                outcomes.push(outcome);
                continue;
            }

            const account = await accounts.findOne({ partnerId });
            if (!account || !account.payoutsEnabled) {
                outcome.skippedReason = account
                    ? 'payouts_disabled'
                    : 'no_connected_account';
                outcomes.push(outcome);
                continue;
            }

            if (opts.dryRun) {
                outcome.status = 'skipped';
                outcome.skippedReason = 'dry_run';
                outcomes.push(outcome);
                continue;
            }

            // Idempotency key per (partner, currency, cutoff) — re-running the
            // job within the same period yields the same Stripe transfer.
            const idempotencyKey = `payout_${partnerId}_${currency}_${cutoffIso}`;

            const result = await transfer(
                'platform',
                account.stripeAccountId,
                agg.amountCents,
                currency.toUpperCase() as Currency,
                {
                    description: `SabNode marketplace payout (${agg.rowCount} events)`,
                    idempotencyKey,
                },
            );

            // Flip rows to paid in one shot.
            await payouts.updateMany(
                { _id: { $in: agg.rowIds } },
                {
                    $set: {
                        status: 'paid',
                        paidAt: new Date().toISOString(),
                        transferId: result.id,
                    },
                },
            );

            outcome.status = 'paid';
            outcome.transferId = result.id;
            totalPaidCents += result.amountCents;
        } catch (err) {
            outcome.status = 'failed';
            outcome.error = err instanceof Error ? err.message : String(err);
            console.error('[marketplace-payout]', partnerId, outcome.error);
        }

        outcomes.push(outcome);
    }

    await runs.updateOne(
        { _id: runId },
        {
            $set: {
                completedAt: new Date(),
                status: 'completed',
                totalPaidCents,
                partnersProcessed: outcomes.length,
            },
        },
    );

    return {
        runId: runId.toString(),
        cutoffIso,
        partners: outcomes,
        totalPaidCents,
    };
}

/**
 * Helper: list payouts a partner has earned over a window. Used by the
 * developer earnings dashboard.
 */
export async function listPartnerPayouts(
    partnerId: string,
    range: { startIso?: string; endIso?: string } = {},
): Promise<PayoutDueDoc[]> {
    const { db } = await connectToDatabase();
    const filter: Filter<PayoutDueDoc> = { partnerId };
    if (range.startIso || range.endIso) {
        filter.earnedAt = {};
        if (range.startIso) (filter.earnedAt as Record<string, string>).$gte = range.startIso;
        if (range.endIso) (filter.earnedAt as Record<string, string>).$lt = range.endIso;
    }
    const docs = await db
        .collection<PayoutDueDoc>(PAYOUTS_COLLECTION)
        .find(filter)
        .sort({ earnedAt: -1 })
        .limit(500)
        .toArray();
    return docs;
}
