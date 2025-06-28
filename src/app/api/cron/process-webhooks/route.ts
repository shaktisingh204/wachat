
import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { revalidatePath } from 'next/cache';
import { Db, ObjectId, WithId } from 'mongodb';

// --- Types ---
type WebhookQueueItem = {
    _id: any;
    payload: any;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    createdAt: Date;
    processedAt?: Date;
    error?: string;
};

// --- Database Helpers (copied from original webhook handler) ---

async function processStatuses(db: Db, statuses: any[]) {
    if (!statuses || !Array.isArray(statuses) || statuses.length === 0) {
        return;
    }

    const outgoingMessagesOps: any[] = [];
    const broadcastContactsOps: any[] = [];
    
    // New logic to efficiently update broadcast counters
    const wamids = statuses.map(s => s.id);
    const updateCounters: Record<string, { delivered: number; read: number }> = {};
    const contacts = await db.collection('broadcast_contacts').find({ messageId: { $in: wamids } }, { projection: { broadcastId: 1, messageId: 1 } }).toArray();
    const wamidToBroadcastIdMap = new Map(contacts.map(c => [c.messageId, c.broadcastId.toString()]));


    statuses.forEach((status: any) => {
        const statusUpper = status.status.toUpperCase();
        let errorMsg;
        if (status.status === 'failed' && status.errors && status.errors.length > 0) {
            const error = status.errors[0];
            errorMsg = `${error.title} (Code: ${error.code})${error.details ? `: ${error.details}` : ''}`;
        }

        // Operation for live chat messages
        const outgoingUpdatePayload: any = {
            status: status.status,
            [`statusTimestamps.${status.status}`]: new Date(parseInt(status.timestamp, 10) * 1000)
        };
        if (errorMsg) outgoingUpdatePayload.error = errorMsg;
        
        outgoingMessagesOps.push({
            updateOne: {
                filter: { wamid: status.id },
                update: { $set: outgoingUpdatePayload }
            }
        });
        
        // Operation for broadcast contacts
        const broadcastUpdatePayload: any = {
            status: statusUpper
        };
        if (errorMsg) {
             broadcastUpdatePayload.error = errorMsg;
             // Also ensure the status is FAILED for broadcasts if it's a failure event
             broadcastUpdatePayload.status = 'FAILED';
        }

        broadcastContactsOps.push({
            updateOne: {
                filter: { messageId: status.id },
                update: { $set: broadcastUpdatePayload }
            }
        });

        // New logic to increment counters for broadcasts
        const broadcastId = wamidToBroadcastIdMap.get(status.id);
        if (broadcastId) {
            if (!updateCounters[broadcastId]) {
                updateCounters[broadcastId] = { delivered: 0, read: 0 };
            }
            if (status.status === 'delivered') {
                updateCounters[broadcastId].delivered++;
            } else if (status.status === 'read') {
                updateCounters[broadcastId].read++;
            }
        }
    });
    
    const broadcastUpdateOps = Object.entries(updateCounters).map(([broadcastId, counts]) => {
        return {
            updateOne: {
                filter: { _id: new ObjectId(broadcastId) },
                update: {
                    $inc: {
                        deliveredCount: counts.delivered,
                        readCount: counts.read
                    }
                }
            }
        };
    });

    const promises = [];
    if (outgoingMessagesOps.length > 0) {
        promises.push(
            db.collection('outgoing_messages').bulkWrite(outgoingMessagesOps, { ordered: false })
            .then(() => revalidatePath('/dashboard/chat'))
        );
    }
    if (broadcastContactsOps.length > 0) {
        promises.push(
            db.collection('broadcast_contacts').bulkWrite(broadcastContactsOps, { ordered: false })
            .then(() => revalidatePath('/dashboard/broadcasts/[broadcastId]', 'page'))
        );
    }
    if (broadcastUpdateOps.length > 0) {
        promises.push(
            db.collection('broadcasts').bulkWrite(broadcastUpdateOps, { ordered: false })
        );
    }
    
    await Promise.all(promises);
}


async function findOrCreateProjectByWabaId(db: Db, wabaId: string): Promise<WithId<any> | null> {
    const existingProject = await db.collection('projects').findOne({ wabaId });
    if (existingProject) {
        return existingProject;
    }

    const accessToken = process.env.META_SYSTEM_USER_ACCESS_TOKEN;
    const apiVersion = 'v22.0';
    if (!accessToken) {
        console.error("META_SYSTEM_USER_ACCESS_TOKEN is not set. Cannot create new project automatically for WABA:", wabaId);
        return null;
    }
    try {
        const wabaDetailsResponse = await fetch(`https://graph.facebook.com/${apiVersion}/${wabaId}?access_token=${accessToken}&fields=name`);
        const wabaDetails = await wabaDetailsResponse.json();
        if (wabaDetails.error) {
            throw new Error(`Meta API error getting WABA details: ${wabaDetails.error.message}`);
        }
        const phoneNumbersResponse = await fetch(`https://graph.facebook.com/${apiVersion}/${wabaId}/phone_numbers?access_token=${accessToken}&fields=verified_name,display_phone_number,id,quality_rating,code_verification_status,platform_type,throughput`);
        const phoneNumbersData = await phoneNumbersResponse.json();
        if (phoneNumbersData.error) {
            throw new Error(`Meta API error getting phone numbers: ${phoneNumbersData.error.message}`);
        }
        const phoneNumbers = phoneNumbersData.data ? phoneNumbersData.data.map((num: any) => ({
            id: num.id, display_phone_number: num.display_phone_number, verified_name: num.verified_name,
            code_verification_status: num.code_verification_status, quality_rating: num.quality_rating,
            platform_type: num.platform_type, throughput: num.throughput,
        })) : [];
        const projectDoc = {
            name: wabaDetails.name, wabaId: wabaId, accessToken: accessToken, phoneNumbers: phoneNumbers,
            messagesPerSecond: 1000, reviewStatus: 'UNKNOWN',
        };
        const result = await db.collection('projects').findOneAndUpdate(
            { wabaId: wabaId },
            { $set: { name: projectDoc.name, accessToken: projectDoc.accessToken, phoneNumbers: projectDoc.phoneNumbers, reviewStatus: projectDoc.reviewStatus, },
              $setOnInsert: { createdAt: new Date(), messagesPerSecond: projectDoc.messagesPerSecond, } },
            { upsert: true, returnDocument: 'after' }
        );
        const newProject = result;
        if (newProject) {
            await db.collection('notifications').insertOne({
                projectId: newProject._id, wabaId: wabaId,
                message: `New project '${wabaDetails.name}' was automatically created from a webhook event.`,
                link: '/dashboard', isRead: false, createdAt: new Date(), eventType: 'project_auto_created',
            });
            revalidatePath('/dashboard'); revalidatePath('/dashboard', 'layout');
        }
        return newProject;
    } catch (e: any) {
        console.error(`Failed to automatically create project for WABA ${wabaId}:`, e.message);
        return null;
    }
}

// --- Main Processor Logic ---

async function processSingleWebhook(db: Db, payload: any) {
    if (payload.object !== 'whatsapp_business_account') {
        return;
    }
    for (const entry of payload.entry) {
        const wabaId = entry.id;
        for (const change of entry.changes) {
            const value = change.value;
            if (!value) continue;

            if (value.statuses) {
                await processStatuses(db, value.statuses);
            }

            const isStatusOnlyEvent = change.field === 'messages' && value.statuses;
            if (isStatusOnlyEvent) {
                continue;
            }

            if (change.field === 'account_update') {
                const wabaIdToHandle = value.waba_info?.waba_id;
                if (!wabaIdToHandle) continue;
                if (value.event === 'PARTNER_REMOVED') {
                    const projectToDelete = await db.collection('projects').findOne({ wabaId: wabaIdToHandle });
                    if (projectToDelete) {
                        await db.collection('projects').deleteOne({ _id: projectToDelete._id });
                        await db.collection('notifications').insertOne({
                            projectId: projectToDelete._id, wabaId: wabaIdToHandle,
                            message: `Project '${projectToDelete.name}' was removed.`,
                            link: '/dashboard', isRead: false, createdAt: new Date(), eventType: change.field,
                        });
                        revalidatePath('/dashboard'); revalidatePath('/dashboard', 'layout');
                    }
                } else if (value.event === 'PARTNER_ADDED') {
                    await findOrCreateProjectByWabaId(db, wabaIdToHandle);
                }
                continue;
            }
            let project = await db.collection('projects').findOne(
                { $or: [ { wabaId: wabaId }, { 'phoneNumbers.id': value.metadata?.phone_number_id } ] },
                { projection: { _id: 1, name: 1, wabaId: 1, businessCapabilities: 1 } }
            );
            
            if (!project) {
                const canAutoCreate = ['messages', 'phone_number_quality_update', 'phone_number_name_update'].includes(change.field);
                if (canAutoCreate) {
                    project = await findOrCreateProjectByWabaId(db, wabaId);
                }
            }

            if (!project && !['message_template_quality_update', 'message_template_status_update', 'template_status_update'].includes(change.field)) {
                continue;
            }

            switch (change.field) {
                case 'messages': {
                    if (!project || !value.messages || !value.contacts || !value.metadata) break;
                    const message = value.messages[0];
                    const contactProfile = value.contacts[0];
                    const senderWaId = message.from;
                    const senderName = contactProfile.profile?.name || 'Unknown User';
                    const businessPhoneNumberId = value.metadata.phone_number_id;
                    let lastMessageText = `[${message.type}]`;
                    if (message.type === 'text') {
                        lastMessageText = message.text.body;
                    }
                    const contactUpdateResult = await db.collection('contacts').findOneAndUpdate(
                        { waId: senderWaId, projectId: project._id },
                        { $set: { name: senderName, phoneNumberId: businessPhoneNumberId, lastMessage: lastMessageText, lastMessageTimestamp: new Date(parseInt(message.timestamp, 10) * 1000) },
                          $inc: { unreadCount: 1 },
                          $setOnInsert: { waId: senderWaId, projectId: project._id, createdAt: new Date() } },
                        { upsert: true, returnDocument: 'after' }
                    );
                    const updatedContact = contactUpdateResult;
                    if (updatedContact) {
                        let contentToStore;
                        const messageType = message.type as string;
                        if (message[messageType]) {
                           contentToStore = message[messageType];
                        } else {
                           contentToStore = { unknown: {} };
                        }
                        await db.collection('incoming_messages').insertOne({
                            direction: 'in', projectId: project._id, contactId: updatedContact._id,
                            wamid: message.id, messageTimestamp: new Date(parseInt(message.timestamp, 10) * 1000),
                            type: message.type, content: { [messageType]: contentToStore }, isRead: false, createdAt: new Date(),
                        });
                        await db.collection('notifications').insertOne({
                            projectId: project._id, wabaId: project.wabaId,
                            message: `New message from ${senderName} for project '${project.name}'.`,
                            link: `/dashboard/chat?contactId=${updatedContact._id.toString()}&phoneId=${businessPhoneNumberId}`,
                            isRead: false, createdAt: new Date(), eventType: change.field,
                        });
                        revalidatePath('/dashboard/chat'); revalidatePath('/dashboard/contacts');
                        revalidatePath('/dashboard/notifications'); revalidatePath('/dashboard', 'layout');
                    }
                    break;
                }
                 case 'phone_number_quality_update': {
                    if (!project) break;
                    if (value.display_phone_number && value.event) {
                        const updatePayload: any = {};
                        if (value.current_limit) updatePayload['phoneNumbers.$.throughput.level'] = value.current_limit;
                        let newQuality = 'UNKNOWN';
                        const eventUpper = value.event.toUpperCase();
                        if (eventUpper.includes('FLAGGED')) newQuality = 'RED'; else if (eventUpper.includes('WARNED')) newQuality = 'YELLOW'; else if (eventUpper.includes('GREEN') || eventUpper === 'ONBOARDING') newQuality = 'GREEN';
                        updatePayload['phoneNumbers.$.quality_rating'] = newQuality;
                        await db.collection('projects').updateOne({ _id: project._id, 'phoneNumbers.display_phone_number': value.display_phone_number }, { $set: updatePayload });
                        let notificationMessage = `For project '${project.name}', quality for ${value.display_phone_number} is now ${newQuality}.`;
                        if (value.current_limit) {
                            const oldLimit = value.old_limit?.replace(/_/g, ' ').toLowerCase() || 'N/A';
                            const newLimit = value.current_limit.replace(/_/g, ' ').toLowerCase();
                            notificationMessage += ` Throughput changed from ${oldLimit} to ${newLimit}.`;
                        } else {
                            notificationMessage += ` The event was '${value.event}'.`;
                        }
                        await db.collection('notifications').insertOne({
                            projectId: project._id, wabaId: project.wabaId, message: notificationMessage,
                            link: '/dashboard/numbers', isRead: false, createdAt: new Date(), eventType: change.field,
                        });
                        revalidatePath('/dashboard/numbers'); revalidatePath('/dashboard', 'layout');
                    }
                    break;
                }
                case 'phone_number_name_update': {
                    if (!project || !value.display_phone_number || !value.decision) break;
                    let notificationMessage = '';
                    let shouldNotify = false;
                    if (value.decision === 'APPROVED') {
                        const newVerifiedName = value.new_verified_name || value.requested_verified_name;
                        if (newVerifiedName) {
                            const result = await db.collection('projects').updateOne(
                                { _id: project._id, 'phoneNumbers.display_phone_number': value.display_phone_number },
                                { $set: { 'phoneNumbers.$.verified_name': newVerifiedName } }
                            );
                            shouldNotify = true;
                            notificationMessage = `For project '${project.name}', display name for ${value.display_phone_number} was approved as "${newVerifiedName}".`;
                        }
                    } else {
                        const requestedName = value.requested_verified_name;
                        const decision = value.decision.toLowerCase().replace(/_/g, ' ');
                        notificationMessage = `For project '${project.name}', the name update for ${value.display_phone_number} to "${requestedName}" has been ${decision}.`;
                        if (value.rejection_reason && value.rejection_reason !== 'NONE') {
                            notificationMessage += ` Reason: ${value.rejection_reason}.`;
                        }
                        shouldNotify = true;
                    }
                    if (shouldNotify && notificationMessage) {
                        await db.collection('notifications').insertOne({
                            projectId: project._id, wabaId: project.wabaId, message: notificationMessage,
                            link: '/dashboard/numbers', isRead: false, createdAt: new Date(), eventType: change.field,
                        });
                        revalidatePath('/dashboard/numbers'); revalidatePath('/dashboard', 'layout');
                    }
                    break;
                }
                case 'message_template_status_update':
                case 'template_status_update': {
                    if (!value.event || !value.message_template_id) break;
                    const template = await db.collection('templates').findOne({ metaId: value.message_template_id });
                    if (!template) break;
                    const projectForTemplate = await db.collection('projects').findOne({ _id: template.projectId }, { projection: { _id: 1, name: 1, wabaId: 1 } });
                    if (!projectForTemplate) break;
                    const result = await db.collection('templates').updateOne({ _id: template._id }, { $set: { status: value.event.toUpperCase() } });
                    if (result.modifiedCount > 0) {
                        await db.collection('notifications').insertOne({
                           projectId: projectForTemplate._id, wabaId: projectForTemplate.wabaId, message: `For project '${projectForTemplate.name}', template '${value.message_template_name}' status updated to ${value.event}. Reason: ${value.reason || 'None'}.`,
                           link: '/dashboard/templates', isRead: false, createdAt: new Date(), eventType: change.field,
                       });
                       revalidatePath('/dashboard/templates'); revalidatePath('/dashboard', 'layout');
                    }
                    break;
                }
                case 'message_template_quality_update': {
                    if (!value.message_template_id || !value.new_quality_score) break;
                    const template = await db.collection('templates').findOne({ metaId: value.message_template_id });
                    if (!template) break;
                    const projectForTemplate = await db.collection('projects').findOne({ _id: template.projectId }, { projection: { _id: 1, name: 1, wabaId: 1 } });
                    if (!projectForTemplate) break;
                    const result = await db.collection('templates').updateOne({ _id: template._id }, { $set: { qualityScore: value.new_quality_score.toUpperCase() } });
                    if (result.modifiedCount > 0) {
                        await db.collection('notifications').insertOne({
                            projectId: projectForTemplate._id, wabaId: projectForTemplate.wabaId, message: `For project '${projectForTemplate.name}', quality for template '${value.message_template_name}' is now ${value.new_quality_score}.`,
                            link: '/dashboard/templates', isRead: false, createdAt: new Date(), eventType: change.field,
                        });
                        revalidatePath('/dashboard/templates'); revalidatePath('/dashboard', 'layout');
                    }
                    break;
                }
                default:
                    console.log(`Webhook processor: Unhandled event type: "${change.field}"`);
                    break;
            }
        }
    }
}

// --- Cron Endpoint ---

const BATCH_SIZE = 100; // Number of webhooks to process per run
const LOCK_ID = 'webhook_processor_lock';
const LOCK_DURATION_MS = 2 * 60 * 1000; // Lock for 2 minutes

export async function GET(request: NextRequest) {
    let db: Db;
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
        );

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

        let successCount = 0;
        let failureCount = 0;
        const failedIds = [];

        for (const webhookDoc of webhooksToProcess) {
            try {
                await processSingleWebhook(db, webhookDoc.payload);
                successCount++;
            } catch (e: any) {
                console.error(`Failed to process webhook ${webhookDoc._id}:`, e);
                failureCount++;
                failedIds.push({ id: webhookDoc._id, error: e.message });
            }
        }
        
        // --- Update Processed Webhooks ---
        const bulkWriteOps: any[] = webhooksToProcess.map(doc => ({
            updateOne: {
                filter: { _id: doc._id },
                update: { $set: {
                    status: failedIds.some(f => f.id === doc._id) ? 'FAILED' : 'COMPLETED',
                    processedAt: new Date(),
                    error: failedIds.find(f => f.id === doc._id)?.error
                }}
            }
        }));
        
        if (bulkWriteOps.length > 0) {
            await db.collection('webhook_queue').bulkWrite(bulkWriteOps);
        }

        return NextResponse.json({
            message: `Processed ${webhooksToProcess.length} webhooks.`,
            success: successCount,
            failed: failureCount,
        });

    } catch (error: any) {
        console.error('Error in webhook processing cron:', error);
        return new NextResponse(`Internal Server Error: ${error.message}`, { status: 500 });
    } finally {
        if (lockAcquired) {
            try {
                const conn = await connectToDatabase();
                db = conn.db;
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

    