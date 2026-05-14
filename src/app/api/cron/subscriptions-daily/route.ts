/**
 * Subscriptions daily cron + dunning ladder worker.
 *
 * Runs once per day (Vercel Cron: `0 2 * * *` UTC). For every active
 * subscription it:
 *
 *  1. Generates the next invoice when `nextBillingAt <= now`.
 *  2. If the invoice generation OR payment fails, marks the subscription as
 *     entering dunning (sets `dunningStep` and `dunningStartedAt`).
 *  3. Walks the dunning ladder via `src/lib/billing/dunning.ts`:
 *       step 1 (D+1):  email
 *       step 2 (D+3):  SMS
 *       step 3 (D+5):  WhatsApp template
 *       step 4 (D+7):  ticket to billing
 *       step 5 (D+14): suspend
 *  4. Writes an audit row per ladder advancement and one summary row at the
 *     end of the run.
 *
 * Auth: `Authorization: Bearer $CRON_SECRET` — the header Vercel Cron sends
 * automatically. Bypassed with `?dryRun=true` only when `NODE_ENV !=
 * production`, so staging exploration is safe; in prod the secret is still
 * required.
 *
 * Idempotency: per-subscription, per-step, per-UTC-day — duplicate runs in
 * the same calendar day will short-circuit at the `lastDunningRun.day` check.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { writeAuditEntry } from '@/lib/audit-log';
import {
    DUNNING_STEP_LABELS,
    createDunningTicket,
    selectDunningStep,
    sendDunningEmail,
    sendDunningSms,
    sendDunningWhatsApp,
    suspendSubscriptionForDunning,
    type DunningStepNum,
    type DunningSubscriptionLike,
} from '@/lib/billing/dunning';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const DAY_MS = 24 * 60 * 60 * 1000;

interface RunSummary {
    processed: number;
    invoicesAttempted: number;
    invoicesFailed: number;
    dunningSent: number;
    suspended: number;
    skipped: number;
    errors: Array<{ subscriptionId: string; message: string }>;
}

function utcDayString(d: Date): string {
    return d.toISOString().slice(0, 10);
}

function isAuthorized(request: NextRequest): boolean {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        // Without a configured secret we refuse the request unless the
        // process is in dev mode — surfaces config drift instead of silently
        // running open to the internet.
        return process.env.NODE_ENV !== 'production';
    }
    const header = request.headers.get('authorization') ?? '';
    if (header === `Bearer ${cronSecret}`) return true;
    // Vercel cron is the primary caller and always uses the bearer scheme,
    // but ops scripts sometimes use the `x-cron-secret` header for parity
    // with the webhook drain cron.
    const altHeader = request.headers.get('x-cron-secret') ?? '';
    return altHeader === cronSecret;
}

function structuredLog(
    event: string,
    fields: Record<string, unknown> = {},
): void {
    console.log(
        JSON.stringify({
            ts: new Date().toISOString(),
            event,
            ...fields,
        }),
    );
}

/**
 * Generate the next invoice for a billing-due subscription. We do not call
 * `saveInvoice` directly because that server action is FormData-bound and
 * session-scoped — it would reject a cron caller. Instead we insert a
 * minimal invoice row and mark the subscription as advanced; the existing
 * invoice processor picks it up from there. Returns `true` on success.
 */
async function generateNextInvoice(
    sub: WithId<Record<string, unknown>>,
): Promise<{ ok: boolean; invoiceId?: string; reason?: string }> {
    try {
        const { db } = await connectToDatabase();
        const now = new Date();

        const items = Array.isArray(sub.items) ? (sub.items as any[]) : [];
        const billingAmount =
            typeof sub.billingAmount === 'number'
                ? (sub.billingAmount as number)
                : items.reduce(
                      (acc, it) =>
                          acc +
                          (Number(it?.rate ?? 0) * Number(it?.qty ?? 1) || 0),
                      0,
                  );

        const inv = await db.collection('crm_invoices').insertOne({
            userId: sub.userId,
            subscriptionId: sub._id,
            accountId: sub.accountId ?? sub.customerId ?? null,
            customerName: sub.customerName ?? null,
            currency: sub.currency ?? 'INR',
            amount: billingAmount,
            status: 'sent',
            source: 'subscription_cron',
            issueDate: now,
            createdAt: now,
            updatedAt: now,
        });

        return { ok: true, invoiceId: inv.insertedId.toString() };
    } catch (e) {
        return { ok: false, reason: (e as Error).message };
    }
}

function nextBillingFromFrequency(
    from: Date,
    frequency: string | undefined,
): Date {
    switch ((frequency ?? 'monthly').toLowerCase()) {
        case 'daily':
            return new Date(from.getTime() + DAY_MS);
        case 'weekly':
            return new Date(from.getTime() + 7 * DAY_MS);
        case 'monthly':
            return new Date(from.getFullYear(), from.getMonth() + 1, from.getDate());
        case 'quarterly':
            return new Date(from.getFullYear(), from.getMonth() + 3, from.getDate());
        case 'yearly':
            return new Date(from.getFullYear() + 1, from.getMonth(), from.getDate());
        default:
            return new Date(from.getTime() + 30 * DAY_MS);
    }
}

function toSubscriptionLike(
    doc: WithId<Record<string, unknown>>,
): DunningSubscriptionLike {
    return {
        _id: String(doc._id),
        userId: doc.userId ? String(doc.userId) : undefined,
        customerId: (doc.customerId as string) ?? undefined,
        accountId: doc.accountId ? String(doc.accountId) : undefined,
        customerName: (doc.customerName as string) ?? undefined,
        customerEmail: (doc.customerEmail as string) ?? undefined,
        customerPhone: (doc.customerPhone as string) ?? undefined,
        planName: (doc.planName as string) ?? (doc.planId as string) ?? undefined,
        planId: (doc.planId as string) ?? undefined,
        status: (doc.status as string) ?? undefined,
        nextBillingAt: (doc.nextBillingAt as any) ?? null,
        dunningStep: (doc.dunningStep as number) ?? 0,
        dunningStartedAt: (doc.dunningStartedAt as any) ?? null,
        lastDunningRun: (doc.lastDunningRun as any) ?? null,
        dunningConfig: (doc.dunningConfig as any) ?? undefined,
    };
}

async function runStep(
    sub: DunningSubscriptionLike,
    step: DunningStepNum,
): Promise<{ ok: boolean; detail?: string }> {
    switch (step) {
        case 1:
            return sendDunningEmail(sub, step);
        case 2:
            return sendDunningSms(sub, step);
        case 3:
            return sendDunningWhatsApp(sub, step);
        case 4:
            return createDunningTicket(sub, step);
        case 5:
            return suspendSubscriptionForDunning(sub);
    }
}

async function processSubscription(
    doc: WithId<Record<string, unknown>>,
    today: Date,
    summary: RunSummary,
    opts: { dryRun: boolean },
): Promise<void> {
    const sub = toSubscriptionLike(doc);
    const todayKey = utcDayString(today);
    summary.processed++;

    const { db } = await connectToDatabase();
    const filter: any = { _id: doc._id };

    // 1. Try to advance billing when the next-billing timestamp has passed.
    const nextBillingRaw = sub.nextBillingAt
        ? new Date(sub.nextBillingAt as any)
        : null;
    const billingDue =
        sub.status === 'active' &&
        nextBillingRaw &&
        !Number.isNaN(nextBillingRaw.getTime()) &&
        nextBillingRaw.getTime() <= today.getTime();

    let enteredDunning = false;
    if (billingDue) {
        summary.invoicesAttempted++;
        if (opts.dryRun) {
            structuredLog('cron_subscriptions_daily.invoice_dry_run', {
                subscriptionId: sub._id,
            });
        } else {
            const result = await generateNextInvoice(doc);
            if (result.ok) {
                const next = nextBillingFromFrequency(
                    today,
                    (doc.frequency as string) ?? 'monthly',
                );
                await db.collection('crm_subscriptions').updateOne(filter, {
                    $set: {
                        nextBillingAt: next,
                        lastInvoicedAt: today,
                        updatedAt: today,
                    },
                });
                structuredLog('cron_subscriptions_daily.invoice_ok', {
                    subscriptionId: sub._id,
                    invoiceId: result.invoiceId,
                });
            } else {
                summary.invoicesFailed++;
                enteredDunning = true;
                if (!sub.dunningStartedAt) {
                    await db
                        .collection('crm_subscriptions')
                        .updateOne(filter, {
                            $set: {
                                dunningStartedAt: today,
                                dunningStep: 0,
                                updatedAt: today,
                            },
                        });
                    sub.dunningStartedAt = today;
                    sub.dunningStep = 0;
                }
                structuredLog('cron_subscriptions_daily.invoice_fail', {
                    subscriptionId: sub._id,
                    reason: result.reason,
                });
            }
        }
    }

    // 2. Walk the ladder if the subscription is currently in dunning.
    if (!sub.dunningStartedAt && !enteredDunning) return;

    const nextStep = selectDunningStep(sub, today);
    if (nextStep == null) {
        summary.skipped++;
        return;
    }

    // Idempotency guard — same step in same UTC day must not double-fire.
    if (
        sub.lastDunningRun &&
        sub.lastDunningRun.step === nextStep &&
        sub.lastDunningRun.day === todayKey
    ) {
        summary.skipped++;
        return;
    }

    if (opts.dryRun) {
        structuredLog('cron_subscriptions_daily.dunning_dry_run', {
            subscriptionId: sub._id,
            wouldRunStep: nextStep,
            label: DUNNING_STEP_LABELS[nextStep],
        });
        return;
    }

    const result = await runStep(sub, nextStep);
    const ranAt = new Date().toISOString();
    const update: any = {
        $set: {
            dunningStep: nextStep,
            lastDunningRun: {
                step: nextStep,
                ranAt,
                ok: result.ok,
                day: todayKey,
            },
            updatedAt: today,
        },
    };

    if (nextStep === 5 && result.ok) {
        summary.suspended++;
        // `suspendSubscriptionForDunning` already flipped status to paused,
        // but the local update keeps the audit-trail tidy.
        update.$set.status = 'paused';
        update.$set.pausedReason = 'dunning_exhausted';
    } else if (result.ok) {
        summary.dunningSent++;
    } else {
        summary.errors.push({
            subscriptionId: sub._id,
            message: result.detail ?? `step ${nextStep} failed`,
        });
    }

    await db.collection('crm_subscriptions').updateOne(filter, update);

    if (sub.userId) {
        try {
            await writeAuditEntry({
                tenantUserId: sub.userId,
                action: `dunning_step_${nextStep}`,
                entityKind: 'subscription',
                entityId: sub._id,
                reason: `automated ${DUNNING_STEP_LABELS[nextStep]} run (ok=${result.ok})`,
            });
        } catch {
            /* non-fatal */
        }
    }

    structuredLog('cron_subscriptions_daily.dunning_step', {
        subscriptionId: sub._id,
        step: nextStep,
        label: DUNNING_STEP_LABELS[nextStep],
        ok: result.ok,
        detail: result.detail,
    });
}

export async function GET(request: NextRequest) {
    const startedAt = Date.now();
    if (!isAuthorized(request)) {
        return NextResponse.json(
            { error: 'unauthorized' },
            { status: 401 },
        );
    }

    const dryRun =
        new URL(request.url).searchParams.get('dryRun') === 'true';
    const today = new Date();

    const summary: RunSummary = {
        processed: 0,
        invoicesAttempted: 0,
        invoicesFailed: 0,
        dunningSent: 0,
        suspended: 0,
        skipped: 0,
        errors: [],
    };

    structuredLog('cron_subscriptions_daily.start', { dryRun });

    try {
        const { db } = await connectToDatabase();
        // Pull active subs that are billing-due OR currently in dunning.
        const candidates = (await db
            .collection('crm_subscriptions')
            .find({
                $or: [
                    {
                        status: 'active',
                        nextBillingAt: { $lte: today },
                    },
                    { dunningStep: { $gt: 0 } },
                    { dunningStartedAt: { $exists: true, $ne: null } },
                ],
            })
            .limit(1000)
            .toArray()) as WithId<Record<string, unknown>>[];

        for (const doc of candidates) {
            try {
                await processSubscription(doc, today, summary, { dryRun });
            } catch (e) {
                summary.errors.push({
                    subscriptionId: String(doc._id),
                    message: (e as Error).message,
                });
                structuredLog('cron_subscriptions_daily.subscription_error', {
                    subscriptionId: String(doc._id),
                    error: (e as Error).message,
                });
            }
        }
    } catch (e) {
        structuredLog('cron_subscriptions_daily.fatal', {
            error: (e as Error).message,
        });
        return NextResponse.json(
            { ...summary, error: (e as Error).message },
            { status: 500 },
        );
    }

    // Run-level audit row — tenantUserId is required by `writeAuditEntry`,
    // so we mint a sentinel system ObjectId; the writer no-ops if the id
    // isn't valid, which is fine for the summary marker.
    try {
        await writeAuditEntry({
            tenantUserId: new ObjectId('000000000000000000000000').toString(),
            action: 'dunning_run',
            entityKind: 'subscription',
            entityId: 'cron',
            reason: `processed=${summary.processed} dunningSent=${summary.dunningSent} suspended=${summary.suspended} errors=${summary.errors.length} dryRun=${dryRun}`,
        });
    } catch {
        /* non-fatal */
    }

    structuredLog('cron_subscriptions_daily.complete', {
        dryRun,
        durationMs: Date.now() - startedAt,
        ...summary,
    });

    return NextResponse.json({ ...summary, dryRun });
}

export async function POST(request: NextRequest) {
    return GET(request);
}
