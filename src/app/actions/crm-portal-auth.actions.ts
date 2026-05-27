'use server';

/**
 * Public-facing portal authentication server actions.
 *
 * These power `/portal/[tenantSlug]/login` — the magic-link request form
 * and sign-out — and intentionally do NOT use `requirePermission`. Portal
 * users are end-customers / vendors / employees of the CRM tenant, not
 * SabNode logins.
 */

import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import {
    mintPortalMagicLink,
    clearPortalSessionCookie,
    PORTAL_MAGIC_LINK_TTL_MS,
} from '@/lib/portal/auth';

const MAGIC_LINK_HOURLY_LIMIT = 5;

/** Best-effort hour bucket for the rate-limit row key. */
function currentHourBucket(nowMs = Date.now()): string {
    return new Date(nowMs).toISOString().slice(0, 13); // e.g. "2026-05-18T07"
}

/**
 * Maps a public-facing tenant slug to the owner's userId — the same value
 * we store on `crm_portal_users.userId`.
 *
 * Today there's no dedicated tenant-slug column, so the slug IS the owner
 * userId (24-hex). When the proper slug column lands (TODO 6.6.x) this
 * helper is the single chokepoint to update.
 */
async function resolveTenantSlugToOwnerId(tenantSlug: string): Promise<string | null> {
    const slug = (tenantSlug || '').trim();
    if (!slug) return null;
    if (ObjectId.isValid(slug)) return slug;
    // Fallback: lookup by an optional `tenantSlug` field on the users
    // collection so a future migration that adds proper slugs lights up
    // automatically without breaking the existing 24-hex flow.
    try {
        const { db } = await connectToDatabase();
        const u = await db
            .collection('users')
            .findOne({ tenantSlug: slug } as never, { projection: { _id: 1 } });
        return u?._id ? String(u._id) : null;
    } catch {
        return null;
    }
}

interface RequestPortalMagicLinkResult {
    /** Always present and always success-shaped to avoid leaking account
     *  existence to anonymous form submitters. */
    ok: true;
    /** Truthy only on a true rate-limit reject (the caller sees a generic
     *  "try again later" message — but we still don't expose whether the
     *  account exists). */
    throttled?: boolean;
}

export async function requestPortalMagicLink(
    tenantSlug: string,
    email: string,
): Promise<RequestPortalMagicLinkResult> {
    const slug = (tenantSlug || '').trim();
    const normEmail = (email || '').trim().toLowerCase();
    if (!slug || !normEmail || !normEmail.includes('@')) {
        // Don't leak shape — return success.
        return { ok: true };
    }

    const ownerId = await resolveTenantSlugToOwnerId(slug);
    if (!ownerId) {
        // Unknown tenant — still success-shaped.
        return { ok: true };
    }

    const { db } = await connectToDatabase();

    // ── Rate limit: per (tenantId, email, hour-bucket) ────────────
    const hourBucket = currentHourBucket();
    let throttled = false;
    try {
        const limitDoc = await db
            .collection('crm_portal_magic_link_requests')
            .findOneAndUpdate(
                { tenantId: ownerId, email: normEmail, hourBucket },
                {
                    $inc: { count: 1 },
                    $setOnInsert: {
                        tenantId: ownerId,
                        email: normEmail,
                        hourBucket,
                        firstAt: new Date(),
                    },
                    $set: { lastAt: new Date() },
                } as never,
                { upsert: true, returnDocument: 'after' },
            );
        const count = (limitDoc as { value?: { count?: number } })?.value?.count
            ?? (limitDoc as { count?: number })?.count
            ?? 1;
        if (typeof count === 'number' && count > MAGIC_LINK_HOURLY_LIMIT) {
            throttled = true;
        }
    } catch {
        // Mongo blip — fail open (don't lock people out on telemetry failure).
    }

    if (throttled) {
        console.warn(
            JSON.stringify({
                event: 'portal_magic_link_throttled',
                tenantId: ownerId,
                tenantSlug: slug,
                email: normEmail,
                hourBucket,
            }),
        );
        return { ok: true, throttled: true };
    }

    // ── Look up the portal user (don't leak existence) ─────────────
    let portalUser: { _id: ObjectId; name?: string; portalType?: string } | null = null;
    try {
        const doc = await db
            .collection('crm_portal_users')
            .findOne(
                { userId: new ObjectId(ownerId), email: normEmail, status: { $ne: 'suspended' } } as never,
                { projection: { _id: 1, name: 1, portalType: 1 } },
            );
        portalUser = doc as unknown as { _id: ObjectId; name?: string; portalType?: string } | null;
    } catch {
        portalUser = null;
    }

    if (!portalUser) {
        // Structured log so an oncall can debug "I didn't get a link"
        // without exposing the result to the caller.
        console.info(
            JSON.stringify({
                event: 'portal_magic_link_requested_unknown',
                tenantId: ownerId,
                tenantSlug: slug,
                email: normEmail,
            }),
        );
        return { ok: true };
    }

    // ── Mint the magic link ────────────────────────────────────────
    const { token, expiresAt } = mintPortalMagicLink({
        tenantSlug: slug,
        email: normEmail,
    });

    const verifyPath = `/portal/${encodeURIComponent(slug)}/auth/verify?token=${encodeURIComponent(token)}`;

    // TODO 6.6.email: wire `sendTransactionalEmail({ to: normEmail, subject, html })`
    // here once the portal-specific transactional sender lands. For now we
    // emit a structured log line that a developer / log drain can route to
    // a real mailbox during the bring-up window. The link is intentionally
    // not returned to the caller (an unauthenticated form submitter must
    // not be able to read other people's links).
    console.info(
        JSON.stringify({
            event: 'portal_magic_link_requested',
            tenantId: ownerId,
            tenantSlug: slug,
            email: normEmail,
            portalUserId: String(portalUser._id),
            portalType: portalUser.portalType,
            verifyPath,
            expiresAt: expiresAt.toISOString(),
            ttlMs: PORTAL_MAGIC_LINK_TTL_MS,
        }),
    );

    return { ok: true };
}

export async function signOutFromPortal(tenantSlug: string): Promise<{ ok: true }> {
    const slug = (tenantSlug || '').trim();
    if (slug) {
        await clearPortalSessionCookie(slug);
    }
    return { ok: true };
}
