/**
 * PageSense ingest endpoint.
 *
 * The customer-side snippet POSTs batched events here:
 *
 *   POST /api/pagesense/ingest
 *   Content-Type: application/json
 *   {
 *     "snippetKey": "<32-char site key>",
 *     "events": [
 *       { url, eventType, x, y, viewportW, viewportH, sessionId, variant?, ts? }, …
 *     ]
 *   }
 *
 * Flow:
 *   1. Validate the snippet key against the Rust `pagesense-sites`
 *      public lookup. Lookup resolves the owning `userId`.
 *   2. Mint a short-lived JWT scoped to that user.
 *   3. Forward the events to the Rust `pagesense-heatmap-events`
 *      ingest endpoint.
 *
 * Vercel runtime: Node.js (Fluid Compute default) — this route mints a
 * JWT and uses `fetch` against an internal Rust service, neither of
 * which needs the Edge runtime.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { issueRustJwt } from '@/lib/jwt-for-rust';
import { pagesenseSitesApi } from '@/lib/rust-client/sabsense-sites';

export const runtime = 'nodejs';

interface IngestBody {
    snippetKey?: string;
    events?: Array<{
        url?: string;
        eventType?: 'click' | 'move' | 'scroll';
        x?: number;
        y?: number;
        viewportW?: number;
        viewportH?: number;
        sessionId?: string;
        variant?: string;
        ts?: number;
    }>;
}

function getRustBase(): string {
    return process.env.RUST_API_URL || 'http://localhost:8080';
}

export async function POST(req: NextRequest) {
    const startedAt = Date.now();
    try {
        return await handleIngest(req, startedAt);
    } catch (e) {
        console.error('[pagesense/ingest] unhandled error', {
            err: e instanceof Error ? e.message : String(e),
            stack: e instanceof Error ? e.stack : undefined,
            durMs: Date.now() - startedAt,
        });
        return NextResponse.json({ error: 'internal error' }, { status: 500 });
    }
}

async function handleIngest(req: NextRequest, startedAt: number): Promise<NextResponse> {
    let body: IngestBody;
    try {
        body = (await req.json()) as IngestBody;
    } catch {
        console.warn('[pagesense/ingest] invalid JSON body', { durMs: Date.now() - startedAt });
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const snippetKey = (body.snippetKey || '').trim();
    if (!snippetKey) {
        return NextResponse.json({ error: 'snippetKey is required' }, { status: 400 });
    }
    if (!Array.isArray(body.events) || body.events.length === 0) {
        return NextResponse.json({ accepted: 0, rejected: 0 });
    }
    if (body.events.length > 500) {
        return NextResponse.json({ error: 'batch too large (max 500 events)' }, { status: 413 });
    }

    // 1) Resolve site + userId from the snippet key (public Rust lookup).
    let site;
    try {
        site = await pagesenseSitesApi.lookupBySnippetKey(snippetKey);
    } catch (e) {
        console.warn('[pagesense/ingest] snippet key lookup failed', {
            keyPrefix: snippetKey.slice(0, 6),
            err: e instanceof Error ? e.message : String(e),
        });
        return NextResponse.json({ error: 'invalid snippet key' }, { status: 403 });
    }
    if (!site.isActive) {
        // Site paused — silently drop without erroring so the snippet
        // doesn't spam retries.
        return NextResponse.json({ accepted: 0, rejected: body.events.length });
    }

    // 2) Filter / normalize events.
    const events = body.events
        .filter(
            (e) =>
                e &&
                typeof e.url === 'string' &&
                (e.eventType === 'click' || e.eventType === 'move' || e.eventType === 'scroll') &&
                typeof e.x === 'number' &&
                typeof e.y === 'number' &&
                typeof e.viewportW === 'number' &&
                typeof e.viewportH === 'number' &&
                typeof e.sessionId === 'string',
        )
        .map((e) => ({
            url: e.url!,
            eventType: e.eventType!,
            x: e.x!,
            y: e.y!,
            viewportW: Math.max(0, Math.floor(e.viewportW!)),
            viewportH: Math.max(0, Math.floor(e.viewportH!)),
            sessionId: e.sessionId!,
            variant: e.variant,
            ts: e.ts,
        }));

    if (events.length === 0) {
        return NextResponse.json({
            accepted: 0,
            rejected: body.events.length,
        });
    }

    // 3) Mint a JWT scoped to the site owner and forward to Rust.
    const token = await issueRustJwt({
        userId: site.userId,
        tenantId: site.userId,
        roles: ['user'],
    });

    const upstream = await fetch(
        `${getRustBase()}/v1/pagesense/heatmap-events/ingest`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ siteId: site.siteId, events }),
            cache: 'no-store',
        },
    );

    if (!upstream.ok) {
        // Don't leak upstream details to the public snippet; just say
        // we couldn't accept the batch.
        console.error('[pagesense/ingest] upstream rust ingest failed', {
            siteId: site.siteId,
            status: upstream.status,
            batchSize: events.length,
        });
        return NextResponse.json(
            { error: 'ingest failed', upstreamStatus: upstream.status },
            { status: 502 },
        );
    }

    const result = (await upstream.json()) as { accepted: number; rejected: number };
    console.info('[pagesense/ingest] accepted', {
        siteId: site.siteId,
        accepted: result.accepted,
        rejected: result.rejected,
    });
    return NextResponse.json(result, {
        headers: {
            // Snippet is cross-origin; allow it to call us.
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'content-type',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
    });
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'content-type',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Max-Age': '86400',
        },
    });
}
