/**
 * POST /api/v1/billing/usage
 *
 * Records a usage event for the authenticated tenant. Used by internal
 * services and external integrations to attribute consumption against a
 * plan's metered features.
 *
 * Request body:
 *   {
 *     feature: MeteredFeature,   // required
 *     units:   number,           // required, non-negative
 *     ts?:     string,           // ISO timestamp; defaults to now
 *     meta?:   Record<string, unknown>,
 *     idempotencyKey?: string
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/app/actions/api-keys.actions';
import { checkRateLimit } from '@/lib/rate-limiter';
import { recordUsage } from '@/lib/billing/usage-meter';
import type { MeteredFeature } from '@/lib/billing/types';

const ALLOWED_FEATURES = new Set<MeteredFeature>([
    'messages_sent',
    'broadcasts',
    'contacts',
    'ai_tokens',
    'ai_requests',
    'storage_mb',
    'workflow_executions',
    'sms_segments',
    'email_sends',
    'voice_minutes',
    'api_calls',
    'seats',
    'projects',
]);

export async function POST(request: NextRequest) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json(
            { error: 'Unauthorized: Missing API key.' },
            { status: 401 },
        );
    }
    const apiKey = authHeader.split(' ')[1];

    const authResult = await authenticateApiKey(apiKey);
    if (!authResult.success || !authResult.user) {
        return NextResponse.json(
            { error: 'Unauthorized: Invalid API key.' },
            { status: 401 },
        );
    }
    const { user } = authResult;
    const tenantId = user._id.toString();

    // Rate limit usage writes — 600/min per tenant is generous for normal
    // service-to-service traffic but blocks abusive ingest.
    const { success: rateLimitSuccess, error: rateLimitError } =
        await checkRateLimit(`billing-usage:${tenantId}`, 600, 60 * 1000);
    if (!rateLimitSuccess) {
        return NextResponse.json({ error: rateLimitError }, { status: 429 });
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: 'Invalid JSON body.' },
            { status: 400 },
        );
    }

    const { feature, units, ts, meta, idempotencyKey } =
        (body ?? {}) as {
            feature?: string;
            units?: number;
            ts?: string;
            meta?: Record<string, unknown>;
            idempotencyKey?: string;
        };

    if (!feature || !ALLOWED_FEATURES.has(feature as MeteredFeature)) {
        return NextResponse.json(
            {
                error: `feature is required and must be one of: ${[...ALLOWED_FEATURES].join(', ')}`,
            },
            { status: 400 },
        );
    }
    if (typeof units !== 'number' || !Number.isFinite(units) || units < 0) {
        return NextResponse.json(
            { error: 'units must be a non-negative finite number.' },
            { status: 400 },
        );
    }
    if (ts !== undefined && Number.isNaN(new Date(ts).getTime())) {
        return NextResponse.json(
            { error: 'ts must be a valid ISO date string.' },
            { status: 400 },
        );
    }

    const startedAt = Date.now();
    try {
        const result = await recordUsage({
            tenantId,
            feature: feature as MeteredFeature,
            units,
            ts,
            meta,
            idempotencyKey,
        });

        console.info('[billing.usage] recorded', {
            tenantId,
            feature,
            units,
            recorded: result.recorded,
            reason: result.reason,
            ms: Date.now() - startedAt,
        });

        return NextResponse.json({ success: true, ...result });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'An unexpected error occurred.';
        console.error('[billing.usage] failed', {
            tenantId,
            feature,
            units,
            error: message,
            ms: Date.now() - startedAt,
        });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
