
import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { enqueueBroadcastControl } from '@/lib/queue/broadcast-queue';

export const dynamic = 'force-dynamic';

/**
 * Broadcast cron — picks up any broadcasts stuck in PENDING_PROCESSING
 * and re-enqueues them into BullMQ. This is a safety net for cases where
 * the worker was down when the broadcast was created, or BullMQ lost the job.
 *
 * The BullMQ worker (src/workers/broadcast/index.js) is the primary
 * processor — this cron just ensures nothing gets stuck.
 */
async function processStuckBroadcasts() {
    const { db } = await connectToDatabase();

    // Find broadcasts stuck in PENDING_PROCESSING for more than 30 seconds
    const cutoff = new Date(Date.now() - 30_000);

    const stuckBroadcasts = await db.collection('broadcasts').find({
        status: { $in: ['PENDING_PROCESSING', 'QUEUED'] },
        $or: [
            { createdAt: { $lte: cutoff } },
            { updatedAt: { $exists: false } },
        ],
    }).limit(50).toArray();

    if (stuckBroadcasts.length === 0) {
        return { message: 'No stuck broadcasts found.' };
    }

    let enqueued = 0;
    const errors: string[] = [];
    for (const broadcast of stuckBroadcasts) {
        try {
            await enqueueBroadcastControl(broadcast._id.toString());
            // Also update status to ensure worker picks it up
            await db.collection('broadcasts').updateOne(
                { _id: broadcast._id },
                { $set: { status: 'PENDING_PROCESSING', updatedAt: new Date() } }
            );
            enqueued++;
            console.log(`[BCAST-CRON] Re-enqueued broadcast ${broadcast._id}`);
        } catch (e: any) {
            const msg = e.message || String(e);
            console.error(`[BCAST-CRON] Failed to re-enqueue broadcast ${broadcast._id}:`, msg);
            errors.push(`${broadcast._id}: ${msg}`);
        }
    }

    return {
        message: `Re-enqueued ${enqueued} of ${stuckBroadcasts.length} stuck broadcast(s).`,
        errors: errors.length > 0 ? errors : undefined,
    };
}

export async function GET(request: NextRequest) {
    try {
        // Quick Redis health check first
        let redisOk = false;
        try {
            const { broadcastControlQueue } = await import('@/lib/queue/broadcast-queue');
            const client = await broadcastControlQueue.client;
            const pong = await client.ping();
            redisOk = pong === 'PONG';
        } catch (redisErr: any) {
            return NextResponse.json({
                message: 'Redis connection failed',
                error: redisErr.message,
                redisUrl: process.env.REDIS_URL ? '(set)' : '(NOT SET)',
            }, { status: 500 });
        }

        const result = await processStuckBroadcasts();
        return NextResponse.json({ ...result, redisOk });
    } catch (error: any) {
        console.error('[BCAST-CRON] Error:', error);
        return NextResponse.json({ message: 'Error', error: error.message, stack: error.stack?.split('\n').slice(0, 5) }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    return GET(request as NextRequest);
}
