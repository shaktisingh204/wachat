import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

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
    const CONCURRENCY = 10;
    const TIMEOUT_MS = 8000;

    try {
        const { db } = await connectToDatabase();
        const coll = db.collection('short_urls');

        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
        const urls = await coll.find({
            status: { $in: ['active', null, undefined] },
            $or: [
                { healthCheckedAt: { $lt: sixHoursAgo } },
                { healthCheckedAt: { $exists: false } },
            ],
        }, {
            projection: { _id: 1, originalUrl: 1, healthStatus: 1 },
            limit: 200,
        }).toArray();

        if (urls.length === 0) {
            return NextResponse.json({ message: 'No URLs to check', checked: 0, durationMs: Date.now() - startedAt });
        }

        let checked = 0, ok = 0, dead = 0;

        for (let i = 0; i < urls.length; i += CONCURRENCY) {
            const batch = urls.slice(i, i + CONCURRENCY);
            await Promise.all(batch.map(async (urlDoc) => {
                let newStatus: 'ok' | 'dead' = 'dead';
                try {
                    const controller = new AbortController();
                    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
                    const res = await fetch(urlDoc.originalUrl, {
                        method: 'HEAD',
                        redirect: 'follow',
                        signal: controller.signal,
                    });
                    clearTimeout(timer);
                    newStatus = res.ok || res.status < 400 ? 'ok' : 'dead';
                } catch {
                    newStatus = 'dead';
                }

                if (newStatus === 'ok') ok++; else dead++;
                checked++;

                if (!dryRun) {
                    await coll.updateOne(
                        { _id: urlDoc._id },
                        { $set: { healthStatus: newStatus, healthCheckedAt: new Date() } }
                    );
                }
            }));
        }

        console.log(JSON.stringify({
            ts: new Date().toISOString(), event: 'cron_url_health.complete',
            durationMs: Date.now() - startedAt, checked, ok, dead, dryRun,
        }));

        return NextResponse.json({ message: 'URL health check complete', checked, ok, dead, dryRun, durationMs: Date.now() - startedAt });
    } catch (err: unknown) {
        console.error('cron_url_health error', err);
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    return GET(request);
}
