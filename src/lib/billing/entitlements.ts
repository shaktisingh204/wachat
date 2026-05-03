/**
 * Entitlements — plan-tier feature gating.
 *
 * `entitlementsFor` is synchronous and pure so it can be called from edge
 * runtimes. Plan -> entitlement mappings are kept in a static table; in
 * production this can be hydrated from Mongo at boot.
 *
 * `canUse` consults plan caps AND on-demand addon packs from the active
 * subscription, so a tenant who runs out of plan quota can keep working if
 * they purchased an addon.
 */

import 'server-only';
import { connectToDatabase } from '@/lib/mongodb';
import type {
    MeteredFeature,
    PlanEntitlements,
    Subscription,
} from './types';
import { currentMonthPeriod, usageForPeriod } from './usage-meter';

const UNLIMITED = -1;

/**
 * Default plan entitlement table. Mirrors the SaaS plan ladder used elsewhere
 * in the app (free / starter / pro / business / enterprise).
 */
const PLAN_TABLE: Record<string, PlanEntitlements> = {
    free: {
        caps: {
            messages_sent: 1_000,
            broadcasts: 5,
            contacts: 250,
            ai_tokens: 50_000,
            ai_requests: 200,
            storage_mb: 100,
            workflow_executions: 100,
            sms_segments: 0,
            email_sends: 500,
            voice_minutes: 0,
            api_calls: 1_000,
            seats: 1,
            projects: 1,
        },
        features: {
            wachat: true,
            sabflow: true,
            crm: false,
            seo: false,
            sabchat: false,
            apiAccess: false,
            customDomain: false,
        },
        seats: 1,
        overagePurchaseAllowed: false,
    },
    starter: {
        caps: {
            messages_sent: 10_000,
            broadcasts: 50,
            contacts: 5_000,
            ai_tokens: 500_000,
            ai_requests: 2_000,
            storage_mb: 2_000,
            workflow_executions: 5_000,
            sms_segments: 500,
            email_sends: 10_000,
            voice_minutes: 60,
            api_calls: 50_000,
            seats: 3,
            projects: 3,
        },
        features: {
            wachat: true,
            sabflow: true,
            crm: true,
            seo: true,
            sabchat: true,
            apiAccess: true,
            customDomain: false,
        },
        seats: 3,
        overagePurchaseAllowed: true,
    },
    pro: {
        caps: {
            messages_sent: 100_000,
            broadcasts: 500,
            contacts: 50_000,
            ai_tokens: 5_000_000,
            ai_requests: 20_000,
            storage_mb: 20_000,
            workflow_executions: 50_000,
            sms_segments: 5_000,
            email_sends: 100_000,
            voice_minutes: 600,
            api_calls: 500_000,
            seats: 10,
            projects: 10,
        },
        features: {
            wachat: true,
            sabflow: true,
            crm: true,
            seo: true,
            sabchat: true,
            apiAccess: true,
            customDomain: true,
        },
        seats: 10,
        overagePurchaseAllowed: true,
    },
    business: {
        caps: {
            messages_sent: 1_000_000,
            broadcasts: UNLIMITED,
            contacts: 500_000,
            ai_tokens: 50_000_000,
            ai_requests: UNLIMITED,
            storage_mb: 200_000,
            workflow_executions: 500_000,
            sms_segments: 50_000,
            email_sends: 1_000_000,
            voice_minutes: 6_000,
            api_calls: UNLIMITED,
            seats: 50,
            projects: UNLIMITED,
        },
        features: {
            wachat: true,
            sabflow: true,
            crm: true,
            seo: true,
            sabchat: true,
            apiAccess: true,
            customDomain: true,
        },
        seats: 50,
        overagePurchaseAllowed: true,
    },
    enterprise: {
        caps: {
            messages_sent: UNLIMITED,
            broadcasts: UNLIMITED,
            contacts: UNLIMITED,
            ai_tokens: UNLIMITED,
            ai_requests: UNLIMITED,
            storage_mb: UNLIMITED,
            workflow_executions: UNLIMITED,
            sms_segments: UNLIMITED,
            email_sends: UNLIMITED,
            voice_minutes: UNLIMITED,
            api_calls: UNLIMITED,
            seats: UNLIMITED,
            projects: UNLIMITED,
        },
        features: {
            wachat: true,
            sabflow: true,
            crm: true,
            seo: true,
            sabchat: true,
            apiAccess: true,
            customDomain: true,
        },
        seats: UNLIMITED,
        overagePurchaseAllowed: true,
    },
};

/**
 * Pure synchronous entitlement lookup. Falls back to the free tier for
 * unknown plan ids so callers never crash on a stale plan reference.
 */
export function entitlementsFor(planId: string): PlanEntitlements {
    return PLAN_TABLE[planId] ?? PLAN_TABLE.free;
}

/**
 * Returns true if the tenant can currently use the given feature, taking into
 * account: plan feature flag, plan cap consumed, and any unexpired addon packs
 * attached to the subscription.
 */
export async function canUse(
    tenantId: string,
    feature: MeteredFeature,
): Promise<boolean> {
    const sub = await loadActiveSubscription(tenantId);
    if (!sub) {
        // No subscription => fall back to free tier semantics.
        const ent = entitlementsFor('free');
        return checkAgainstEntitlement(tenantId, feature, ent, []);
    }

    if (sub.status !== 'active' && sub.status !== 'trialing') {
        return false;
    }

    const ent = entitlementsFor(sub.planId);
    const addons = (sub.addons ?? []).filter((a) => {
        if (a.feature !== feature) return false;
        if (!a.expiresAt) return true;
        return new Date(a.expiresAt).getTime() > Date.now();
    });

    return checkAgainstEntitlement(tenantId, feature, ent, addons);
}

async function checkAgainstEntitlement(
    tenantId: string,
    feature: MeteredFeature,
    ent: PlanEntitlements,
    addons: Array<{ feature: MeteredFeature; units: number; expiresAt?: string }>,
): Promise<boolean> {
    const cap = ent.caps[feature];

    // Feature not present in cap table is treated as not-entitled.
    if (cap === undefined) return false;
    if (cap === UNLIMITED) return true;

    const period = currentMonthPeriod();
    const used = await usageForPeriod(tenantId, feature, period);
    const addonAllowance = addons.reduce((sum, a) => sum + a.units, 0);

    return used < cap + addonAllowance;
}

async function loadActiveSubscription(
    tenantId: string,
): Promise<Subscription | null> {
    try {
        const { db } = await connectToDatabase();
        const sub = await db
            .collection<Subscription>('subscriptions')
            .findOne({ tenantId });
        return sub ?? null;
    } catch {
        return null;
    }
}
