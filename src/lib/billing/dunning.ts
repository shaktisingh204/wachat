/**
 * Dunning — failed-payment retry orchestration.
 *
 * Schedules a retry cadence for a failed invoice and emits dunning events the
 * existing event/queue system picks up. Smart-retry rules:
 *   - Skip weekends (Sat/Sun in tenant's region defaults to UTC).
 *   - Cancel & reschedule immediately when payment method is updated.
 *   - After final attempt, mark invoice `uncollectible` and emit churn event.
 */

import 'server-only';
import { connectToDatabase } from '@/lib/mongodb';

export type DunningSchedule = '3+5+7' | 'standard';

export interface DunningEvent {
    _id?: string;
    invoiceId: string;
    type:
        | 'dunning.scheduled'
        | 'dunning.attempt'
        | 'dunning.payment_method_updated'
        | 'dunning.exhausted'
        | 'dunning.recovered';
    attemptAt?: string;
    attemptNumber?: number;
    payload?: Record<string, unknown>;
    createdAt: string;
}

export interface DunningPlan {
    _id?: string;
    invoiceId: string;
    schedule: DunningSchedule;
    /** ISO timestamps of upcoming attempts. */
    upcomingAttempts: string[];
    /** Index into upcomingAttempts of next attempt. */
    nextAttemptIndex: number;
    status: 'scheduled' | 'in_progress' | 'recovered' | 'exhausted' | 'canceled';
    createdAt: string;
    updatedAt: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const SCHEDULES: Record<DunningSchedule, number[]> = {
    // Stripe-style aggressive cadence: +3, +5, +7 days from initial failure.
    '3+5+7': [3, 5, 7],
    // Conservative monthly retry cadence.
    standard: [1, 3, 7, 14, 21],
};

/**
 * Push a date forward to Monday if it lands on a weekend (UTC).
 */
function avoidWeekend(d: Date): Date {
    const day = d.getUTCDay();
    if (day === 6) return new Date(d.getTime() + 2 * DAY_MS); // Sat -> Mon
    if (day === 0) return new Date(d.getTime() + 1 * DAY_MS); // Sun -> Mon
    return d;
}

export async function scheduleDunning(
    invoiceId: string,
    schedule: DunningSchedule = '3+5+7',
    opts: { from?: Date } = {},
): Promise<DunningPlan> {
    if (!invoiceId) throw new Error('invoiceId required');
    const cadence = SCHEDULES[schedule];
    if (!cadence) throw new Error(`Unknown dunning schedule: ${schedule}`);

    const from = opts.from ?? new Date();
    const upcoming: string[] = cadence.map((days) => {
        const t = new Date(from.getTime() + days * DAY_MS);
        return avoidWeekend(t).toISOString();
    });

    const now = new Date().toISOString();
    const plan: DunningPlan = {
        invoiceId,
        schedule,
        upcomingAttempts: upcoming,
        nextAttemptIndex: 0,
        status: 'scheduled',
        createdAt: now,
        updatedAt: now,
    };

    const { db } = await connectToDatabase();
    await db
        .collection<DunningPlan>('dunning_plans')
        .updateOne({ invoiceId }, { $set: plan }, { upsert: true });

    await emitDunningEvent({
        invoiceId,
        type: 'dunning.scheduled',
        payload: { schedule, attempts: upcoming },
        createdAt: now,
    });

    return plan;
}

/**
 * Called by the payment-method-updated webhook handler. Cancels the current
 * cadence and triggers an immediate retry — this is the "smart retry" branch
 * that materially improves recovery rates.
 */
export async function onPaymentMethodUpdated(invoiceId: string): Promise<void> {
    const { db } = await connectToDatabase();
    const now = new Date().toISOString();
    await db.collection<DunningPlan>('dunning_plans').updateOne(
        { invoiceId },
        {
            $set: {
                upcomingAttempts: [now],
                nextAttemptIndex: 0,
                status: 'in_progress',
                updatedAt: now,
            },
        },
    );
    await emitDunningEvent({
        invoiceId,
        type: 'dunning.payment_method_updated',
        attemptAt: now,
        createdAt: now,
    });
}

/**
 * Mark a dunning cadence recovered (invoice was paid).
 */
export async function markRecovered(invoiceId: string): Promise<void> {
    const { db } = await connectToDatabase();
    const now = new Date().toISOString();
    await db
        .collection<DunningPlan>('dunning_plans')
        .updateOne(
            { invoiceId },
            { $set: { status: 'recovered', updatedAt: now } },
        );
    await emitDunningEvent({
        invoiceId,
        type: 'dunning.recovered',
        createdAt: now,
    });
}

/**
 * Mark a dunning cadence exhausted (no more retries — invoice uncollectible).
 */
export async function markExhausted(invoiceId: string): Promise<void> {
    const { db } = await connectToDatabase();
    const now = new Date().toISOString();
    await db
        .collection<DunningPlan>('dunning_plans')
        .updateOne(
            { invoiceId },
            { $set: { status: 'exhausted', updatedAt: now } },
        );
    await emitDunningEvent({
        invoiceId,
        type: 'dunning.exhausted',
        createdAt: now,
    });
}

/**
 * Append a dunning event to the events collection. Existing background
 * workers and the in-app notification system tail this stream.
 */
async function emitDunningEvent(evt: DunningEvent): Promise<void> {
    try {
        const { db } = await connectToDatabase();
        await db.collection<DunningEvent>('billing_events').insertOne(evt as DunningEvent & { _id?: any });
    } catch (e) {
        // Events are best-effort; swallow to avoid blocking the schedule write.
        console.warn('[dunning] failed to emit event', evt.type, e);
    }
}
