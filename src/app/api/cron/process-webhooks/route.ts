
'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { processIncomingMessageBatch, processStatusUpdateBatch, processSingleWebhook } from '@/lib/webhook-processor';
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

const BATCH_SIZE = 5000;
const LOCK_ID = 'webhook_processor_lock';
const LOCK_DURATION_MS = 10 * 60 * 1000;

export async function GET(request: NextRequest) {
    let db: Db;
    let lockAcquired = false;

    try {
        const conn = await connectToDatabase();
        db = conn.db;

        // Acquire Lock
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
            if (e.code === 11000) { // Duplicate key error from a race condition
                lockResult = null; // We lost the race
            } else {
                throw e; // Re-throw other unexpected errors
            }
        }


        if (!lockResult) {
            return NextResponse.json({ message: "Webhook processor is already running." }, { status: 200 });
        }
        lockAcquired = true;
        
        let totalProcessed = 0;
        let totalSuccess = 0;
        let totalFailed = 0;
        let hasMore = true;

        while(hasMore) {
            const batch = await db.collection<WebhookQueueItem>('webhook_queue')
                .find({ status: 'PENDING' })
                .sort({ createdAt: 1 })
                .limit(BATCH_SIZE)
                .toArray();

            if (batch.length === 0) {
                hasMore = false;
                break;
            }
            
            const processingIds = batch.map(w => w._id);
            await db.collection('webhook_queue').updateMany(
                { _id: { $in: processingIds } },
                { $set: { status: 'PROCESSING', processedAt: new Date() } }
            );

            const statusUpdates: any[] = [];
            const incomingMessages: any[] = [];
            const otherEvents: WebhookQueueItem[] = [];

            for (const item of batch) {
                const field = item.payload?.entry?.[0]?.changes?.[0]?.field;
                if (field === 'messages') {
                    const value = item.payload?.entry?.[0]?.changes?.[0]?.value;
                    if (value?.statuses) statusUpdates.push(...value.statuses);
                    if (value?.messages) {
                         incomingMessages.push({
                            wabaId: item.payload?.entry?.[0]?.id,
                            messages: value.messages,
                            contacts: value.contacts,
                            metadata: value.metadata,
                        });
                    }
                } else {
                    otherEvents.push(item);
                }
            }

            // Process message batches
            let messageBatchSuccess = true;
            try {
                if (incomingMessages.length > 0 || statusUpdates.length > 0) {
                    const [statusResult, messageResult] = await Promise.all([
                        processStatusUpdateBatch(db, statusUpdates),
                        processIncomingMessageBatch(db, incomingMessages)
                    ]);
                    if (statusResult.failed > 0 || messageResult.failed > 0) {
                        messageBatchSuccess = false;
                    }
                    totalSuccess += statusResult.success + messageResult.success;
                    totalFailed += statusResult.failed + messageResult.failed;
                }
            } catch (e: any) {
                console.error("Error during batch message processing:", e);
                messageBatchSuccess = false;
            }
            
            const messageEventIds = batch.filter(item => item.payload?.entry?.[0]?.changes?.[0]?.field === 'messages').map(i => i._id);
            if (messageEventIds.length > 0) {
                await db.collection('webhook_queue').updateMany(
                    { _id: { $in: messageEventIds } },
                    { $set: { status: messageBatchSuccess ? 'COMPLETED' : 'FAILED', error: messageBatchSuccess ? undefined : 'Batch processing failed.' } }
                );
            }

            // Process other events individually
            for (const event of otherEvents) {
                try {
                    await processSingleWebhook(db, event.payload, event.logId);
                    await db.collection('webhook_queue').updateOne({ _id: event._id }, { $set: { status: 'COMPLETED' } });
                    totalSuccess++;
                } catch (e: any) {
                    console.error(`Cron: Failed to process individual event from logId ${event.logId}:`, e);
                    await db.collection('webhook_queue').updateOne({ _id: event._id }, { $set: { status: 'FAILED', error: (e as Error).message } });
                    totalFailed++;
                }
            }
            totalProcessed += batch.length;
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
                await db.collection('locks').updateOne({ _id: LOCK_ID }, { $set: { lockHeldUntil: new Date(0) } });
            } catch (e) {
                console.error("Failed to release webhook processor lock:", e);
            }
        }
    }
}


export async function POST(request: NextRequest) {
    return GET(request as NextRequest);
}
