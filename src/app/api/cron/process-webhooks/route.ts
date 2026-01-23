
import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Db, ObjectId } from 'mongodb';
import type { Project, WithId, WebhookLog } from '@/lib/definitions';
import { 
    processSingleWebhook, 
    handleSingleMessageEvent,
    processStatusUpdateBatch,
    processCommentWebhook,
    processMessengerWebhook
} from '@/lib/webhook-processor';
import { handlePaymentConfigurationUpdate } from '@/app/actions/whatsapp-pay.actions';

const BATCH_SIZE = 500; // Process up to 500 events in one run

export const dynamic = 'force-dynamic';

async function processWebhooks() {
    const { db } = await connectToDatabase();
    
    const pendingWebhooks = await db.collection<WithId<WebhookLog>>('webhook_logs').find({
        processed: false
    }).limit(BATCH_SIZE).toArray();

    if (pendingWebhooks.length === 0) {
        return { message: 'No pending webhooks to process.' };
    }
    
    // Group webhooks by project and then by type
    const groupedByProject: { [projectId: string]: { logs: WithId<WebhookLog>[], statuses: any[], messages: any[], comments: any[], messengerEvents: any[], others: any[], paymentConfigUpdates: any[] } } = {};

    for (const log of pendingWebhooks) {
        const projectId = log.projectId?.toString();
        if (!projectId) {
            await db.collection('webhook_logs').updateOne({ _id: log._id }, { $set: { processed: true, error: 'No project ID associated' } });
            continue;
        }

        if (!groupedByProject[projectId]) {
            groupedByProject[projectId] = { logs: [], statuses: [], messages: [], comments: [], messengerEvents: [], others: [], paymentConfigUpdates: [] };
        }
        
        groupedByProject[projectId].logs.push(log);
        const payload = log.payload;
        const entry = payload.entry?.[0];
        if (!entry) continue;

        if (payload.object === 'whatsapp_business_account' && entry.changes) {
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
                } else if (change.field === 'payment_configuration_update') {
                    groupedByProject[projectId].paymentConfigUpdates.push(value);
                } else {
                    groupedByProject[projectId].others.push(payload);
                }
            }
        } else if (payload.object === 'page') {
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
        if (!project) {
            const logIdsToFail = groups.logs.map(log => log._id);
            await db.collection('webhook_logs').updateMany({ _id: { $in: logIdsToFail } }, { $set: { processed: true, error: 'Project not found.' }});
            return;
        };
        
        const promises = [];
        if (groups.statuses.length > 0) promises.push(processStatusUpdateBatch(db, groups.statuses));
        // Messages are now handled sequentially after this block
        if (groups.comments.length > 0) promises.push(...groups.comments.map(c => processCommentWebhook(db, project, c)));
        if (groups.messengerEvents.length > 0) promises.push(...groups.messengerEvents.map(e => processMessengerWebhook(db, project, e)));
        if (groups.paymentConfigUpdates.length > 0) {
             promises.push(...groups.paymentConfigUpdates.map(update => handlePaymentConfigurationUpdate(project, update)))
        }
        if (groups.others.length > 0) promises.push(...groups.others.map(o => processSingleWebhook(db, project, o)));
        
        // Run all non-conflicting promises in parallel first
        await Promise.allSettled(promises);
        
        // Now, process incoming messages sequentially for this project to avoid race conditions on contact creation
        if (groups.messages.length > 0) {
            for (const msgData of groups.messages) {
                if (msgData.message && msgData.phoneNumberId) {
                   try {
                        await handleSingleMessageEvent(db, project, msgData.message, msgData.contactProfile, msgData.phoneNumberId);
                   } catch (err: any) {
                        console.error(`[WEBHOOK-PROCESSOR] Error processing a message for project ${projectId}:`, err.message);
                   }
                }
            }
        }
    });
    
    await Promise.allSettled(processingPromises);
    
    const processedIds = pendingWebhooks.map(w => w._id);
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
