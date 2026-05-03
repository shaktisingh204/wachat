/**
 * Marketplace ↔ Billing Usage Bridge
 *
 * This is the integration seam between Impl 3 (marketplace installs) and
 * Impl 8 (billing / usage meter). Whenever an installed app reports
 * consumption, we:
 *
 *   1. Resolve the install -> tenant + appId
 *   2. Append a `UsageEvent` to the tenant ledger keyed on the synthetic
 *      feature `app:{appId}` so the host's metered-feature taxonomy stays
 *      open-ended
 *   3. Bump `usageUnits` on the install record (lifetime aggregate, used by
 *      the developer earnings dashboard)
 *   4. Compute the partner commission via `commissionForInstall` (Impl 20)
 *   5. Queue a `partner.payout.due` event consumed by the monthly batched
 *      payout job (`marketplace-payout.ts`)
 *
 * NOTE on cross-slice deps: at the time of writing Impl 8 publishes
 * `recordUsage` in `@/lib/billing/usage-meter` but does NOT yet include
 * `app:{id}` in the `MeteredFeature` union. We cast at the type boundary so
 * we don't fight the union; once Impl 8 widens the union the cast becomes a
 * no-op.  Impl 20 (`@/lib/partners/commission`) isn't published yet — we
 * provide a local fallback (`commissionForInstall`) that mirrors the
 * agreed-on 70/30 split contract so this module compiles standalone.
 */

import 'server-only';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { recordUsage } from '@/lib/billing/usage-meter';
import type { MeteredFeature } from '@/lib/billing/types';
import { getApp } from './registry';
import { fireAuditEvent, getInstallsCollection } from './install';
import type { App, Install } from './types';

/* ── Public types ─────────────────────────────────────────────────────────── */

export interface RecordAppUsageInput {
    /** Mongo ObjectId hex of the marketplace install. */
    installId: string;
    /** Number of units to meter. Must be a non-negative finite number. */
    units: number;
    /** Optional ISO timestamp; defaults to now. */
    ts?: string;
    /** Idempotency key — same key dedupes retries. */
    idempotencyKey?: string;
    /** Free-form metadata persisted on the usage event. */
    meta?: Record<string, unknown>;
}

export interface RecordAppUsageResult {
    recorded: boolean;
    eventId?: string;
    /** Reason a write was skipped (e.g. zero_units, duplicate_idempotency_key). */
    reason?: string;
    /** Computed partner commission for this slice of usage, in minor units. */
    commissionCents: number;
    /** The synthetic feature key under which usage was metered. */
    feature: string;
}

/**
 * Commission contract — mirrors the shape published by Impl 20
 * (`@/lib/partners/commission`). When the real module ships we re-export
 * from there.
 */
export interface CommissionResult {
    /** Developer / partner that gets paid. */
    partnerId: string;
    /** Amount earned in minor units (cents/paise). Negative for refunds. */
    amountCents: number;
    /** ISO-4217 currency code. */
    currency: string;
    /** Effective rate that produced amountCents (0..1). */
    rate: number;
}

/**
 * Persisted record of a pending payout. The `marketplace-payout.ts` job
 * reads this collection monthly and aggregates per-developer.
 */
export interface PartnerPayoutDueEvent {
    _id?: string;
    /** Developer / publisher who earns the commission. */
    partnerId: string;
    /** Originating tenant — for reporting / audit. */
    tenantId: string;
    /** Originating install (so we can trace back to the consuming app). */
    installId: string;
    appId: string;
    /** Commission in minor units. */
    amountCents: number;
    currency: string;
    rate: number;
    /** Status — set to `paid` by the batch job once a transfer succeeds. */
    status: 'pending' | 'paid' | 'reversed';
    /** ISO timestamp at which the commission accrued. */
    earnedAt: string;
    paidAt?: string;
    /** Stripe Connect transfer id once paid. */
    transferId?: string;
    meta?: Record<string, unknown>;
}

const PAYOUTS_COLLECTION = 'partner_payouts_due';

/* ── Commission calculation (local fallback for Impl 20) ─────────────────── */

/**
 * Default 70/30 split — partner takes 70%, platform retains 30%.
 * Spec'd by Integrator 20; mirrored here so this slice compiles without
 * the cross-slice barrel.
 */
const DEFAULT_PARTNER_RATE = 0.7;

/**
 * Compute the partner commission for a given install + dollar amount.
 *
 * Pricing → commission resolution rules (see Impl 3 manifest contract):
 *   - `free`            → zero commission, regardless of units
 *   - `subscription`    → flat per-period revenue × 70% (computed elsewhere)
 *   - `usage`           → units × pricing.amount × 70%
 *   - `one-time`        → handled at purchase time, not per-usage
 *
 * `amountCents` is signed: refunds pass a negative value and the resulting
 * commission is also negative (a clawback).
 */
export function commissionForInstall(
    app: App,
    install: Install,
    amountCents: number,
    rate: number = DEFAULT_PARTNER_RATE,
): CommissionResult {
    const partnerId = app.manifest.publisher.userId ?? app.ownerId;
    const currency = app.manifest.pricing.currency ?? 'USD';

    // Free apps never accrue commission, even on non-zero usage.
    if (app.manifest.pricing.type === 'free') {
        return { partnerId, amountCents: 0, currency, rate: 0 };
    }

    // Defensive: bound rate to [0,1] in case a bad config slips through.
    const effectiveRate = Math.min(Math.max(rate, 0), 1);
    const commission = Math.trunc(amountCents * effectiveRate);

    return {
        partnerId,
        amountCents: commission,
        currency,
        rate: effectiveRate,
    };
}

/**
 * Resolve `units → grossCents` based on the app's pricing model. Used by
 * `recordAppUsage` so callers don't need to know the per-app rate.
 */
function grossCentsFor(app: App, units: number): number {
    const { pricing } = app.manifest;
    if (pricing.type !== 'usage') return 0;
    const unitAmount = pricing.amount ?? 0;
    return Math.trunc(unitAmount * units);
}

/* ── Public API ──────────────────────────────────────────────────────────── */

/**
 * Record marketplace-app usage against the billing meter and queue the
 * downstream commission payout. Idempotent when `idempotencyKey` is
 * supplied.
 *
 * Negative `units` are rejected outright; refunds should call
 * `recordAppRefund` (which produces a negative commission entry) instead.
 */
export async function recordAppUsage(
    input: RecordAppUsageInput,
): Promise<RecordAppUsageResult> {
    if (!input.installId) throw new Error('installId required');
    if (!Number.isFinite(input.units) || input.units < 0) {
        throw new Error('units must be a non-negative finite number');
    }

    const install = await loadInstall(input.installId);
    if (!install) throw new Error(`Install not found: ${input.installId}`);
    if (install.status !== 'active') {
        return {
            recorded: false,
            reason: `install_${install.status}`,
            commissionCents: 0,
            feature: featureKey(install.appId),
        };
    }

    const app = await getApp(install.appId);
    if (!app) throw new Error(`App not found for install: ${install.appId}`);

    const feature = featureKey(install.appId);

    // Hand off to the billing meter. The synthetic `app:{id}` feature is not
    // yet in MeteredFeature's union — cast at the boundary so the bridge
    // continues to compile cleanly while Impl 8 expands the type.
    const usageRes = await recordUsage({
        tenantId: install.tenantId,
        feature: feature as MeteredFeature,
        units: input.units,
        ts: input.ts,
        idempotencyKey: input.idempotencyKey,
        meta: {
            ...(input.meta ?? {}),
            source: 'marketplace',
            installId: input.installId,
            appId: install.appId,
        },
    });

    // Bump lifetime aggregate on the install (used by developer dashboards).
    if (usageRes.recorded && input.units > 0) {
        const installs = await getInstallsCollection();
        await installs.updateOne(
            { _id: new ObjectId(input.installId) },
            { $inc: { usageUnits: input.units }, $set: { updatedAt: new Date() } },
        );
    }

    // Compute commission, then queue payout when nonzero.
    const grossCents = grossCentsFor(app, input.units);
    const commission = commissionForInstall(app, install, grossCents);

    if (usageRes.recorded && commission.amountCents !== 0) {
        await queuePartnerPayoutDue({
            partnerId: commission.partnerId,
            tenantId: install.tenantId,
            installId: input.installId,
            appId: install.appId,
            amountCents: commission.amountCents,
            currency: commission.currency,
            rate: commission.rate,
            status: 'pending',
            earnedAt: input.ts ?? new Date().toISOString(),
            meta: { eventId: usageRes.eventId, units: input.units },
        });
    }

    return {
        recorded: usageRes.recorded,
        eventId: usageRes.eventId,
        reason: usageRes.reason,
        commissionCents: commission.amountCents,
        feature,
    };
}

/**
 * Record a refund slice for a previously billed app usage event. Produces
 * a NEGATIVE commission row so the next monthly payout job nets it out.
 */
export async function recordAppRefund(
    input: { installId: string; refundCents: number; meta?: Record<string, unknown> },
): Promise<CommissionResult> {
    if (!input.installId) throw new Error('installId required');
    if (!Number.isFinite(input.refundCents) || input.refundCents <= 0) {
        throw new Error('refundCents must be a positive number');
    }

    const install = await loadInstall(input.installId);
    if (!install) throw new Error(`Install not found: ${input.installId}`);
    const app = await getApp(install.appId);
    if (!app) throw new Error(`App not found for install: ${install.appId}`);

    // Negate by passing -refundCents through the same calculation, so free
    // apps still produce zero and the rate logic stays consistent.
    const commission = commissionForInstall(app, install, -input.refundCents);

    if (commission.amountCents !== 0) {
        await queuePartnerPayoutDue({
            partnerId: commission.partnerId,
            tenantId: install.tenantId,
            installId: input.installId,
            appId: install.appId,
            amountCents: commission.amountCents,
            currency: commission.currency,
            rate: commission.rate,
            status: 'pending',
            earnedAt: new Date().toISOString(),
            meta: { ...(input.meta ?? {}), kind: 'refund' },
        });
    }

    await fireAuditEvent('app.usage.refunded', install.tenantId, {
        installId: input.installId,
        appId: install.appId,
        refundCents: input.refundCents,
        clawbackCents: commission.amountCents,
    });

    return commission;
}

/* ── Persistence ─────────────────────────────────────────────────────────── */

/**
 * Append a `partner.payout.due` event to the queue collection. Exposed for
 * direct use by the payout batch job (and tests).
 */
export async function queuePartnerPayoutDue(
    event: Omit<PartnerPayoutDueEvent, '_id'>,
): Promise<{ id: string }> {
    const { db } = await connectToDatabase();
    const col = db.collection(PAYOUTS_COLLECTION);
    try {
        await col.createIndex({ partnerId: 1, status: 1, earnedAt: 1 });
        await col.createIndex({ tenantId: 1, earnedAt: 1 });
    } catch {
        /* indexes exist */
    }
    const res = await col.insertOne({ ...event });
    return { id: res.insertedId.toString() };
}

/* ── Internals ───────────────────────────────────────────────────────────── */

/** Synthetic billing feature key — keeps marketplace usage off the core caps. */
export function featureKey(appId: string): string {
    return `app:${appId}`;
}

async function loadInstall(installId: string): Promise<Install | null> {
    if (!ObjectId.isValid(installId)) return null;
    const installs = await getInstallsCollection();
    const doc = await installs.findOne({ _id: new ObjectId(installId) });
    if (!doc) return null;
    return {
        _id: doc._id.toString(),
        tenantId: doc.tenantId,
        appId: doc.appId,
        version: doc.version,
        grantedScopes: doc.grantedScopes,
        status: doc.status,
        config: doc.config,
        usageUnits: doc.usageUnits,
        installedAt: doc.installedAt,
        updatedAt: doc.updatedAt,
        uninstalledAt: doc.uninstalledAt,
    };
}
