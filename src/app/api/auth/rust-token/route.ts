/**
 * Mints a short-lived Rust BFF JWT for browser-side fetches.
 *
 * The user's session cookie is httpOnly so the browser cannot read it,
 * and `RUST_JWT_SECRET` MUST never reach the client. This endpoint
 * bridges that gap: a logged-in user POSTs (or GETs) here, the route
 * validates the cookie, and returns a freshly-minted Rust JWT plus its
 * absolute expiry so the client can cache and refresh on its own.
 *
 * The token is a 15-minute HS256 JWT identical to the one the BFF mints
 * for itself in `src/lib/rust-client/fetcher.ts` — see
 * `src/lib/jwt-for-rust.ts` for the claim layout. Roles and tenantId
 * default to the same values that the cookie-driven path uses (`tid =
 * userId`, `roles = []`) until per-tenant role plumbing exists.
 *
 * Consumed by `src/lib/rust-lookup-client.ts`.
 */

import { NextResponse } from 'next/server';
import { issueRustJwt } from '@/lib/jwt-for-rust';
import { getSession } from '@/app/actions/user.actions';

const TTL_SECONDS = 15 * 60;

async function mint(): Promise<NextResponse> {
    const session = await getSession();
    if (!session?.user?._id) {
        return NextResponse.json(
            { ok: false, error: 'unauthorized' },
            { status: 401 },
        );
    }

    let token: string;
    try {
        token = await issueRustJwt({
            userId: String(session.user._id),
            tenantId: String(session.user._id),
            roles: [],
        });
    } catch (err) {
        console.error('[rust-token] mint failed:', err);
        return NextResponse.json(
            { ok: false, error: 'mint_failed' },
            { status: 500 },
        );
    }

    const expiresAt = Date.now() + TTL_SECONDS * 1000;

    return NextResponse.json(
        { token, expiresAt, expiresIn: TTL_SECONDS },
        {
            status: 200,
            headers: {
                // Token is per-user — must never be cached by an intermediary.
                'Cache-Control': 'private, no-store',
            },
        },
    );
}

export async function POST() {
    return mint();
}

export async function GET() {
    return mint();
}
