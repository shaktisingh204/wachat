import { NextRequest, NextResponse } from 'next/server';
import { runScheduledFlows } from '@/app/actions/sabflow.actions';

/**
 * Vercel Cron entry point for SabFlow scheduled triggers.
 *
 * Configure in vercel.ts or vercel.json:
 *   crons: [{ path: '/api/sabflow/cron/run-scheduled', schedule: '* * * * *' }]
 *
 * Optional: protect with CRON_SECRET header. If `CRON_SECRET` env is set,
 * requests must include `Authorization: Bearer <CRON_SECRET>` (Vercel Cron
 * automatically sends this header for configured crons).
 */
export async function GET(request: NextRequest) {
    const secret = process.env.CRON_SECRET;
    if (secret) {
        const header = request.headers.get('authorization') || '';
        if (header !== `Bearer ${secret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    try {
        const result = await runScheduledFlows(new Date());
        return NextResponse.json({ ok: true, ...result });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Scheduled run failed.' }, { status: 500 });
    }
}

// Allow POST too for manual triggering
export const POST = GET;
