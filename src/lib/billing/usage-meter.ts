/**
 * Usage Meter — append-only tenant consumption ledger.
 *
 * Backed by Mongo collection `usage_events`. Reads are aggregated on-demand
 * for accuracy; for hot paths the caller should layer a Redis counter.
 */

import 'server-only';
import { connectToDatabase } from '@/lib/mongodb';
import type { BillingPeriod, MeteredFeature, UsageEvent } from './types';
import { entitlementsFor } from './entitlements';

const COLLECTION = 'usage_events';

export interface RecordUsageInput {
    tenantId: string;
    feature: MeteredFeature;
    units: number;
    /** ISO timestamp. Defaults to now. */
    ts?: string;
    meta?: Record<string, unknown>;
    idempotencyKey?: string;
}

/**
 * Append a usage event. Idempotent when `idempotencyKey` is supplied.
 */
export async function recordUsage(
    input: RecordUsageInput,
): Promise<{ recorded: boolean; eventId?: string; reason?: string }> {
    if (!input.tenantId) throw new Error('tenantId required');
    if (!input.feature) throw new Error('feature required');
    if (!Number.isFinite(input.units) || input.units < 0) {
        throw new Error('units must be a non-negative finite number');
    }
    if (input.units === 0) {
        return { recorded: false, reason: 'zero_units' };
    }

    const { db } = await connectToDatabase();
    const col = db.collection<UsageEvent>(COLLECTION);

    const doc: UsageEvent = {
        tenantId: input.tenantId,
        feature: input.feature,
        units: input.units,
        ts: input.ts ?? new Date().toISOString(),
        meta: input.meta,
        idempotencyKey: input.idempotencyKey,
    };

    if (input.idempotencyKey) {
        // Upsert-on-key for safe retries. If the key already exists for this
        // tenant+feature pair we treat it as a no-op.
        const existing = await col.findOne({
            tenantId: input.tenantId,
            feature: input.feature,
            idempotencyKey: input.idempotencyKey,
        });
        if (existing) {
            return {
                recorded: false,
                eventId: existing._id?.toString(),
                reason: 'duplicate_idempotency_key',
            };
        }
    }

    const res = await col.insertOne(doc as UsageEvent & { _id?: any });
    return { recorded: true, eventId: res.insertedId?.toString() };
}

/**
 * Sum units consumed for a tenant+feature over a period.
 */
export async function usageForPeriod(
    tenantId: string,
    feature: MeteredFeature,
    period: BillingPeriod,
): Promise<number> {
    const { db } = await connectToDatabase();
    const col = db.collection<UsageEvent>(COLLECTION);

    const result = await col
        .aggregate<{ total: number }>([
            {
                $match: {
                    tenantId,
                    feature,
                    ts: { $gte: period.start, $lt: period.end },
                },
            },
            { $group: { _id: null, total: { $sum: '$units' } } },
        ])
        .toArray();

    return result[0]?.total ?? 0;
}

/**
 * Convenience: current calendar-month period in UTC.
 */
export function currentMonthPeriod(now: Date = new Date()): BillingPeriod {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * Returns false when the tenant has reached or exceeded its cap for the
 * current billing period. Returns true if the cap is unlimited (-1) or the
 * feature is unmetered for the plan.
 */
export async function enforceCap(
    tenantId: string,
    feature: MeteredFeature,
    planId?: string,
    period: BillingPeriod = currentMonthPeriod(),
): Promise<boolean> {
    if (!planId) return true; // Caller didn't pass plan — fail-open; entitlement check happens elsewhere.

    const ent = entitlementsFor(planId);
    const cap = ent.caps[feature];

    if (cap === undefined) return true; // Feature not capped for this plan.
    if (cap === -1) return true; // Unlimited.
    if (cap === 0) return false; // Disabled.

    const used = await usageForPeriod(tenantId, feature, period);
    return used < cap;
}
