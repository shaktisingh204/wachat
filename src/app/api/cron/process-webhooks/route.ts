
'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { processWebhooksForProject } from '@/lib/webhook-processor';
import type { Db, ObjectId } from 'mongodb';

/**
 * This is the master cron job for processing webhooks.
 * It identifies projects with pending webhooks and kicks off parallel processing for each one.
 * The worker function (processWebhooksForProject) now handles its own locking, allowing
 * for true parallel processing across multiple projects.
 */
export async function GET(request: NextRequest) {
    try {
        const { db } = await connectToDatabase();
        
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
                    console.error(`[Master Cron] Unhandled error in worker for project ${projectId}:`, e);
                    return { projectId, error: e.message, processed: 0, success: 0, failed: 0 };
                })
        );
        
        const results = await Promise.all(processingPromises);
        
        const totalProcessed = results.reduce((sum, r) => sum + r.processed, 0);
        const totalSuccess = results.reduce((sum, r) => sum + r.success, 0);
        const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);

        return NextResponse.json({
            message: `Processed ${totalProcessed} webhooks across ${results.filter(r => r.processed > 0).length} project(s).`,
            success: totalSuccess,
            failed: totalFailed,
            details: results,
        });

    } catch (error: any) {
        console.error('Error in master webhook processing cron:', error);
        return new NextResponse(`Internal Server Error: ${error.message}`, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    return GET(request as NextRequest);
}
