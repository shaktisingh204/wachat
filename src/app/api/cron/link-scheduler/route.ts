import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorize(request: NextRequest): { ok: true } | { ok: false; status: number; body: unknown } {
    const expected = process.env.CRON_SECRET;
    if (!expected) {
        return { ok: false, status: 503, body: { error: 'CRON_SECRET not configured' } };
    }
    const auth = request.headers.get('authorization') ?? '';
    if (auth === `Bearer ${expected}`) return { ok: true };
    const xCron = request.headers.get('x-cron-secret') ?? '';
    if (xCron === expected) return { ok: true };
    return { ok: false, status: 401, body: { error: 'Unauthorized' } };
}

export async function GET(request: NextRequest) {
    const startedAt = Date.now();
    const guard = authorize(request);
    if (!guard.ok) return NextResponse.json(guard.body, { status: guard.status });

    const dryRun = new URL(request.url).searchParams.get('dryRun') === 'true';

    try {
        const { db } = await connectToDatabase();
        const coll = db.collection('short_urls');
        const now = new Date();

        if (dryRun) {
            const count = await coll.countDocuments({
                status: 'scheduled',
                activateAt: { $lte: now },
            });
            return NextResponse.json({ message: 'Dry run — no changes', wouldActivate: count, dryRun: true });
        }

        const result = await coll.updateMany(
            { status: 'scheduled', activateAt: { $lte: now } },
            { $set: { status: 'active' } }
        );

        const activated = result.modifiedCount;

        console.log(JSON.stringify({
            ts: now.toISOString(), event: 'cron_link_scheduler.complete',
            durationMs: Date.now() - startedAt, activated,
        }));

        return NextResponse.json({ message: 'Link scheduler complete', activated, durationMs: Date.now() - startedAt });
    } catch (err: unknown) {
        console.error('cron_link_scheduler error', err);
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    return GET(request);
}
