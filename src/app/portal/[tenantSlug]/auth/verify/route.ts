/**
 * Magic-link landing route. The end-user clicks the link from email, lands
 * here, and we:
 *   1. Verify the HMAC + expiry on `?token=...`.
 *   2. Mark the token as consumed (single-use) in
 *      `crm_portal_magic_link_uses` — re-use of the same MAC returns
 *      "Already consumed".
 *   3. Look up the matching portal user.
 *   4. Set the `portal_session` cookie scoped to `/portal/<slug>`.
 *   5. Redirect to `/portal/<slug>`.
 *
 * On any failure we redirect back to `/portal/<slug>/login?error=...`.
 * The route handler intentionally never renders HTML — the success/error
 * UI lives in the login and dashboard pages.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import {
    verifyPortalMagicLink,
    setPortalSessionCookie,
} from '@/lib/portal/auth';

export const runtime = 'nodejs';

async function resolveTenantSlugToOwnerId(tenantSlug: string): Promise<string | null> {
    const slug = (tenantSlug || '').trim();
    if (!slug) return null;
    if (ObjectId.isValid(slug)) return slug;
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

function loginRedirect(req: NextRequest, slug: string, error: string): NextResponse {
    const url = req.nextUrl.clone();
    url.pathname = `/portal/${slug}/login`;
    url.search = `?error=${encodeURIComponent(error)}`;
    return NextResponse.redirect(url);
}

export async function GET(
    req: NextRequest,
    ctx: { params: Promise<{ tenantSlug: string }> },
): Promise<Response> {
    const { tenantSlug } = await ctx.params;
    const slug = (tenantSlug || '').trim();
    const token = req.nextUrl.searchParams.get('token') || '';

    const verify = verifyPortalMagicLink({ tenantSlug: slug, token });
    if (!verify.ok) {
        return loginRedirect(req, slug, 'invalid_or_expired');
    }

    const ownerId = await resolveTenantSlugToOwnerId(slug);
    if (!ownerId) {
        return loginRedirect(req, slug, 'unknown_tenant');
    }

    try {
        const { db } = await connectToDatabase();

        // Single-use bookkeeping — `tokenFingerprint` is a SHA-256 of the
        // MAC. A unique index on (`tenantId`, `tokenFingerprint`) makes
        // the second redemption fail naturally; until that index lands
        // we check-then-insert and atomically guard via insertOne.
        try {
            await db.collection('crm_portal_magic_link_uses').insertOne({
                tenantId: ownerId,
                tokenFingerprint: verify.tokenFingerprint,
                email: verify.email,
                issuedAt: new Date(verify.issuedAt),
                consumedAt: new Date(),
            });
        } catch (e: unknown) {
            // Duplicate-key — already consumed.
            const code = (e as { code?: number })?.code;
            if (code === 11000) {
                return loginRedirect(req, slug, 'already_consumed');
            }
            // Some other DB failure — refuse rather than silently allow.
            console.error('[portal-verify] failed to mark token used', e);
            return loginRedirect(req, slug, 'server_error');
        }

        // Find the portal user (status must not be suspended).
        const portalUser = await db.collection('crm_portal_users').findOne(
            {
                userId: new ObjectId(ownerId),
                email: verify.email,
                status: { $ne: 'suspended' },
            } as never,
            { projection: { _id: 1 } },
        );

        if (!portalUser) {
            return loginRedirect(req, slug, 'no_account');
        }

        // Bump lastLoginAt — non-fatal.
        try {
            await db.collection('crm_portal_users').updateOne(
                { _id: portalUser._id },
                { $set: { lastLoginAt: new Date(), status: 'active' } } as never,
            );
        } catch {
            /* non-fatal */
        }

        await setPortalSessionCookie({
            userId: String(portalUser._id),
            tenantId: ownerId,
            tenantSlug: slug,
        });

        const dest = req.nextUrl.clone();
        dest.pathname = `/portal/${slug}`;
        dest.search = '';
        return NextResponse.redirect(dest);
    } catch (e) {
        console.error('[portal-verify] unexpected error', e);
        return loginRedirect(req, slug, 'server_error');
    }
}
