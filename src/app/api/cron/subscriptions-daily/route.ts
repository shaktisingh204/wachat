/**
 * Subscriptions daily cron + dunning ladder worker (CRM_REBUILD_PLAN §6.1).
 *
 * Scheduled by Vercel Cron (`0 2 * * *` UTC, see `vercel.json`). For each
 * active subscription whose `nextBillingDate <= today` it does one of:
 *
 *  1. **Fresh cycle** (`attemptCount === 0`): create an invoice from the
 *     subscription's plan/customer/items, advance `nextBillingDate` by the
 *     billing interval, increment `attemptCount`, and emit the
 *     `subscription.invoice_issued` notification.
 *  2. **Outstanding invoice past grace** (`graceDays`, default 3): walk the
 *     dunning ladder via `src/lib/billing/dunning.ts` —
 *       step 1 (D+1):  email
 *       step 2 (D+3):  SMS
 *       step 3 (D+5):  WhatsApp template
 *       step 4 (D+7):  create billing ticket
 *       step 5 (D+14): suspend subscription
 *
 * **Safety defaults**
 *  - `dryRun=true` unless caller appends `?execute=1`. The dry-run path emits
 *    a structured `dunning_step_due` log line for every step that *would*
 *    have fired but performs no Mongo writes and no channel calls.
 *  - Cap per run: **200 subscriptions**. When more are pending the response
 *    has `hasMore: true` and the next cron tick (or an ops-triggered manual
 *    re-run) picks them up.
 *
 * **Wiring TODO** — real channel sends (email/SMS/WhatsApp) currently emit
 * an in-app `notifyTeamMember` row + a `billing_events` doc; the dedicated
 * channel workers (see `src/lib/notifications/`, queue consumers) need a
 * subscriber for `dunning.attempt` events to actually deliver. The ticket
 * + suspend steps already go through the Rust BFF when available.
 *
 * Auth: `Authorization: Bearer $CRON_SECRET` (mirrors
 * `/api/cron/audit-retention/route.ts`). `x-cron-secret` accepted as a
 * fallback for non-Vercel schedulers.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { writeAuditEntry } from '@/lib/audit-log';
import {
    DUNNING_STEP_LABELS,
    advanceDunningStep,
    applyDunningStep,
    getNextDunningStep,
    type DunningStepNum,
    type DunningSubscriptionLike,
} from '@/lib/billing/dunning';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const DAY_MS = 24 * 60 * 60 * 1000;
const RUN_CAP = 200;
const DEFAULT_GRACE_DAYS = 3;

interface RunSummary {
    processed: number;
    invoicesIssued: number;
    dunningSteps: number;
    suspended: number;
    skipped: number;
    errors: Array<{ subscriptionId: string; message: string }>;
    hasMore: boolean;
}

function utcDayString(d: Date): string {
    return d.toISOString().slice(0, 10);
}

function authorize(
    request: NextRequest,
): { ok: true } | { ok: false; status: number; body: unknown } {
    const expected = process.env.CRON_SECRET;
    if (!expected) {
        return {
            ok: false,
            status: 503,
            body: { error: 'CRON_SECRET not configured' },
        };
    }
    const auth = request.headers.get('authorization') ?? '';
    if (auth === `Bearer ${expected}`) return { ok: true };
    const xCron = request.headers.get('x-cron-secret') ?? '';
    if (xCron === expected) return { ok: true };
    return { ok: false, status: 401, body: { error: 'Unauthorized' } };
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

/**
 * Insert a fresh invoice row for this billing cycle. We don't call the
 * `saveInvoice` server action because that path expects a user session +
 * FormData. Instead we drop a minimal row that the existing invoice worker
 * picks up. Returns the inserted invoice id on success.
 */
async function issueInvoice(
    sub: WithId<Record<string, unknown>>,
    now: Date,
): Promise<{ ok: boolean; invoiceId?: string; reason?: string }> {
    try {
        const { db } = await connectToDatabase();
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

interface ProcessOptions {
    execute: boolean;
    graceDays: number;
}

async function processSubscription(
    doc: WithId<Record<string, unknown>>,
    today: Date,
    summary: RunSummary,
    opts: ProcessOptions,
): Promise<void> {
    const sub = toSubscriptionLike(doc);

    // Tenants can opt a single subscription out of dunning entirely.
    if ((doc as any).dunningDisabled === true) {
        summary.skipped++;
        structuredLog('dunning_skipped_disabled', { subscriptionId: sub._id });
        return;
    }

    summary.processed++;
    const { db } = await connectToDatabase();
    const filter: any = { _id: doc._id };

    const nextBillingRaw = sub.nextBillingAt
        ? new Date(sub.nextBillingAt as any)
        : null;
    const billingDue =
        sub.status === 'active' &&
        nextBillingRaw &&
        !Number.isNaN(nextBillingRaw.getTime()) &&
        nextBillingRaw.getTime() <= today.getTime();

    const attemptCount = (doc.attemptCount as number) ?? 0;

    // ─── 1. Fresh cycle ──────────────────────────────────────────────────
    if (billingDue && attemptCount === 0) {
        if (!opts.execute) {
            structuredLog('invoice_issued_dry_run', {
                subscriptionId: sub._id,
                nextBillingAt: nextBillingRaw?.toISOString(),
            });
            summary.invoicesIssued++;
            return;
        }

        const result = await issueInvoice(doc, today);
        if (!result.ok) {
            summary.errors.push({
                subscriptionId: sub._id,
                message: result.reason ?? 'invoice_issue_failed',
            });
            structuredLog('invoice_issue_failed', {
                subscriptionId: sub._id,
                reason: result.reason,
            });
            return;
        }

        const next = nextBillingFromFrequency(
            today,
            (doc.frequency as string) ?? 'monthly',
        );
        await db.collection('crm_subscriptions').updateOne(filter, {
            $set: {
                nextBillingAt: next,
                lastInvoicedAt: today,
                attemptCount: 1,
                lastInvoiceId: result.invoiceId,
                lastInvoiceIssuedAt: today,
                updatedAt: today,
            },
        });

        // Best-effort issued notification — falls through silently if the
        // notification module is unavailable in this build target.
        if (sub.userId) {
            try {
                const { notifyTeamMember } = await import(
                    '@/lib/team-notifications'
                );
                await notifyTeamMember({
                    recipientUserId: sub.userId,
                    message: `Invoice issued for subscription ${sub.planName ?? sub._id}`,
                    link: `/dashboard/crm/sales/subscriptions/${sub._id}`,
                    eventType: 'subscription.invoice_issued',
                    sourceApp: 'system',
                });
            } catch {
                /* best-effort */
            }
        }

        summary.invoicesIssued++;
        structuredLog('invoice_issued', {
            subscriptionId: sub._id,
            invoiceId: result.invoiceId,
        });
        return;
    }

    // ─── 2. Dunning ladder ───────────────────────────────────────────────
    //
    // Only walk the ladder if there's an outstanding invoice that has aged
    // past the grace window. `dunningStartedAt` is the canonical "started
    // dunning" timestamp; if absent and the invoice has aged past grace,
    // start the clock now (write happens on the first ladder step).
    if (!billingDue && !sub.dunningStartedAt) return;

    const issuedAtRaw = (doc.lastInvoiceIssuedAt as any) ?? sub.nextBillingAt;
    const issuedAt = issuedAtRaw ? new Date(issuedAtRaw) : null;
    if (issuedAt && !Number.isNaN(issuedAt.getTime())) {
        const ageMs = today.getTime() - issuedAt.getTime();
        if (ageMs < opts.graceDays * DAY_MS && !sub.dunningStartedAt) {
            // Within grace — defer ladder advancement until grace expires.
            summary.skipped++;
            return;
        }
    }

    if (!sub.dunningStartedAt) {
        sub.dunningStartedAt = today;
        if (opts.execute) {
            await db.collection('crm_subscriptions').updateOne(filter, {
                $set: {
                    dunningStartedAt: today,
                    dunningStep: 0,
                    updatedAt: today,
                },
            });
        }
    }

    const nextStep = getNextDunningStep(sub, sub.lastDunningRun ?? null, today);
    if (nextStep == null) {
        summary.skipped++;
        return;
    }

    // Structured "would advance" log — emitted in BOTH dry-run and live runs
    // so ops can correlate the planned step against the eventual write.
    structuredLog('dunning_step_due', {
        subscriptionId: sub._id,
        step: nextStep,
        label: DUNNING_STEP_LABELS[nextStep],
        dryRun: !opts.execute,
    });

    const applied = await applyDunningStep(sub, nextStep, {
        execute: opts.execute,
        today,
    });

    if (applied.skipped) {
        summary.skipped++;
        return;
    }
    if (applied.dryRun) {
        // Dry-run already logged via `dunning_step_due`.
        return;
    }

    if (applied.ok) {
        if (nextStep === 5) summary.suspended++;
        else summary.dunningSteps++;
    } else {
        summary.errors.push({
            subscriptionId: sub._id,
            message: applied.detail ?? `step ${nextStep} failed`,
        });
    }

    await advanceDunningStep(sub._id, sub.dunningStep ?? 0, {
        toStep: nextStep as DunningStepNum,
        ok: applied.ok,
        today,
    });

    if (sub.userId) {
        try {
            await writeAuditEntry({
                tenantUserId: sub.userId,
                action: `dunning_step_${nextStep}`,
                entityKind: 'subscription',
                entityId: sub._id,
                reason: `automated ${DUNNING_STEP_LABELS[nextStep]} (ok=${applied.ok})`,
            });
        } catch {
            /* non-fatal */
        }
    }

    structuredLog('dunning_step_applied', {
        subscriptionId: sub._id,
        step: nextStep,
        label: DUNNING_STEP_LABELS[nextStep],
        ok: applied.ok,
        detail: applied.detail,
    });
}

async function handle(request: NextRequest): Promise<NextResponse> {
    const startedAt = Date.now();

    const guard = authorize(request);
    if (!guard.ok) {
        return NextResponse.json(guard.body, { status: guard.status });
    }

    // SAFETY: dry-run by default; ops flips writes on with `?execute=1`.
    const url = new URL(request.url);
    const execute = url.searchParams.get('execute') === '1';
    const graceDaysParam = url.searchParams.get('graceDays');
    const graceDays = graceDaysParam
        ? Math.max(0, parseInt(graceDaysParam, 10) || DEFAULT_GRACE_DAYS)
        : DEFAULT_GRACE_DAYS;

    const today = new Date();
    const summary: RunSummary = {
        processed: 0,
        invoicesIssued: 0,
        dunningSteps: 0,
        suspended: 0,
        skipped: 0,
        errors: [],
        hasMore: false,
    };

    structuredLog('cron_subscriptions_daily.start', {
        dryRun: !execute,
        graceDays,
        cap: RUN_CAP,
    });

    try {
        const { db } = await connectToDatabase();

        // We pull `RUN_CAP + 1` so we can detect "more pending" without a
        // separate count query.
        const candidates = (await db
            .collection('crm_subscriptions')
            .find({
                dunningDisabled: { $ne: true },
                $or: [
                    {
                        status: 'active',
                        nextBillingAt: { $lte: today },
                    },
                    { dunningStep: { $gt: 0 } },
                    { dunningStartedAt: { $exists: true, $ne: null } },
                ],
            })
            .limit(RUN_CAP + 1)
            .toArray()) as WithId<Record<string, unknown>>[];

        const batch = candidates.slice(0, RUN_CAP);
        summary.hasMore = candidates.length > RUN_CAP;

        for (const doc of batch) {
            try {
                await processSubscription(doc, today, summary, {
                    execute,
                    graceDays,
                });
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
            {
                ok: false,
                dryRun: !execute,
                durationMs: Date.now() - startedAt,
                ...summary,
                error: (e as Error).message,
            },
            { status: 500 },
        );
    }

    // Summary audit row — sentinel tenant id so the audit log keeps a single
    // canonical "cron ran" entry per day. `writeAuditEntry` is no-op safe.
    try {
        await writeAuditEntry({
            tenantUserId: new ObjectId('000000000000000000000000').toString(),
            action: 'dunning_run',
            entityKind: 'subscription',
            entityId: 'cron',
            reason:
                `processed=${summary.processed} ` +
                `invoicesIssued=${summary.invoicesIssued} ` +
                `dunningSteps=${summary.dunningSteps} ` +
                `suspended=${summary.suspended} ` +
                `errors=${summary.errors.length} ` +
                `hasMore=${summary.hasMore} ` +
                `dryRun=${!execute} day=${utcDayString(today)}`,
        });
    } catch {
        /* non-fatal */
    }

    structuredLog('cron_subscriptions_daily.complete', {
        dryRun: !execute,
        durationMs: Date.now() - startedAt,
        ...summary,
    });

    return NextResponse.json({
        ok: true,
        dryRun: !execute,
        durationMs: Date.now() - startedAt,
        ...summary,
    });
}

export async function GET(request: NextRequest) {
    return handle(request);
}

export async function POST(request: NextRequest) {
    return handle(request);
}
