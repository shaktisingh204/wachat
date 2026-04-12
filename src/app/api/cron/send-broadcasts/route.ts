
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
    for (const broadcast of stuckBroadcasts) {
        try {
            await enqueueBroadcastControl(broadcast._id.toString());
            enqueued++;
        } catch (e: any) {
            console.error(`[BCAST-CRON] Failed to re-enqueue broadcast ${broadcast._id}:`, e.message);
        }
    }

    return { message: `Re-enqueued ${enqueued} of ${stuckBroadcasts.length} stuck broadcast(s).` };
}

export async function GET(request: NextRequest) {
    try {
        const result = await processStuckBroadcasts();
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('[BCAST-CRON] Error:', error);
        return new NextResponse(`Internal Server Error: ${error.message}`, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    return GET(request as NextRequest);
}
