/**
 * Embedded dashboards — issue and verify short-lived signed URLs that
 * embed a tenant-scoped JWT. Uses `jose` (already a project dep).
 */

import { SignJWT, jwtVerify } from 'jose';

import type { EmbeddedDashboardClaims, SignDashboardOpts } from './types';

const DEFAULT_EXPIRES_IN = 60 * 10; // 10 minutes

function getKey(): Uint8Array {
    const secret =
        process.env.ANALYTICS_EMBED_SECRET ?? process.env.JWT_SECRET ?? '';
    if (!secret) {
        throw new Error(
            'ANALYTICS_EMBED_SECRET (or JWT_SECRET) must be set to sign embedded dashboard URLs',
        );
    }
    return new TextEncoder().encode(secret);
}

/**
 * Returns a path-style signed URL of the form:
 *   /embed/dashboard/<id>?token=<jwt>
 * Callers can prefix their own origin to make it absolute.
 */
export async function signDashboardUrl(
    dashboardId: string,
    opts: SignDashboardOpts,
): Promise<string> {
    if (!dashboardId) throw new Error('dashboardId required');
    if (!opts.tenantId) throw new Error('tenantId required');
    const expiresIn = opts.expiresIn ?? DEFAULT_EXPIRES_IN;
    const token = await new SignJWT({
        ...(opts.claims ?? {}),
        dashboardId,
        tenantId: opts.tenantId,
    })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuedAt()
        .setExpirationTime(`${expiresIn}s`)
        .setSubject(`embed:${dashboardId}`)
        .sign(getKey());

    const params = new URLSearchParams({ token });
    return `/embed/dashboard/${encodeURIComponent(dashboardId)}?${params.toString()}`;
}

export async function verifyEmbedToken(
    token: string,
): Promise<EmbeddedDashboardClaims | null> {
    try {
        const { payload } = await jwtVerify(token, getKey());
        if (
            !payload ||
            typeof payload.dashboardId !== 'string' ||
            typeof payload.tenantId !== 'string' ||
            typeof payload.iat !== 'number' ||
            typeof payload.exp !== 'number'
        ) {
            return null;
        }
        return payload as unknown as EmbeddedDashboardClaims;
    } catch {
        return null;
    }
}
