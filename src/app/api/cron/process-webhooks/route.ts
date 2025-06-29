
'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { processIncomingMessageBatch, processStatusUpdateBatch } from '@/lib/webhook-processor';
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
        
        let totalProcessed = 0;
        let totalSuccess = 0;
        let totalFailed = 0;

        while(true) {
            const batch = await db.collection<WebhookQueueItem>('webhook_queue')
                .find({ status: 'PENDING' })
                .sort({ createdAt: 1 })
                .limit(BATCH_SIZE)
                .toArray();

            if (batch.length === 0) break;
            
            const processingIds = batch.map(w => w._id);
            const logIds = batch.map(w => w.logId).filter(Boolean) as ObjectId[];

            await db.collection('webhook_queue').updateMany(
                { _id: { $in: processingIds } },
                { $set: { status: 'PROCESSING', processedAt: new Date() } }
            );

            // Separate batch into event types
            const statusUpdates: any[] = [];
            const incomingMessages: any[] = [];

            for (const item of batch) {
                const change = item.payload?.entry?.[0]?.changes?.[0];
                const wabaId = item.payload?.entry?.[0]?.id;
                if (!change || !change.value) continue;

                if (change.field === 'messages') {
                    if (change.value.statuses) {
                        statusUpdates.push(...change.value.statuses);
                    }
                    if (change.value.messages) {
                        incomingMessages.push({
                            wabaId: wabaId,
                            messages: change.value.messages,
                            contacts: change.value.contacts,
                            metadata: change.value.metadata,
                        });
                    }
                }
            }
            
            let batchSuccess = 0;
            let batchFailed = 0;

            try {
                // Process batches
                const [statusResult, messageResult] = await Promise.all([
                    processStatusUpdateBatch(db, statusUpdates),
                    processIncomingMessageBatch(db, incomingMessages)
                ]);

                batchSuccess = statusResult.success + messageResult.success;
                batchFailed = statusResult.failed + messageResult.failed;
                
                // Mark successful items as completed
                await db.collection('webhook_queue').updateMany(
                    { _id: { $in: processingIds } },
                    { $set: { status: 'COMPLETED' } }
                );
                if (logIds.length > 0) {
                    await db.collection('webhook_logs').updateMany(
                        { _id: { $in: logIds } },
                        { $set: { processed: true } }
                    );
                }
            } catch (processingError: any) {
                console.error("Error during batch processing:", processingError);
                batchFailed = batch.length;
                await db.collection('webhook_queue').updateMany(
                    { _id: { $in: processingIds } },
                    { $set: { status: 'FAILED', error: processingError.message } }
                );
                 if (logIds.length > 0) {
                    await db.collection('webhook_logs').updateMany(
                        { _id: { $in: logIds } },
                        { $set: { processed: true, error: processingError.message } }
                    );
                }
            }

            totalProcessed += batch.length;
            totalSuccess += batchSuccess;
            totalFailed += batchFailed;
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
