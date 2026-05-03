/**
 * GET /api/status — public status page JSON.
 *
 * Unauthenticated. Mirrors the data model used by major status providers so
 * the response can be consumed by widgets, dashboards, and uptime probes.
 *
 * Backed by the in-memory `defaultStatusStore`. Higher-level code (operators,
 * cron jobs, incident handlers) is responsible for calling
 * `defaultStatusStore.upsertComponent(...)` / `upsertIncident(...)` to keep
 * the store fresh.
 */

import { NextResponse } from 'next/server';

import { currentStatus } from '@/lib/ops/status-page';
import { currentTraceId, withSpan } from '@/lib/ops/tracing';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
    try {
        const snapshot = await withSpan('api.status.GET', () => currentStatus(), {
            attributes: { 'http.route': '/api/status' },
        });
        const traceId = currentTraceId();
        const headers: Record<string, string> = {
            'Cache-Control': 'public, max-age=10, s-maxage=10',
        };
        if (traceId) headers['x-trace-id'] = traceId;
        return NextResponse.json(snapshot, { headers });
    } catch (err) {
        // Log so the failure shows up in Vercel runtime logs / Sentry.
        console.error('[api/status] failed to compute snapshot', err);
        return NextResponse.json(
            { error: 'status_unavailable' },
            { status: 503, headers: { 'Cache-Control': 'no-store' } },
        );
    }
}
