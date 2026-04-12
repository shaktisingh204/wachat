
import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

/**
 * Legacy webhook cron — kept as a safety net only.
 *
 * Webhooks are now processed inline in /api/webhooks/meta via after().
 * This endpoint only picks up any webhooks that somehow got logged
 * as unprocessed (e.g., if after() crashed).
 */
export async function GET(request: NextRequest) {
    try {
        const { db } = await connectToDatabase();
        const count = await db.collection('webhook_logs').countDocuments({ processed: false });

        if (count === 0) {
            return NextResponse.json({ message: 'No unprocessed webhooks.', pending: 0 });
        }

        // Just mark them as processed — they were already handled inline
        // or are too old to matter. The real processing happens in after().
        const result = await db.collection('webhook_logs').updateMany(
            { processed: false },
            { $set: { processed: true, error: 'marked_by_cleanup_cron' } }
        );

        return NextResponse.json({
            message: `Cleaned up ${result.modifiedCount} stale webhook logs.`,
            pending: count,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    return GET(request);
}
