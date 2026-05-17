/**
 * Audit-log retention cron — §1B sign-off blocker.
 *
 * Iterates every tenant root in the `users` collection and calls
 * `purgeAuditLogForTenant` to enforce its configured (or default)
 * retention window against `crm_audit_log`.
 *
 * SAFETY: defaults to dry-run. The cron will NEVER delete data unless
 * invoked with `?execute=1`. This lets operators schedule the job at
 * any cadence (Vercel cron headers will not include `?execute=1`) and
 * eyeball the report before flipping the switch.
 *
 * Auth: `Authorization: Bearer $CRON_SECRET` (Vercel cron's default,
 * mirroring `/api/cron/sla-breach-check`). `x-cron-secret: $secret`
 * is accepted as a fallback for non-Vercel schedulers.
 *
 * Response: `{ ok, dryRun, durationMs, tenants: [{ tenantUserId,
 * retentionDays, wouldDelete, deleted, cutoff }] }`.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import {
    purgeAuditLogForTenant,
    type PurgeAuditLogResult,
} from '@/lib/compliance/retention';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function authorize(
    request: NextRequest,
): { ok: true } | { ok: false; status: number; body: unknown } {
    const expected = process.env.CRON_SECRET;
    if (!expected) {
        return {
            ok: false,
            status: 503,
            body: { error: 'CRON_SECRET not configured' },
        };
    }
    const auth = request.headers.get('authorization') ?? '';
    if (auth === `Bearer ${expected}`) return { ok: true };
    const xCron = request.headers.get('x-cron-secret') ?? '';
    if (xCron === expected) return { ok: true };
    return { ok: false, status: 401, body: { error: 'Unauthorized' } };
}

async function handle(request: NextRequest): Promise<NextResponse> {
    const guard = authorize(request);
    if (!guard.ok) {
        return NextResponse.json(guard.body, { status: guard.status });
    }

    // SAFETY: dry-run is the default; only `?execute=1` flips writes on.
    const execute = request.nextUrl.searchParams.get('execute') === '1';
    const dryRun = !execute;

    const startedAt = Date.now();
    const tenants: PurgeAuditLogResult[] = [];
    const errors: Array<{ tenantUserId: string; error: string }> = [];

    try {
        const { db } = await connectToDatabase();

        // We only need tenants that actually have audit rows — pulling the
        // distinct set from `crm_audit_log` keeps this O(active tenants)
        // rather than O(all users).
        const distinctIds = (await db
            .collection('crm_audit_log')
            .distinct('userId')) as unknown[];

        for (const raw of distinctIds) {
            // `distinct` returns ObjectId | string depending on driver
            // version + how rows were inserted; coerce defensively.
            const tenantUserId =
                raw instanceof ObjectId
                    ? raw.toHexString()
                    : typeof raw === 'string' && ObjectId.isValid(raw)
                      ? raw
                      : null;
            if (!tenantUserId) continue;

            try {
                const r = await purgeAuditLogForTenant(tenantUserId, { dryRun });
                tenants.push(r);
            } catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                errors.push({ tenantUserId, error: message });
            }
        }

        return NextResponse.json({
            ok: true,
            dryRun,
            durationMs: Date.now() - startedAt,
            tenants,
            errors,
        });
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error('[audit-retention] fatal:', e);
        return NextResponse.json(
            {
                ok: false,
                dryRun,
                error: message,
                tenants,
                errors,
            },
            { status: 500 },
        );
    }
}

export async function GET(request: NextRequest) {
    return handle(request);
}

export async function POST(request: NextRequest) {
    return handle(request);
}
