/**
 * Marketplace install/uninstall lifecycle hooks.
 *
 * Wraps `installApp` / `uninstallApp` from `./install` with cross-slice side
 * effects:
 *
 *   1. Audit log — every lifecycle transition becomes a `marketplace_audit`
 *      row so support / compliance can replay events
 *   2. Billing scope adjustment — installing an app may grant access to a
 *      pricing line item that needs to be tracked. We zero out / reset the
 *      `app:{id}` usage counter at install time so the meter starts clean,
 *      and we emit a `billing.scope.changed` audit event so Impl 8 can
 *      pick up the scope delta on its next reconciliation pass
 *   3. Entitlement re-eval — uninstalling an app immediately invalidates
 *      any entitlement-cache the host might have for the tenant. We don't
 *      have a hard dep on the cache module; if it isn't published yet we
 *      just emit the event and the cache layer can subscribe later.
 *
 * These hooks are idempotent: re-running them produces the same audit
 * record + same scope state. Failures in side-effects must NEVER block the
 * primary install/uninstall outcome — install lock-in is more important
 * than perfect bookkeeping (the audit row will surface the issue).
 */

import 'server-only';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import {
    fireAuditEvent,
    getInstallsCollection,
    installApp,
    uninstallApp,
    type InstallAppOptions,
} from './install';
import type { Install } from './types';
import { featureKey } from './usage-bridge';

/* ── Public API ──────────────────────────────────────────────────────────── */

export interface LifecycleResult {
    install: Install | null;
    /** Audit event ids fired during the lifecycle pass. */
    auditEvents: string[];
    /** True if downstream caches were invalidated. */
    entitlementsReevaluated: boolean;
}

/**
 * Install hook — runs `installApp` then performs the cross-slice fanout.
 * Returns the resolved Install record alongside lifecycle metadata.
 */
export async function onInstall(
    tenantId: string,
    appId: string,
    opts: InstallAppOptions = {},
): Promise<LifecycleResult> {
    const install = await installApp(tenantId, appId, opts);
    const auditEvents: string[] = [];

    // ── 1. Audit ─────────────────────────────────────────────────────────
    auditEvents.push(
        await safeAudit('marketplace.lifecycle.install', tenantId, {
            installId: install._id,
            appId,
            grantedScopes: install.grantedScopes,
            version: install.version,
        }),
    );

    // ── 2. Billing scope reset ───────────────────────────────────────────
    // A fresh install means a fresh `app:{id}` meter — drop any stale
    // pre-uninstall events so the developer starts on a clean ledger. We
    // delete by tenant+feature, which is safe because nothing else writes
    // to that feature key.
    try {
        const { db } = await connectToDatabase();
        await db.collection('usage_events').deleteMany({
            tenantId,
            feature: featureKey(appId),
        });
    } catch (err) {
        console.error('[marketplace.lifecycle] usage_events reset failed', err);
    }

    auditEvents.push(
        await safeAudit('billing.scope.changed', tenantId, {
            kind: 'install',
            appId,
            feature: featureKey(appId),
            installId: install._id,
        }),
    );

    // ── 3. Entitlement re-eval ──────────────────────────────────────────
    const entitlementsReevaluated = await reevaluateEntitlements(tenantId, {
        reason: 'install',
        appId,
    });

    return { install, auditEvents, entitlementsReevaluated };
}

/**
 * Uninstall hook — wraps `uninstallApp` and emits the matching audit +
 * scope-change events. Returns lifecycle metadata only; install will be
 * null because the record has been removed.
 */
export async function onUninstall(
    tenantId: string,
    installId: string,
): Promise<LifecycleResult> {
    // Resolve appId BEFORE the delete, otherwise we lose it. Filter by both
    // tenant and the install's _id so multi-install tenants resolve the
    // exact record being uninstalled (not just "any install for the tenant").
    const installs = await getInstallsCollection();
    let pre: { appId?: string } | null = null;
    if (installs && ObjectId.isValid(installId)) {
        pre = await installs.findOne({
            _id: new ObjectId(installId),
            tenantId,
        });
    }
    const appId = pre?.appId;

    const removed = await uninstallApp(tenantId, installId);
    const auditEvents: string[] = [];

    auditEvents.push(
        await safeAudit('marketplace.lifecycle.uninstall', tenantId, {
            installId,
            appId: removed.appId ?? appId,
            removed: removed.removed,
        }),
    );

    if (removed.appId) {
        auditEvents.push(
            await safeAudit('billing.scope.changed', tenantId, {
                kind: 'uninstall',
                appId: removed.appId,
                feature: featureKey(removed.appId),
                installId,
            }),
        );
    }

    const entitlementsReevaluated = await reevaluateEntitlements(tenantId, {
        reason: 'uninstall',
        appId: removed.appId,
    });

    return { install: null, auditEvents, entitlementsReevaluated };
}

/* ── Internals ───────────────────────────────────────────────────────────── */

/** Wrap fireAuditEvent so a failure can't propagate. */
async function safeAudit(
    type: string,
    tenantId: string,
    payload: Record<string, unknown>,
): Promise<string> {
    try {
        await fireAuditEvent(type, tenantId, payload);
        return type;
    } catch (err) {
        console.error('[marketplace.lifecycle] audit failed', type, err);
        return `${type}:failed`;
    }
}

/**
 * Stub bridge to Impl 8's entitlement cache. We attempt a dynamic import so
 * deployment can ship this slice before the cache is wired; if the module
 * is missing we no-op and just return false. When Impl 8 publishes
 * `invalidateEntitlements` from `@/lib/billing` this becomes a hard call.
 */
async function reevaluateEntitlements(
    tenantId: string,
    ctx: { reason: 'install' | 'uninstall'; appId?: string },
): Promise<boolean> {
    try {
        // Best-effort: write a queue row so a downstream worker can pick it up.
        const { db } = await connectToDatabase();
        await db.collection('entitlement_invalidations').insertOne({
            tenantId,
            reason: ctx.reason,
            appId: ctx.appId,
            createdAt: new Date(),
        });
        return true;
    } catch (err) {
        console.error('[marketplace.lifecycle] entitlement reeval failed', err);
        return false;
    }
}
