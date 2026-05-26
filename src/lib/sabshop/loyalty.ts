/**
 * Loyalty points: earn (% of order subtotal) and burn (1 point = N cents).
 *
 * Configurable via `commerce_loyalty_rules` (per-tenant). Records are
 * append-only entries in `commerce_loyalty_ledger`; current balance is the
 * latest record's `balance` field.
 */

import 'server-only';
import { connectToDatabase } from '@/lib/mongodb';
import type { LoyaltyPoint } from './types';

const LEDGER = 'commerce_loyalty_ledger';
const RULES = 'commerce_loyalty_rules';

export interface LoyaltyRule {
    tenantId: string;
    /** Points earned per 100 cents of subtotal. */
    pointsPerHundredCents: number;
    /** Cents discounted per point at burn. */
    centsPerPoint: number;
    /** Maximum % of order discountable via points (0..1). */
    maxBurnFraction: number;
    /** Days until earned points expire. */
    expiryDays?: number;
}

const DEFAULT_RULE: Omit<LoyaltyRule, 'tenantId'> = {
    pointsPerHundredCents: 1,
    centsPerPoint: 1,
    maxBurnFraction: 0.5,
};

function nowIso(): string {
    return new Date().toISOString();
}

export async function getRule(tenantId: string): Promise<LoyaltyRule> {
    const { db } = await connectToDatabase();
    const doc = await db.collection(RULES).findOne({ tenantId });
    return (doc as unknown as LoyaltyRule) ?? { tenantId, ...DEFAULT_RULE };
}

export async function setRule(rule: LoyaltyRule): Promise<LoyaltyRule> {
    const { db } = await connectToDatabase();
    await db.collection(RULES).updateOne(
        { tenantId: rule.tenantId },
        { $set: rule },
        { upsert: true },
    );
    return rule;
}

export async function balance(tenantId: string, customerId: string): Promise<number> {
    const { db } = await connectToDatabase();
    const last = await db
        .collection(LEDGER)
        .find({ tenantId, customerId })
        .sort({ createdAt: -1 })
        .limit(1)
        .toArray();
    if (!last[0]) return 0;
    return (last[0] as unknown as LoyaltyPoint).balance;
}

async function append(entry: Omit<LoyaltyPoint, '_id' | 'balance' | 'createdAt'>): Promise<LoyaltyPoint> {
    const { db } = await connectToDatabase();
    const current = await balance(entry.tenantId, entry.customerId);
    const next = current + entry.delta;
    const row: LoyaltyPoint = {
        ...entry,
        balance: next,
        createdAt: nowIso(),
    };
    const res = await db.collection(LEDGER).insertOne(row as unknown as Record<string, unknown>);
    row._id = res.insertedId.toString();
    return row;
}

/** Earn rule: floor(subtotalCents / 100) * pointsPerHundredCents. */
export function pointsEarnedFor(rule: LoyaltyRule, subtotalCents: number): number {
    if (subtotalCents <= 0) return 0;
    return Math.floor(subtotalCents / 100) * rule.pointsPerHundredCents;
}

/** Maximum points burnable on an order to discount up to maxBurnFraction. */
export function maxBurnPoints(rule: LoyaltyRule, subtotalCents: number): number {
    const cap = Math.floor(subtotalCents * rule.maxBurnFraction);
    return Math.floor(cap / rule.centsPerPoint);
}

export async function earnFromOrder(
    tenantId: string,
    customerId: string,
    orderId: string,
    subtotalCents: number,
): Promise<LoyaltyPoint> {
    const rule = await getRule(tenantId);
    const points = pointsEarnedFor(rule, subtotalCents);
    const expiresAt = rule.expiryDays
        ? new Date(Date.now() + rule.expiryDays * 86400 * 1000).toISOString()
        : undefined;
    return append({
        tenantId,
        customerId,
        delta: points,
        reason: 'order_earn',
        orderId,
        expiresAt,
    });
}

export async function burnForOrder(
    tenantId: string,
    customerId: string,
    orderId: string,
    points: number,
): Promise<{ entry: LoyaltyPoint; discountCents: number }> {
    if (points <= 0) throw new Error('points must be > 0');
    const rule = await getRule(tenantId);
    const have = await balance(tenantId, customerId);
    if (have < points) throw new Error('Insufficient points');
    const entry = await append({
        tenantId,
        customerId,
        delta: -points,
        reason: 'order_burn',
        orderId,
    });
    return { entry, discountCents: points * rule.centsPerPoint };
}

export async function adjust(
    tenantId: string,
    customerId: string,
    delta: number,
    reason: LoyaltyPoint['reason'] = 'manual_adjust',
): Promise<LoyaltyPoint> {
    return append({ tenantId, customerId, delta, reason });
}

export async function expireDueForCustomer(
    tenantId: string,
    customerId: string,
    asOf: string = nowIso(),
): Promise<number> {
    const { db } = await connectToDatabase();
    const expired = await db
        .collection(LEDGER)
        .aggregate([
            {
                $match: {
                    tenantId,
                    customerId,
                    delta: { $gt: 0 },
                    expiresAt: { $lte: asOf },
                    expired: { $ne: true },
                },
            },
            { $group: { _id: null, total: { $sum: '$delta' } } },
        ])
        .toArray();
    const total = (expired[0]?.total as number | undefined) ?? 0;
    if (total <= 0) return 0;
    await db.collection(LEDGER).updateMany(
        { tenantId, customerId, delta: { $gt: 0 }, expiresAt: { $lte: asOf }, expired: { $ne: true } },
        { $set: { expired: true } },
    );
    await append({ tenantId, customerId, delta: -total, reason: 'expiry' });
    return total;
}
