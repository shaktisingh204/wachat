import { NextResponse, type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Legacy webhook cron — thin forwarding proxy to the Rust BFF.
 *
 * Webhooks are processed inline in `/api/webhooks/meta` via `after()`. This
 * endpoint only sweeps `webhook_logs` rows that somehow ended up with
 * `processed: false` (e.g. if `after()` crashed) and marks them clean.
 *
 * The actual sweep is implemented in the Rust crate `wachat-webhook-dlq`
 * under `POST /v1/wachat/webhook/cron/drain-dlq`. Auth is a shared
 * `CRON_SECRET` (no tenant gate). We forward whichever credential the caller
 * presents — Vercel cron uses `Authorization: Bearer $CRON_SECRET`, ops
 * scripts may use `x-cron-secret`.
 */
async function forwardToRust(request: NextRequest) {
    const baseUrl = process.env.RUST_API_URL || 'http://localhost:8080';
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
        return NextResponse.json(
            { error: 'CRON_SECRET not configured' },
            { status: 503 },
        );
    }

    // Prefer the caller-presented credential so the proxy stays transparent.
    // Fall back to the local `CRON_SECRET` so the route also works when
    // invoked from inside the Vercel runtime without the header set
    // (Vercel adds `Authorization: Bearer $CRON_SECRET` itself for scheduled
    // crons, so this branch is mostly belt-and-braces).
    const presentedAuth = request.headers.get('authorization');
    const presentedCronSecret = request.headers.get('x-cron-secret');

    const headers: Record<string, string> = {
        'content-type': 'application/json',
    };
    if (presentedAuth) {
        headers['authorization'] = presentedAuth;
    } else if (presentedCronSecret) {
        headers['x-cron-secret'] = presentedCronSecret;
    } else {
        // Vercel cron always sends Authorization: Bearer $CRON_SECRET, but if
        // we end up here (manual invocation, internal trigger), self-sign with
        // the local env so the Rust handler accepts the call.
        headers['authorization'] = `Bearer ${cronSecret}`;
    }

    try {
        const res = await fetch(`${baseUrl}/v1/wachat/webhook/cron/drain-dlq`, {
            method: 'POST',
            headers,
            cache: 'no-store',
        });
        const body = await res.json().catch(() => ({}));
        return NextResponse.json(body, { status: res.status });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    return forwardToRust(request);
}

export async function POST(request: NextRequest) {
    return forwardToRust(request);
}
