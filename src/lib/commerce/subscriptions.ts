/**
 * Recurring billing for commerce subscriptions.
 *
 * Distinct from `src/lib/billing/` (which is for SabNode's own SaaS plans).
 * This module manages customer-facing product subscriptions (e.g. monthly box).
 */

import 'server-only';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import type { Subscription, SubscriptionInterval } from './types';

const COLLECTION = 'commerce_subscriptions';

function nowIso(): string {
    return new Date().toISOString();
}

export function addInterval(d: Date, interval: SubscriptionInterval, count: number): Date {
    const next = new Date(d.getTime());
    switch (interval) {
        case 'day':
            next.setUTCDate(next.getUTCDate() + count);
            break;
        case 'week':
            next.setUTCDate(next.getUTCDate() + count * 7);
            break;
        case 'month':
            next.setUTCMonth(next.getUTCMonth() + count);
            break;
        case 'year':
            next.setUTCFullYear(next.getUTCFullYear() + count);
            break;
    }
    return next;
}

export interface ScheduleEntry {
    date: string;
    amountCents: number;
    cycleNumber: number;
}

/**
 * Generate the upcoming billing schedule. If `cycles` is finite, generates
 * exactly that many entries. Otherwise generates `lookaheadCycles` for preview.
 */
export function generateSchedule(opts: {
    startsAt: string;
    interval: SubscriptionInterval;
    intervalCount: number;
    priceCents: number;
    cycles: number; // -1 for unlimited
    lookaheadCycles?: number; // used when cycles === -1
    /** First cycle number (default 1). */
    startCycle?: number;
}): ScheduleEntry[] {
    const total = opts.cycles === -1 ? opts.lookaheadCycles ?? 12 : opts.cycles;
    const out: ScheduleEntry[] = [];
    let date = new Date(opts.startsAt);
    const startCycle = opts.startCycle ?? 1;
    for (let i = 0; i < total; i++) {
        out.push({
            date: date.toISOString(),
            amountCents: opts.priceCents,
            cycleNumber: startCycle + i,
        });
        date = addInterval(date, opts.interval, opts.intervalCount);
    }
    return out;
}

export interface CreateSubscriptionInput {
    tenantId: string;
    customerId: string;
    productId: string;
    variantId?: string;
    interval: SubscriptionInterval;
    intervalCount: number;
    priceCents: number;
    currency: Subscription['currency'];
    cycles?: number; // -1 unlimited (default)
    startsAt?: string;
    paymentMethodId?: string;
}

export async function createSubscription(input: CreateSubscriptionInput): Promise<Subscription> {
    const startsAt = input.startsAt ?? nowIso();
    const cycles = input.cycles ?? -1;
    const next = addInterval(new Date(startsAt), input.interval, input.intervalCount);
    const sub: Subscription = {
        tenantId: input.tenantId,
        customerId: input.customerId,
        productId: input.productId,
        variantId: input.variantId,
        interval: input.interval,
        intervalCount: input.intervalCount,
        priceCents: input.priceCents,
        currency: input.currency,
        status: 'active',
        startsAt,
        nextBillingAt: next.toISOString(),
        cyclesRemaining: cycles,
        paymentMethodId: input.paymentMethodId,
        schedule: generateSchedule({
            startsAt,
            interval: input.interval,
            intervalCount: input.intervalCount,
            priceCents: input.priceCents,
            cycles,
            lookaheadCycles: 12,
        }),
        createdAt: nowIso(),
        updatedAt: nowIso(),
    };
    const { db } = await connectToDatabase();
    const res = await db.collection(COLLECTION).insertOne(sub as unknown as Record<string, unknown>);
    sub._id = res.insertedId.toString();
    return sub;
}

export async function getSubscription(tenantId: string, id: string): Promise<Subscription | null> {
    if (!ObjectId.isValid(id)) return null;
    const { db } = await connectToDatabase();
    const doc = await db.collection(COLLECTION).findOne({ _id: new ObjectId(id), tenantId });
    if (!doc) return null;
    const { _id, ...rest } = doc as unknown as Subscription & { _id: ObjectId };
    return { ...(rest as Subscription), _id: _id.toString() };
}

export async function listDueSubscriptions(asOf: string = nowIso(), limit = 100): Promise<Subscription[]> {
    const { db } = await connectToDatabase();
    const docs = await db
        .collection(COLLECTION)
        .find({ status: 'active', nextBillingAt: { $lte: asOf } })
        .limit(limit)
        .toArray();
    return docs.map((d) => {
        const { _id, ...rest } = d as unknown as Subscription & { _id: ObjectId };
        return { ...(rest as Subscription), _id: _id.toString() };
    });
}

/**
 * Advance a subscription past its current billing date. Decrements
 * cyclesRemaining (if finite) and marks completed when 0.
 */
export async function advance(tenantId: string, id: string): Promise<Subscription | null> {
    const sub = await getSubscription(tenantId, id);
    if (!sub) return null;
    const { db } = await connectToDatabase();

    const next = addInterval(new Date(sub.nextBillingAt), sub.interval, sub.intervalCount).toISOString();
    let cyclesRemaining = sub.cyclesRemaining;
    let status: Subscription['status'] = sub.status;
    if (cyclesRemaining > 0) {
        cyclesRemaining -= 1;
        if (cyclesRemaining === 0) status = 'completed';
    }
    const update: Record<string, unknown> = {
        nextBillingAt: next,
        cyclesRemaining,
        status,
        updatedAt: nowIso(),
    };
    if (status === 'completed') update.endsAt = nowIso();
    const res = await db.collection(COLLECTION).findOneAndUpdate(
        { _id: new ObjectId(id), tenantId },
        { $set: update },
        { returnDocument: 'after' },
    );
    if (!res) return null;
    const { _id, ...rest } = res as unknown as Subscription & { _id: ObjectId };
    return { ...(rest as Subscription), _id: _id.toString() };
}

export async function pause(tenantId: string, id: string): Promise<boolean> {
    if (!ObjectId.isValid(id)) return false;
    const { db } = await connectToDatabase();
    const res = await db.collection(COLLECTION).updateOne(
        { _id: new ObjectId(id), tenantId, status: 'active' },
        { $set: { status: 'paused', updatedAt: nowIso() } },
    );
    return res.modifiedCount === 1;
}

export async function resume(tenantId: string, id: string): Promise<boolean> {
    if (!ObjectId.isValid(id)) return false;
    const { db } = await connectToDatabase();
    const res = await db.collection(COLLECTION).updateOne(
        { _id: new ObjectId(id), tenantId, status: 'paused' },
        { $set: { status: 'active', updatedAt: nowIso() } },
    );
    return res.modifiedCount === 1;
}

export async function cancel(tenantId: string, id: string, atPeriodEnd = false): Promise<boolean> {
    if (!ObjectId.isValid(id)) return false;
    const { db } = await connectToDatabase();
    if (atPeriodEnd) {
        const res = await db.collection(COLLECTION).updateOne(
            { _id: new ObjectId(id), tenantId, status: 'active' },
            { $set: { cancelAtPeriodEnd: true, updatedAt: nowIso() } },
        );
        return res.modifiedCount === 1;
    }
    const res = await db.collection(COLLECTION).updateOne(
        { _id: new ObjectId(id), tenantId },
        { $set: { status: 'cancelled', endsAt: nowIso(), updatedAt: nowIso() } },
    );
    return res.modifiedCount === 1;
}
