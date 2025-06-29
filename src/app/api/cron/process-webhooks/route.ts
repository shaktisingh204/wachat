
import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { processSingleWebhook } from '@/lib/webhook-processor';
import type { Db, ObjectId } from 'mongodb';

type WebhookQueueItem = {
    _id: any;
    payload: any;
    logId?: ObjectId;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    createdAt: Date;
    processedAt?: Date;
    error?: string;
};

const BATCH_SIZE = 5000; // Number of webhooks to fetch from the queue per DB roundtrip
const LOCK_ID = 'webhook_processor_lock';
const LOCK_DURATION_MS = 10 * 60 * 1000; // Lock for 10 minutes to allow for large queue processing

async function processBatch(db: Db, batch: WebhookQueueItem[]): Promise<{ success: number; failed: number }> {
    let successCount = 0;
    let failedCount = 0;

    const processingPromises = batch.map(async (webhookDoc) => {
        try {
            await processSingleWebhook(db, webhookDoc.payload, webhookDoc.logId);
            // If processSingleWebhook doesn't throw, we consider it a success.
            // The log will be marked as `processed: true` inside that function.
            return 'success';
        } catch (e: any) {
            console.error(`Failed to process webhook from queue (logId: ${webhookDoc.logId}):`, e.message);
            // Mark the queue item itself as failed
            await db.collection('webhook_queue').updateOne({ _id: webhookDoc._id }, { $set: { status: 'FAILED', error: e.message } });
            // The log itself is marked as failed inside processSingleWebhook's catch block.
            return 'failed';
        }
    });

    const results = await Promise.all(processingPromises);
    successCount = results.filter(r => r === 'success').length;
    failedCount = results.filter(r => r === 'failed').length;

    // Mark all successfully handled items as COMPLETED
    const successfulIds = batch.filter((_, i) => results[i] === 'success').map(doc => doc._id);
    if (successfulIds.length > 0) {
        await db.collection('webhook_queue').updateMany(
            { _id: { $in: successfulIds }, status: 'PROCESSING' },
            { $set: { status: 'COMPLETED' } }
        );
    }

    return { success: successCount, failed: failedCount };
}


export async function GET(request: NextRequest) {
    let db;
    let lockAcquired = false;

    try {
        const conn = await connectToDatabase();
        db = conn.db;

        // --- Acquire Lock ---
        const now = new Date();
        const lockHeldUntil = new Date(now.getTime() + LOCK_DURATION_MS);
        
        const lockResult = await db.collection('locks').findOneAndUpdate(
            { _id: LOCK_ID, $or: [{ lockHeldUntil: { $exists: false } }, { lockHeldUntil: { $lt: now } }] },
            { $set: { lockHeldUntil } },
            { upsert: true, returnDocument: 'after' }
        ).catch(e => {
            if (e.code === 11000) return null; // Race condition lost
            throw e;
        });

        if (!lockResult) {
            return NextResponse.json({ message: "Webhook processor is already running." }, { status: 200 });
        }
        lockAcquired = true;
        // --- End Acquire Lock ---
        
        let totalProcessed = 0;
        let totalSuccess = 0;
        let totalFailed = 0;

        while(true) {
            const batch = await db.collection<WebhookQueueItem>('webhook_queue')
                .find({ status: 'PENDING' })
                .sort({ createdAt: 1 })
                .limit(BATCH_SIZE)
                .toArray();

            if (batch.length === 0) {
                break; // No more items to process
            }
            
            const processingIds = batch.map(w => w._id);
            await db.collection('webhook_queue').updateMany(
                { _id: { $in: processingIds } },
                { $set: { status: 'PROCESSING', processedAt: new Date() } }
            );

            const batchResult = await processBatch(db, batch);
            totalProcessed += batch.length;
            totalSuccess += batchResult.success;
            totalFailed += batchResult.failed;
        }


        if (totalProcessed === 0) {
            return NextResponse.json({ message: 'No pending webhooks to process.' });
        }

        return NextResponse.json({
            message: `Processed ${totalProcessed} webhooks in this run.`,
            success: totalSuccess,
            failed: totalFailed,
        });

    } catch (error: any) {
        console.error('Error in webhook processing cron:', error);
        return new NextResponse(`Internal Server Error: ${error.message}`, { status: 500 });
    } finally {
        if (lockAcquired && db) {
            try {
                await db.collection('locks').updateOne({ _id: LOCK_ID }, { $set: { lockHeldUntil: new Date(0) } }); // Release lock
            } catch (e) {
                console.error("Failed to release webhook processor lock:", e);
            }
        }
    }
}

export async function POST(request: Request) {
    return GET(request as NextRequest);
}
