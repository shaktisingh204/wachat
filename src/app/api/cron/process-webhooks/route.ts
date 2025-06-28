
import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { processSingleWebhook, processStatuses } from '@/lib/webhook-processor';
import type { Db } from 'mongodb';

type WebhookQueueItem = {
    _id: any;
    payload: any;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    createdAt: Date;
    processedAt?: Date;
    error?: string;
};

const BATCH_SIZE = 5000; // Number of webhooks to fetch from the queue per DB roundtrip
const LOCK_ID = 'webhook_processor_lock';
const LOCK_DURATION_MS = 10 * 60 * 1000; // Lock for 10 minutes to allow for large queue processing

async function processBatch(db: Db, batch: WebhookQueueItem[]): Promise<{ success: number; failed: number }> {
    const messageWebhooks = batch.filter(wh => wh.payload?.entry?.[0]?.changes?.[0]?.field === 'messages');
    const otherWebhooks = batch.filter(wh => wh.payload?.entry?.[0]?.changes?.[0]?.field !== 'messages');
    
    let localSuccess = 0;
    let localFailed = 0;

    // Process "other" webhooks individually as they are varied
    const otherPromises = otherWebhooks.map(async (webhookDoc) => {
        try {
            await processSingleWebhook(db, webhookDoc.payload);
            localSuccess++;
        } catch (e: any) {
            console.error(`Failed to process non-message webhook ${webhookDoc._id}:`, e);
            localFailed++;
            await db.collection('webhook_queue').updateOne({ _id: webhookDoc._id }, { $set: { status: 'FAILED', error: e.message } });
        }
    });

    // Process all message status updates in a single, highly optimized batch
    const allStatuses = messageWebhooks
        .map(wh => wh.payload?.entry?.[0]?.changes?.[0]?.value?.statuses)
        .filter(Boolean)
        .flat();

    if (allStatuses.length > 0) {
        try {
            await processStatuses(db, allStatuses);
        } catch (e: any) {
            console.error('Error batch processing webhook statuses:', e);
            // If the whole batch fails, we can't easily mark individual items
            // They will remain as "PROCESSING" and can be retried. A more granular error handling is in processStatuses.
        }
    }

    // Process incoming messages individually, as they require contact upserts
    const incomingMessageWebhooks = messageWebhooks.filter(wh => wh.payload?.entry?.[0]?.changes?.[0]?.value?.messages);
    const incomingMessagePromises = incomingMessageWebhooks.map(async (webhookDoc) => {
        try {
            await processSingleWebhook(db, webhookDoc.payload);
        } catch (e: any) {
            console.error(`Failed to process incoming message webhook ${webhookDoc._id}:`, e);
            // This failure is for a single message webhook, mark it as FAILED
            await db.collection('webhook_queue').updateOne({ _id: webhookDoc._id }, { $set: { status: 'FAILED', error: e.message } });
            localFailed++;
        }
    });
    
    // All message webhooks that didn't have incoming messages are implicitly successful status-only webhooks
    localSuccess += messageWebhooks.length - incomingMessageWebhooks.length;
    // Add successes from individually processed incoming messages
    localSuccess += incomingMessageWebhooks.length - incomingMessagePromises.filter(p => p.catch(() => {})).length;


    await Promise.all([...otherPromises, ...incomingMessagePromises]);
    
    // Mark all successfully handled items in the batch as COMPLETED, except those already marked FAILED
    const idsToComplete = batch.map(b => b._id);
    await db.collection('webhook_queue').updateMany(
        { _id: { $in: idsToComplete }, status: 'PROCESSING' },
        { $set: { status: 'COMPLETED' } }
    );

    return { success: localSuccess, failed: localFailed };
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
