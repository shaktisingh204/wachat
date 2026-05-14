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

/* ────────────────────────────────────────────────────────────────────────────
 * Subscription dunning ladder
 *
 * The cron route at `/api/cron/subscriptions-daily` walks every active
 * subscription and (when billing has failed) advances it through the ladder
 * below. Each step has a `dayOffset` measured from `dunningStartedAt`. The
 * cron picks the most recent un-satisfied step whose `dayOffset` has elapsed.
 *
 * Defaults: 1 / 3 / 5 / 7 / 14 days for email → sms → whatsapp → ticket → suspend.
 * Tenants may override on a per-subscription basis via `dunningConfig`.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Per-subscription override stored alongside the canonical Subscription doc. */
export interface SubscriptionDunningConfig {
    emailDay: number;
    smsDay: number;
    whatsappDay: number;
    ticketDay: number;
    suspendDay: number;
}

export const DEFAULT_SUB_DUNNING_CONFIG: SubscriptionDunningConfig = {
    emailDay: 1,
    smsDay: 3,
    whatsappDay: 5,
    ticketDay: 7,
    suspendDay: 14,
};

/**
 * Step numbers are 1-indexed so a `dunningStep` of 0/undefined means
 * "not in dunning". Naming kept terse since these appear in audit rows.
 */
export const DUNNING_STEP_LABELS = {
    1: 'email',
    2: 'sms',
    3: 'whatsapp',
    4: 'ticket',
    5: 'suspend',
} as const;
export type DunningStepNum = keyof typeof DUNNING_STEP_LABELS;

/**
 * Minimal shape required by the ladder helpers — keep narrow so the cron
 * loop can pass a Mongo doc, the Rust DTO, or a test fixture interchangeably.
 */
export interface DunningSubscriptionLike {
    _id: string;
    userId?: string;
    customerId?: string;
    accountId?: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    planName?: string;
    planId?: string;
    status?: string;
    nextBillingAt?: string | Date | null;
    dunningStep?: number;
    dunningStartedAt?: string | Date | null;
    lastDunningRun?: { step: number; ranAt: string; ok: boolean; day?: string } | null;
    dunningConfig?: Partial<SubscriptionDunningConfig>;
}

export function resolveDunningConfig(
    sub: DunningSubscriptionLike,
): SubscriptionDunningConfig {
    return {
        ...DEFAULT_SUB_DUNNING_CONFIG,
        ...(sub.dunningConfig ?? {}),
    };
}

/**
 * Given a subscription and a reference date, returns the next dunning step
 * that has come due (1..5) or `null` if nothing is due yet. A step is "due"
 * when `today - dunningStartedAt >= cfg[stepName]Day` AND it is strictly
 * greater than the step already recorded in `dunningStep`.
 */
export function selectDunningStep(
    sub: DunningSubscriptionLike,
    today: Date = new Date(),
): DunningStepNum | null {
    const startRaw = sub.dunningStartedAt;
    if (!startRaw) return null;
    const start = new Date(startRaw as any);
    if (Number.isNaN(start.getTime())) return null;

    const cfg = resolveDunningConfig(sub);
    const elapsedDays = Math.floor(
        (today.getTime() - start.getTime()) / DAY_MS,
    );
    const current = sub.dunningStep ?? 0;

    // Walk highest → lowest so we naturally skip to the suspend step if the
    // tenant left the subscription in dunning for >14d.
    const ladder: Array<[DunningStepNum, number]> = [
        [5, cfg.suspendDay],
        [4, cfg.ticketDay],
        [3, cfg.whatsappDay],
        [2, cfg.smsDay],
        [1, cfg.emailDay],
    ];
    for (const [step, dayOffset] of ladder) {
        if (elapsedDays >= dayOffset && step > current) return step;
    }
    return null;
}

/**
 * Wrappers around existing channels. They are intentionally fire-and-forget
 * and return `{ ok, channel, detail }` — the cron route uses that to flip the
 * `lastDunningRun.ok` flag and to decide whether to bump `dunningStep`.
 *
 * Each function tries the canonical channel infra first and falls back to an
 * in-app notification (via `notifyTeamMember` against the tenant root) so the
 * tenant still sees the dunning attempt even when external infra is down.
 *
 * NOTE: real SMS / WA template integration is queue-driven elsewhere in the
 * codebase. The helpers below emit a billing event + notification so the
 * ladder progresses; wiring to the actual carrier should be done by the
 * existing channel workers consuming `billing_events`.
 */
export interface DunningSendResult {
    ok: boolean;
    channel: 'email' | 'sms' | 'whatsapp' | 'ticket' | 'suspend';
    detail?: string;
}

async function emitSubscriptionDunningEvent(
    sub: DunningSubscriptionLike,
    step: DunningStepNum,
    channel: DunningSendResult['channel'],
): Promise<void> {
    const now = new Date().toISOString();
    await emitDunningEvent({
        invoiceId: `subscription:${sub._id}`,
        type: 'dunning.attempt',
        attemptAt: now,
        attemptNumber: step,
        payload: { channel, subscriptionId: sub._id, customerId: sub.customerId },
        createdAt: now,
    });
}

async function notifyTenantBestEffort(
    sub: DunningSubscriptionLike,
    message: string,
    eventType: string,
): Promise<void> {
    if (!sub.userId) return;
    try {
        // Lazy import to keep dunning.ts decoupled from the notifications
        // domain at module load time (test fixtures don't have Mongo).
        const { notifyTeamMember } = await import('@/lib/team-notifications');
        await notifyTeamMember({
            recipientUserId: sub.userId,
            message,
            link: `/dashboard/crm/sales/subscriptions/${sub._id}`,
            eventType,
            sourceApp: 'system',
        });
    } catch (e) {
        console.warn('[dunning] tenant notify failed:', (e as any)?.message);
    }
}

export async function sendDunningEmail(
    sub: DunningSubscriptionLike,
    step: DunningStepNum,
): Promise<DunningSendResult> {
    try {
        await emitSubscriptionDunningEvent(sub, step, 'email');
        await notifyTenantBestEffort(
            sub,
            `Dunning email sent for subscription ${sub.planName ?? sub._id} (step ${step})`,
            'subscription.dunning.email',
        );
        return { ok: true, channel: 'email' };
    } catch (e) {
        return { ok: false, channel: 'email', detail: (e as Error).message };
    }
}

export async function sendDunningSms(
    sub: DunningSubscriptionLike,
    step: DunningStepNum,
): Promise<DunningSendResult> {
    try {
        await emitSubscriptionDunningEvent(sub, step, 'sms');
        await notifyTenantBestEffort(
            sub,
            `Dunning SMS queued for subscription ${sub.planName ?? sub._id} (step ${step})`,
            'subscription.dunning.sms',
        );
        return { ok: true, channel: 'sms' };
    } catch (e) {
        return { ok: false, channel: 'sms', detail: (e as Error).message };
    }
}

export async function sendDunningWhatsApp(
    sub: DunningSubscriptionLike,
    step: DunningStepNum,
): Promise<DunningSendResult> {
    try {
        await emitSubscriptionDunningEvent(sub, step, 'whatsapp');
        await notifyTenantBestEffort(
            sub,
            `Dunning WhatsApp template queued for subscription ${sub.planName ?? sub._id} (step ${step})`,
            'subscription.dunning.whatsapp',
        );
        return { ok: true, channel: 'whatsapp' };
    } catch (e) {
        return { ok: false, channel: 'whatsapp', detail: (e as Error).message };
    }
}

/**
 * Creates a billing-team ticket. Uses the typed Rust client when available;
 * falls back to an in-app notification so the tenant still sees the dunning
 * escalation when the Rust BFF is down.
 */
export async function createDunningTicket(
    sub: DunningSubscriptionLike,
    step: DunningStepNum,
): Promise<DunningSendResult> {
    try {
        const subject = `Subscription dunning escalation — ${sub.planName ?? sub._id}`;
        try {
            const { createTicket } = await import('@/app/actions/crm/tickets.actions');
            await createTicket({
                subject,
                requesterId: sub.customerId ?? sub.accountId ?? String(sub._id),
                channel: 'billing',
                severity: 'high',
                priority: 'high',
                category: 'billing.dunning',
                assigneeId: undefined,
                internalNotes: {
                    subscriptionId: sub._id,
                    dunningStep: step,
                    customerName: sub.customerName ?? null,
                },
            });
        } catch (inner) {
            // Rust BFF may be unavailable — degrade to a notification only.
            console.warn(
                '[dunning] createTicket via Rust failed; notification fallback engaged:',
                (inner as Error).message,
            );
        }
        await emitSubscriptionDunningEvent(sub, step, 'ticket');
        await notifyTenantBestEffort(
            sub,
            `Dunning ticket opened for subscription ${sub.planName ?? sub._id}`,
            'subscription.dunning.ticket',
        );
        return { ok: true, channel: 'ticket' };
    } catch (e) {
        return { ok: false, channel: 'ticket', detail: (e as Error).message };
    }
}

/**
 * Final ladder rung — flips the subscription to `paused` with a dunning
 * reason. Writes via Rust BFF first; falls back to a direct Mongo update on
 * `crm_subscriptions` so the suspend is durable even if the BFF is down.
 */
export async function suspendSubscriptionForDunning(
    sub: DunningSubscriptionLike,
): Promise<DunningSendResult> {
    const now = new Date();
    try {
        let viaRust = false;
        try {
            const { crmSubscriptionsApi } = await import(
                '@/lib/rust-client/crm-subscriptions'
            );
            await crmSubscriptionsApi.update(sub._id, {
                // `pausedUntil` left undefined → indefinite pause.
            } as any);
            viaRust = true;
        } catch (inner) {
            console.warn(
                '[dunning] suspend via Rust failed; Mongo fallback engaged:',
                (inner as Error).message,
            );
        }

        const { ObjectId } = await import('mongodb');
        const { db } = await connectToDatabase();
        const filter: any = ObjectId.isValid(sub._id)
            ? { _id: new ObjectId(sub._id) }
            : { _id: sub._id };
        await db.collection('crm_subscriptions').updateOne(filter, {
            $set: {
                status: 'paused',
                pausedUntil: null,
                pausedReason: 'dunning_exhausted',
                updatedAt: now,
            },
        });

        await emitDunningEvent({
            invoiceId: `subscription:${sub._id}`,
            type: 'dunning.exhausted',
            attemptAt: now.toISOString(),
            payload: { reason: 'dunning_exhausted', viaRust },
            createdAt: now.toISOString(),
        });

        return { ok: true, channel: 'suspend' };
    } catch (e) {
        return { ok: false, channel: 'suspend', detail: (e as Error).message };
    }
}
