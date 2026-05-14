/**
 * SabWa per-plan quantitative caps.
 *
 * The main `Plan` type in `src/lib/definitions.ts` exposes an `appLimits`
 * discriminator (`wachat`, `crm`, `sabchat`, …). SabWa will be added there in
 * a follow-up — for now this file is the single source of truth so plan
 * gating code (and admin plan-builder UI) can import deterministic defaults.
 *
 * Sourced from `SABWA_PLAN.md` §10 — keep the two in sync.
 */

export type SabwaPlanTier = 'free' | 'pro' | 'business' | 'enterprise';

/**
 * Numeric cap: `number` for a concrete ceiling, `'unlimited'` for no cap,
 * `'custom'` for "negotiated per-tenant by sales" (Enterprise daily send).
 */
export type SabwaQuota = number | 'unlimited' | 'custom';

export type SabwaPlanLimits = {
    /** Concurrent paired WhatsApp sessions (devices) per project. */
    sessions: SabwaQuota;
    /** Outbound messages per session per UTC day. */
    dailySend: SabwaQuota;
    /** Scheduled-message feature gate + pending-queue cap. */
    scheduler: {
        enabled: boolean;
        /** Max scheduled messages queued at once. `'unlimited'` when uncapped. */
        maxPending: SabwaQuota;
    };
    /** Bulk-send campaigns (CSV / contact-list driven). */
    bulkSend: {
        enabled: boolean;
    };
    /** AI-assisted reply / summarise / translate. */
    aiReplies: {
        enabled: boolean;
        /** AI replies allowed per calendar month. `'unlimited'` when uncapped. */
        monthlyQuota: SabwaQuota;
    };
};

/**
 * Default caps per built-in plan tier. Custom plans should clone the closest
 * tier and override individual fields rather than redefining the whole shape.
 */
export const sabwaPlanLimits: Record<SabwaPlanTier, SabwaPlanLimits> = {
    free: {
        sessions: 1,
        dailySend: 100,
        scheduler: { enabled: true, maxPending: 10 },
        bulkSend: { enabled: false },
        aiReplies: { enabled: false, monthlyQuota: 0 },
    },
    pro: {
        sessions: 3,
        dailySend: 2_000,
        scheduler: { enabled: true, maxPending: 'unlimited' },
        bulkSend: { enabled: true },
        aiReplies: { enabled: true, monthlyQuota: 100 },
    },
    business: {
        sessions: 10,
        dailySend: 10_000,
        scheduler: { enabled: true, maxPending: 'unlimited' },
        bulkSend: { enabled: true },
        aiReplies: { enabled: true, monthlyQuota: 1_000 },
    },
    enterprise: {
        sessions: 'unlimited',
        dailySend: 'custom',
        scheduler: { enabled: true, maxPending: 'unlimited' },
        bulkSend: { enabled: true },
        aiReplies: { enabled: true, monthlyQuota: 'unlimited' },
    },
};

/**
 * Lookup helper. Falls back to the Free tier for unknown / legacy plan names
 * (matches how `getEffectivePermissionsForProject` clamps unknown plans).
 */
export function getSabwaLimits(plan: string | null | undefined): SabwaPlanLimits {
    const key = (plan ?? '').toLowerCase() as SabwaPlanTier;
    return sabwaPlanLimits[key] ?? sabwaPlanLimits.free;
}

/**
 * Pure helper for gating UI / actions on a numeric attempt
 * (e.g. "is daily-send cap exceeded?"). `'unlimited'` and `'custom'` always
 * pass — `'custom'` is treated as "no static cap; enforced by sales/contract".
 */
export function isWithinSabwaQuota(quota: SabwaQuota, value: number): boolean {
    if (quota === 'unlimited' || quota === 'custom') return true;
    return value <= quota;
}
