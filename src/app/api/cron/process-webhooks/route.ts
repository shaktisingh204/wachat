
import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { processSingleWebhook } from '@/lib/webhook-processor';

// --- Types ---
type WebhookQueueItem = {
    _id: any;
    payload: any;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    createdAt: Date;
    processedAt?: Date;
    error?: string;
};

// --- Cron Endpoint ---

const BATCH_SIZE = 100; // Number of webhooks to process per run
const LOCK_ID = 'webhook_processor_lock';
const LOCK_DURATION_MS = 2 * 60 * 1000; // Lock for 2 minutes

export async function GET(request: NextRequest) {
    let db;
    let lockAcquired = false;

    try {
        const conn = await connectToDatabase();
        db = conn.db;

        // --- Acquire Lock ---
        const now = new Date();
        const lockHeldUntil = new Date(now.getTime() + LOCK_DURATION_MS);
        
        let lockResult;
        try {
            lockResult = await db.collection('locks').findOneAndUpdate(
                { _id: LOCK_ID, $or: [{ lockHeldUntil: { $exists: false } }, { lockHeldUntil: { $lt: now } }] },
                { $set: { lockHeldUntil } },
                { upsert: true, returnDocument: 'after' }
            );
        } catch (e: any) {
            if (e.code === 11000) { // Duplicate key error, means we lost the race
                lockResult = null;
            } else {
                throw e; // Re-throw other errors
            }
        }

        if (!lockResult) {
            return NextResponse.json({ message: "Webhook processor is already running." }, { status: 200 });
        }
        lockAcquired = true;
        // --- End Acquire Lock ---

        const webhooksToProcess = await db.collection<WebhookQueueItem>('webhook_queue')
            .find({ status: 'PENDING' })
            .sort({ createdAt: 1 })
            .limit(BATCH_SIZE)
            .toArray();

        if (webhooksToProcess.length === 0) {
            return NextResponse.json({ message: 'No pending webhooks to process.' });
        }

        const processingIds = webhooksToProcess.map(w => w._id);
        await db.collection('webhook_queue').updateMany(
            { _id: { $in: processingIds } },
            { $set: { status: 'PROCESSING' } }
        );

        const processingPromises = webhooksToProcess.map(async (webhookDoc) => {
            try {
                await processSingleWebhook(db, webhookDoc.payload);
                return { status: 'fulfilled', id: webhookDoc._id };
            } catch (e: any) {
                console.error(`Failed to process webhook ${webhookDoc._id}:`, e);
                return { status: 'rejected', id: webhookDoc._id, error: e.message };
            }
        });

        const results = await Promise.allSettled(processingPromises);

        let successCount = 0;
        const failedItems: {id: any, error?: string}[] = [];

        results.forEach(result => {
            if(result.status === 'fulfilled' && result.value.status === 'fulfilled') {
                successCount++;
            } else if (result.status === 'fulfilled' && result.value.status === 'rejected') {
                 failedItems.push({ id: result.value.id, error: result.value.error });
            } else if (result.status === 'rejected') {
                // This case should ideally not happen often as errors are caught inside the map
                // but good to handle it. We don't have the webhook ID here, unfortunately.
                console.error('A promise in webhook processing was rejected:', result.reason);
            }
        });
        
        // --- Update Processed Webhooks ---
        const bulkWriteOps: any[] = webhooksToProcess.map(doc => {
            const failedItem = failedItems.find(f => f.id === doc._id);
            return {
                updateOne: {
                    filter: { _id: doc._id },
                    update: { $set: {
                        status: failedItem ? 'FAILED' : 'COMPLETED',
                        processedAt: new Date(),
                        error: failedItem?.error
                    }}
                }
            }
        });
        
        if (bulkWriteOps.length > 0) {
            await db.collection('webhook_queue').bulkWrite(bulkWriteOps);
        }

        return NextResponse.json({
            message: `Processed ${webhooksToProcess.length} webhooks.`,
            success: successCount,
            failed: failedItems.length,
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
