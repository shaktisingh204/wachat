
import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Db, ObjectId } from 'mongodb';
import type { Project, WithId, WebhookLog } from '@/lib/definitions';
import { 
    processSingleWebhook, 
    processIncomingMessageBatch,
    processStatusUpdateBatch,
    processCommentWebhook,
    processMessengerWebhook
} from '@/lib/webhook-processor';

const BATCH_SIZE = 500; // Process up to 500 events in one run

export const dynamic = 'force-dynamic';

async function processWebhooks() {
    const { db } = await connectToDatabase();
    
    const pendingWebhookIds = await db.collection('webhook_queue').find({
        status: 'PENDING'
    }).project({ _id: 1 }).limit(BATCH_SIZE).toArray();

    if (pendingWebhookIds.length === 0) {
        return { message: 'No pending webhooks to process.' };
    }
    
    const idsToProcess = pendingWebhookIds.map(w => w._id);

    // Atomically mark them as processing to prevent other workers from picking them up
    const updateResult = await db.collection('webhook_queue').updateMany(
        { _id: { $in: idsToProcess }, status: 'PENDING' },
        { $set: { status: 'PROCESSING' } }
    );

    const pendingWebhooks = await db.collection('webhook_queue').find({
        _id: { $in: idsToProcess }
    }).toArray();

    // Group webhooks by project and then by type
    const groupedByProject: { [projectId: string]: { statuses: any[], messages: any[], comments: any[], messengerEvents: any[], others: any[] } } = {};

    for (const webhook of pendingWebhooks) {
        const projectId = webhook.projectId?.toString();
        if (!projectId) {
            // Handle webhooks with no project ID (e.g., log and mark as failed)
             await db.collection('webhook_queue').updateOne({ _id: webhook._id }, { $set: { status: 'FAILED', error: 'No project ID associated' } });
            continue;
        }

        if (!groupedByProject[projectId]) {
            groupedByProject[projectId] = { statuses: [], messages: [], comments: [], messengerEvents: [], others: [] };
        }
        
        const entry = webhook.payload.entry?.[0];
        if (!entry) continue;

        if (webhook.payload.object === 'whatsapp_business_account' && entry.changes) {
            for (const change of entry.changes) {
                const value = change.value;
                if (!value) continue;
                
                if (change.field === 'messages') {
                    if (value.statuses) groupedByProject[projectId].statuses.push(...value.statuses);
                    if (value.messages) {
                        groupedByProject[projectId].messages.push({
                            message: value.messages[0],
                            contactProfile: value.contacts?.[0],
                            phoneNumberId: value.metadata?.phone_number_id,
                        });
                    }
                } else {
                    groupedByProject[projectId].others.push(webhook.payload);
                }
            }
        } else if (webhook.payload.object === 'page') {
             if (entry.messaging) {
                groupedByProject[projectId].messengerEvents.push(...entry.messaging);
            }
            if (entry.changes) {
                for (const change of entry.changes) {
                    if(change.field === 'feed' && change.value.item === 'comment') {
                        groupedByProject[projectId].comments.push(change.value);
                    }
                }
            }
        }
    }
    
    const projectIds = Object.keys(groupedByProject).map(id => new ObjectId(id));
    const projectsArray = await db.collection<Project>('projects').find({ _id: { $in: projectIds } }).toArray();
    const projectsMap = new Map(projectsArray.map(p => [p._id.toString(), p]));

    const processingPromises = Object.entries(groupedByProject).map(async ([projectId, groups]) => {
        const project = projectsMap.get(projectId);
        if (!project) return;
        
        const promises = [];
        if (groups.statuses.length > 0) promises.push(processStatusUpdateBatch(db, groups.statuses));
        if (groups.messages.length > 0) promises.push(processIncomingMessageBatch(db, project, groups.messages));
        if (groups.comments.length > 0) promises.push(...groups.comments.map(c => processCommentWebhook(db, project, c)));
        if (groups.messengerEvents.length > 0) promises.push(...groups.messengerEvents.map(e => processMessengerWebhook(db, project, e)));
        if (groups.others.length > 0) promises.push(...groups.others.map(o => processSingleWebhook(db, project, o)));
        
        await Promise.allSettled(promises);
    });
    
    await Promise.allSettled(processingPromises);
    
    // Mark processed webhooks
    const processedIds = pendingWebhooks.map(w => w._id);
    await db.collection('webhook_queue').updateMany({ _id: { $in: processedIds } }, { $set: { status: 'PROCESSED', processedAt: new Date() } });
    await db.collection('webhook_logs').updateMany({ _id: { $in: processedIds } }, { $set: { processed: true, error: null } });

    return { message: `Successfully processed ${pendingWebhooks.length} webhook event(s).` };
}


export async function GET(request: NextRequest) {
    try {
        const result = await processWebhooks();
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error in webhook processing cron:', error);
        return new NextResponse(`Internal Server Error: ${error.message}`, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    return GET(request as NextRequest);
}
