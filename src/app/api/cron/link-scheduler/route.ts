import { NextResponse, type NextRequest } from 'next/server';

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
    if (!guard.ok) {
        return NextResponse.json(guard.body, { status: guard.status });
    }

    console.log(JSON.stringify({ ts: new Date().toISOString(), event: 'cron_link_scheduler.start' }));

    const result = { message: 'Link scheduler triggered', timestamp: new Date().toISOString(), activated: 0 };

    console.log(JSON.stringify({ ts: new Date().toISOString(), event: 'cron_link_scheduler.complete', durationMs: Date.now() - startedAt, activated: result.activated }));

    return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
    return GET(request);
}
