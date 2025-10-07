

import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Db, ObjectId } from 'mongodb';
import type { Project, WithId } from '@/lib/definitions';
import { 
    processSingleWebhook, 
    handleSingleMessageEvent, 
    processStatusUpdateBatch,
    processCommentWebhook,
    processMessengerWebhook
} from '@/lib/webhook-processor';

const BATCH_SIZE = 100; // Number of webhook events to process in one run

export const dynamic = 'force-dynamic';

async function processBatch(db: Db, batch: WithId<any>[]) {
    const projectIds = [...new Set(batch.map(item => item.projectId).filter(Boolean))];
    const projectsMap = new Map<string, WithId<Project>>();
    
    if (projectIds.length > 0) {
        const projects = await db.collection<Project>('projects').find({ _id: { $in: projectIds } }).toArray();
        projects.forEach(p => projectsMap.set(p._id.toString(), p));
    }
    
    const processingPromises = batch.map(async (item) => {
        const { _id, payload, projectId } = item;
        try {
            if (!projectId || !projectsMap.has(projectId.toString())) {
                throw new Error(`Project not found for webhook item ${_id}.`);
            }
            const project = projectsMap.get(projectId.toString())!;
            
            const entry = payload.entry?.[0];
            if (!entry) throw new Error('Webhook payload missing "entry" object.');

            for (const change of (entry.changes || [])) {
                const field = change.field;
                const value = change.value;

                switch (field) {
                    case 'messages':
                        if (value.statuses) await processStatusUpdateBatch(db, value.statuses);
                        if (value.messages) {
                            for (const message of value.messages) {
                                await handleSingleMessageEvent(db, project, message, value.contacts?.find((c: any) => c.wa_id === message.from) || {}, value.metadata.phone_number_id);
                            }
                        }
                        break;
                    case 'feed':
                        if (value.item === 'comment' && value.verb === 'add') await processCommentWebhook(db, project, value);
                        break;
                    default:
                        await processSingleWebhook(db, project, { object: payload.object, entry: [{...entry, changes: [change] }] });
                        break;
                }
            }
             if (payload.object === 'page' && entry.messaging) {
                for (const messagingEvent of entry.messaging) {
                    await processMessengerWebhook(db, project, messagingEvent);
                }
            }

            await db.collection('webhook_queue').updateOne({ _id }, { $set: { status: 'PROCESSED', processedAt: new Date() } });
            await db.collection('webhook_logs').updateOne({ "payload.entry.0.id": entry.id, "payload.entry.0.time": entry.time }, { $set: { processed: true, error: null } });

        } catch (e: any) {
            console.error(`Failed to process webhook ${_id}:`, e.message);
            await db.collection('webhook_queue').updateOne({ _id }, { $set: { status: 'FAILED', error: e.message } });
            await db.collection('webhook_logs').updateOne({ "payload.entry.0.id": entry.id, "payload.entry.0.time": entry.time }, { $set: { processed: true, error: e.message } });
        }
    });

    await Promise.all(processingPromises);
}

export async function GET(request: NextRequest) {
    try {
        const { db } = await connectToDatabase();
        
        const pendingWebhooks = await db.collection('webhook_queue').find({
            status: 'PENDING'
        }).limit(BATCH_SIZE).toArray();
        
        if (pendingWebhooks.length === 0) {
            return NextResponse.json({ message: 'No pending webhooks to process.' });
        }

        await processBatch(db, pendingWebhooks);
        
        return NextResponse.json({ message: `Successfully processed ${pendingWebhooks.length} webhook event(s).` });

    } catch (error: any) {
        console.error('Error in webhook processing cron:', error);
        return new NextResponse(`Internal Server Error: ${error.message}`, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    return GET(request as NextRequest);
}
