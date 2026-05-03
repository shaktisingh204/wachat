/**
 * POST /api/v1/marketplace/usage
 *
 * Records consumption from an installed marketplace app, fanning out to the
 * billing usage meter (Impl 8) and queuing the partner commission payout
 * (Impl 20). The endpoint is authenticated via the same API-key surface the
 * Developer Platform exposes (Integrator 22).
 *
 * Request body:
 *
 *   {
 *     "install_id":       "65fe...",   // required — Install ObjectId
 *     "units":            42,           // required — non-negative number
 *     "ts":               "2026-04-25T11:00:00Z",  // optional — ISO timestamp
 *     "idempotency_key":  "evt-abc",   // optional — dedupe retries
 *     "meta":             { "...": "..." }  // optional — free-form
 *   }
 *
 * Authentication: bearer API key OR `X-Api-Key`. The key must hold the
 * wildcard `*` scope (no `marketplace:*` scope is published yet — once
 * Integrator 22 adds it the requireScope call below should be tightened).
 *
 * Rate-limited by the standard tier bucket. 429 on exhaustion.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    consumeToken,
    rateLimitHeaders,
    requireScope,
    verifyApiKey,
} from '@/lib/api-platform';
import { recordAppUsage } from '@/lib/marketplace/usage-bridge';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface UsageRequestBody {
    install_id?: unknown;
    units?: unknown;
    ts?: unknown;
    idempotency_key?: unknown;
    meta?: unknown;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
    // ── 1. Auth ─────────────────────────────────────────────────────────
    const ctx = await verifyApiKey(req);
    if (!ctx) {
        return NextResponse.json(
            { error: 'Missing or invalid API key' },
            { status: 401 },
        );
    }

    const limit = await consumeToken(ctx.keyId, ctx.tier);
    if (!limit.allowed) {
        return NextResponse.json(
            { error: 'Rate limit exceeded' },
            { status: 429, headers: rateLimitHeaders(limit) },
        );
    }

    // The OAuthScope union doesn't yet enumerate `marketplace:*`, so we
    // require the platform-wide `*` scope until Integrator 22 publishes it.
    if (!requireScope('*', ctx)) {
        return NextResponse.json(
            { error: 'Missing required scope: * (marketplace usage)' },
            { status: 403, headers: rateLimitHeaders(limit) },
        );
    }

    // ── 2. Parse + validate body ────────────────────────────────────────
    let raw: UsageRequestBody;
    try {
        raw = (await req.json()) as UsageRequestBody;
    } catch {
        return NextResponse.json(
            { error: 'Invalid JSON body' },
            { status: 400, headers: rateLimitHeaders(limit) },
        );
    }

    const installId = typeof raw.install_id === 'string' ? raw.install_id : '';
    const units = typeof raw.units === 'number' ? raw.units : NaN;

    if (!installId) {
        return NextResponse.json(
            { error: 'install_id is required' },
            { status: 400, headers: rateLimitHeaders(limit) },
        );
    }
    if (!Number.isFinite(units) || units < 0) {
        return NextResponse.json(
            { error: 'units must be a non-negative finite number' },
            { status: 400, headers: rateLimitHeaders(limit) },
        );
    }

    const ts =
        typeof raw.ts === 'string' && raw.ts.length > 0 ? raw.ts : undefined;
    const idempotencyKey =
        typeof raw.idempotency_key === 'string' && raw.idempotency_key.length > 0
            ? raw.idempotency_key
            : undefined;
    const meta =
        raw.meta && typeof raw.meta === 'object' && !Array.isArray(raw.meta)
            ? (raw.meta as Record<string, unknown>)
            : undefined;

    // ── 3. Execute ──────────────────────────────────────────────────────
    const startedAt = Date.now();
    const requestId =
        req.headers.get('x-request-id') ?? `mp_use_${startedAt}_${Math.random().toString(36).slice(2, 8)}`;

    try {
        const result = await recordAppUsage({
            installId,
            units,
            ts,
            idempotencyKey,
            meta: {
                ...(meta ?? {}),
                api_tenant_id: ctx.tenantId,
                api_key_id: ctx.keyId,
                request_id: requestId,
            },
        });

        // Structured log — picked up by Vercel Runtime Logs / Datadog parser.
        console.log(
            JSON.stringify({
                level: 'info',
                event: 'marketplace.usage.recorded',
                request_id: requestId,
                tenant_id: ctx.tenantId,
                key_id: ctx.keyId,
                install_id: installId,
                units,
                feature: result.feature,
                commission_cents: result.commissionCents,
                recorded: result.recorded,
                reason: result.reason,
                duration_ms: Date.now() - startedAt,
            }),
        );

        return NextResponse.json(
            {
                recorded: result.recorded,
                event_id: result.eventId,
                feature: result.feature,
                commission_cents: result.commissionCents,
                reason: result.reason,
            },
            {
                status: result.recorded ? 201 : 200,
                headers: { ...rateLimitHeaders(limit), 'x-request-id': requestId },
            },
        );
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        const status = /not found/i.test(message) ? 404 : 400;

        console.error(
            JSON.stringify({
                level: 'error',
                event: 'marketplace.usage.failed',
                request_id: requestId,
                tenant_id: ctx.tenantId,
                key_id: ctx.keyId,
                install_id: installId,
                units,
                error: message,
                stack: err instanceof Error ? err.stack : undefined,
                duration_ms: Date.now() - startedAt,
            }),
        );

        return NextResponse.json(
            { error: message, request_id: requestId },
            {
                status,
                headers: { ...rateLimitHeaders(limit), 'x-request-id': requestId },
            },
        );
    }
}
