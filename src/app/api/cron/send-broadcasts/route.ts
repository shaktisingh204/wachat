import { NextResponse, type NextRequest } from 'next/server';
import { issueRustJwt } from '@/lib/jwt-for-rust';

export const dynamic = 'force-dynamic';

/**
 * Broadcast cron — picks up any broadcasts stuck in PENDING_PROCESSING /
 * QUEUED and re-enqueues them onto the BullMQ `broadcast-control` queue.
 *
 * As of Phase 6 the actual sweep (Mongo find + queue push + status
 * update) lives in Rust at `POST /v1/wachat/broadcast/admin/requeue-stuck`
 * (see `rust/crates/wachat-broadcast`). This route is a thin proxy:
 * it mints a system admin JWT and forwards. The BullMQ worker
 * (`src/workers/broadcast/index.js`) is the primary processor — this
 * cron just ensures nothing gets stuck.
 *
 * Auth note: there is no user session for a cron call, so we mint a
 * synthetic admin JWT here. `RUST_JWT_SECRET` is the only secret in
 * play; rotating it locks the cron out, which is the desired property.
 */

const SYSTEM_USER_ID = '000000000000000000000000';
const SYSTEM_TENANT_ID = '000000000000000000000000';

async function callRequeueStuck(): Promise<{ status: number; body: any }> {
    const baseUrl = process.env.RUST_API_URL || 'http://localhost:8080';
    const token = await issueRustJwt({
        userId: SYSTEM_USER_ID,
        tenantId: SYSTEM_TENANT_ID,
        roles: ['admin'],
    });

    const res = await fetch(`${baseUrl}/v1/wachat/broadcast/admin/requeue-stuck`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
        },
        cache: 'no-store',
    });

    let body: any = null;
    try {
        body = await res.json();
    } catch {
        body = { message: `${res.status} ${res.statusText}` };
    }
    return { status: res.status, body };
}

export async function GET(_request: NextRequest) {
    try {
        const { status, body } = await callRequeueStuck();
        if (status >= 400) {
            return NextResponse.json(
                { message: 'Rust requeue-stuck failed', status, ...body },
                { status: 502 },
            );
        }
        return NextResponse.json(body);
    } catch (error: any) {
        console.error('[BCAST-CRON] Error:', error);
        return NextResponse.json(
            {
                message: 'Error',
                error: error?.message ?? String(error),
                stack: error?.stack?.split('\n').slice(0, 5),
            },
            { status: 500 },
        );
    }
}

export async function POST(request: NextRequest) {
    return GET(request);
}
