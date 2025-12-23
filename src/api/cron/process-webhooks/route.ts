
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
const LOG_PREFIX = '[CRON:PROCESS_WEBHOOKS]';

export const dynamic = 'force-dynamic';

async function processWebhooks() {
    const { db } = await connectToDatabase();
    console.log(`${LOG_PREFIX} Starting webhook processing cron.`);
    
    const pendingWebhooks = await db.collection('webhook_logs').find({
        processed: { $ne: true }
    }).limit(BATCH_SIZE).toArray();

    if (pendingWebhooks.length === 0) {
        console.log(`${LOG_PREFIX} No pending webhooks to process.`);
        return { message: 'No pending webhooks to process.' };
    }
    
    console.log(`${LOG_PREFIX} Found ${pendingWebhooks.length} pending webhook(s).`);

    // Group webhooks by project and then by type
    const groupedByProject: { [projectId: string]: { webhooks: WithId<any>[], statuses: any[], messages: any[], comments: any[], messengerEvents: any[], others: any[] } } = {};

    for (const webhook of pendingWebhooks) {
        const projectId = webhook.projectId?.toString();
        if (!projectId) {
             await db.collection('webhook_logs').updateOne({ _id: webhook._id }, { $set: { processed: true, error: 'No project ID associated' } });
            continue;
        }

        if (!groupedByProject[projectId]) {
            groupedByProject[projectId] = { webhooks: [], statuses: [], messages: [], comments: [], messengerEvents: [], others: [] };
        }
        
        groupedByProject[projectId].webhooks.push(webhook);
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

    for (const [projectId, groups] of Object.entries(groupedByProject)) {
        const project = projectsMap.get(projectId);
        if (!project) {
             await db.collection('webhook_logs').updateMany({ _id: { $in: groups.webhooks.map(w => w._id) } }, { $set: { processed: true, error: 'Project not found during processing' }});
            continue;
        }
        
        const promises = [];
        if (groups.statuses.length > 0) promises.push(processStatusUpdateBatch(db, groups.statuses));
        if (groups.messages.length > 0) promises.push(processIncomingMessageBatch(db, project, groups.messages));
        if (groups.comments.length > 0) promises.push(...groups.comments.map(c => processCommentWebhook(db, project, c)));
        if (groups.messengerEvents.length > 0) promises.push(...groups.messengerEvents.map(e => processMessengerWebhook(db, project, e)));
        if (groups.others.length > 0) promises.push(...groups.others.map(o => processSingleWebhook(db, project, o)));
        
        await Promise.allSettled(promises);
        
        // Mark processed webhooks for this project
        await db.collection('webhook_logs').updateMany({ _id: { $in: groups.webhooks.map(w => w._id) } }, { $set: { processed: true } });
    }

    console.log(`${LOG_PREFIX} Successfully processed ${pendingWebhooks.length} webhook event(s).`);
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
    return GET(request);
}
