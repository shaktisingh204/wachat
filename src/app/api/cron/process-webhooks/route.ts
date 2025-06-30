
'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { processWebhooksForProject } from '@/lib/webhook-processor';
import type { Db, ObjectId } from 'mongodb';

const LOCK_ID = 'webhook_processor_lock';
const LOCK_DURATION_MS = 5 * 60 * 1000; // 5 minute lock

/**
 * This is the master cron job for processing webhooks.
 * It identifies projects with pending webhooks and kicks off parallel processing for each one.
 */
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
            if (e.code === 11000) return null; // Lost race condition
            throw e;
        });

        if (!lockResult) {
            return NextResponse.json({ message: "Webhook processor is already running." }, { status: 200 });
        }
        lockAcquired = true;
        
        // Find all distinct project IDs that have pending items in the queue
        const projectIds = await db.collection('webhook_queue').distinct('projectId', {
            status: 'PENDING',
            projectId: { $ne: null }
        });

        if (projectIds.length === 0) {
            return NextResponse.json({ message: 'No pending webhooks to process across any project.' });
        }
        
        console.log(`[Master Cron] Found ${projectIds.length} projects with pending webhooks. Starting parallel processing.`);

        // Start a worker task for each project in parallel
        const processingPromises = projectIds.map(projectId => 
            processWebhooksForProject(db, projectId as ObjectId)
                .catch(e => {
                    console.error(`[Master Cron] Unhandled error processing project ${projectId}:`, e);
                    return { projectId, error: e.message, processed: 0, success: 0, failed: 0 };
                })
        );
        
        const results = await Promise.all(processingPromises);
        
        const totalProcessed = results.reduce((sum, r) => sum + r.processed, 0);
        const totalSuccess = results.reduce((sum, r) => sum + r.success, 0);
        const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);

        return NextResponse.json({
            message: `Processed ${totalProcessed} webhooks across ${projectIds.length} project(s).`,
            success: totalSuccess,
            failed: totalFailed,
            details: results,
        });

    } catch (error: any) {
        console.error('Error in master webhook processing cron:', error);
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
