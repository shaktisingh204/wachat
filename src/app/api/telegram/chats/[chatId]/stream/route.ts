/**
 * Telegram Chats — live message stream proxy (SSE).
 *
 * `GET /api/telegram/chats/[chatId]/stream?projectId=…&botId=…`
 *
 * The browser cannot send the `Authorization: Bearer …` header that the
 * Rust BFF requires for `/v1/telegram/chats/c/{chatId}/stream`, so this
 * route handler:
 *   1. authenticates the caller via the Next.js session cookie,
 *   2. mints a short-lived JWT for the Rust BFF, and
 *   3. pipes the upstream `text/event-stream` body straight through to
 *      the browser.
 *
 * Heartbeats and idle timeout come from the Rust side; this proxy is a
 * pure passthrough.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { getSession } from '@/app/actions/user.actions';
import { issueRustJwt } from '@/lib/jwt-for-rust';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ chatId: string }> };

const DEFAULT_BASE_URL = 'http://localhost:8080';

function getBaseUrl(): string {
    return process.env.RUST_API_URL || DEFAULT_BASE_URL;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
    const session = await getSession();
    if (!session?.user) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { chatId } = await params;
    const url = new URL(req.url);
    const projectId = url.searchParams.get('projectId');
    const botId = url.searchParams.get('botId');
    if (!projectId) {
        return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    const userId =
        (session.user as { _id?: string | { toString(): string } })._id?.toString() ??
        (session.user as { id?: string }).id ??
        '';
    if (!userId) {
        return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const token = await issueRustJwt({
        userId: String(userId),
        tenantId: String(userId),
        roles: [],
    });

    const upstreamQs = new URLSearchParams({ projectId });
    if (botId) upstreamQs.set('botId', botId);
    const upstreamUrl = `${getBaseUrl()}/v1/telegram/chats/c/${encodeURIComponent(
        chatId,
    )}/stream?${upstreamQs.toString()}`;

    let upstream: Response;
    try {
        upstream = await fetch(upstreamUrl, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'text/event-stream',
            },
            // Abort the upstream request when the browser disconnects.
            signal: req.signal,
            cache: 'no-store',
        });
    } catch (err) {
        return NextResponse.json(
            { error: 'Upstream stream unreachable', detail: String(err) },
            { status: 502 },
        );
    }

    if (!upstream.ok || !upstream.body) {
        const text = await upstream.text().catch(() => '');
        return NextResponse.json(
            { error: `Upstream error ${upstream.status}`, detail: text },
            { status: upstream.status || 502 },
        );
    }

    return new Response(upstream.body, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    });
}
