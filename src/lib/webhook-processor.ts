

'use server';

import { revalidatePath } from 'next/cache';
import { Db, ObjectId, WithId } from 'mongodb';

async function processStatuses(db: Db, statuses: any[]) {
    if (!statuses || !Array.isArray(statuses) || statuses.length === 0) {
        return;
    }

    const liveChatOps: any[] = [];
    const broadcastContactOps: any[] = [];
    const broadcastCounterUpdates: Record<string, { delivered: number; read: number; failed: number; success: number }> = {};

    for (const status of statuses) {
        if (!status || !status.id) continue;

        const wamid = status.id;
        const newStatus = (status.status || 'unknown').toUpperCase();
        const timestamp = new Date(parseInt(status.timestamp, 10) * 1000);

        // --- Prepare Live Chat Update ---
        const liveChatUpdatePayload: any = {
            status: status.status,
            [`statusTimestamps.${status.status}`]: timestamp
        };
        if (newStatus === 'FAILED' && status.errors && status.errors.length > 0) {
            const error = status.errors[0];
            liveChatUpdatePayload.error = `${error.title} (Code: ${error.code})${error.details ? `: ${error.details}` : ''}`;
        }
        liveChatOps.push({
            updateOne: {
                filter: { wamid },
                update: { $set: liveChatUpdatePayload }
            }
        });

        // --- Find corresponding broadcast contact ---
        const contact = await db.collection('broadcast_contacts').findOne({ messageId: wamid });
        if (!contact) {
            continue; // Not a broadcast message, skip to next status
        }
        
        const broadcastIdStr = contact.broadcastId.toString();
        if (!broadcastCounterUpdates[broadcastIdStr]) {
            broadcastCounterUpdates[broadcastIdStr] = { delivered: 0, read: 0, failed: 0, success: 0 };
        }

        const statusHierarchy: Record<string, number> = { PENDING: 0, SENT: 1, DELIVERED: 2, READ: 3 };
        const currentStatus = (contact.status || 'PENDING').toUpperCase();

        if (currentStatus === 'FAILED') {
            continue; // Do not update a message that has already terminally failed.
        }

        // --- Prepare Broadcast Contact Update ---
        if (newStatus === 'FAILED') {
            const error = status.errors?.[0] || { title: 'Unknown Failure', code: 'N/A' };
            const errorString = `${error.title} (Code: ${error.code})${error.details ? `: ${error.details}` : ''}`;
            
            broadcastContactOps.push({
                updateOne: {
                    filter: { _id: contact._id },
                    update: { $set: { status: 'FAILED', error: errorString } }
                }
            });
            // A message that failed was previously marked as SENT (successful send *from us*).
            // So we decrement success and increment failed.
            if (currentStatus === 'SENT') {
                broadcastCounterUpdates[broadcastIdStr].success -= 1;
            }
            broadcastCounterUpdates[broadcastIdStr].failed += 1;

        } else if (statusHierarchy[newStatus] !== undefined && statusHierarchy[newStatus] > statusHierarchy[currentStatus]) {
            // Only update if it's a forward progression in status
            broadcastContactOps.push({
                updateOne: {
                    filter: { _id: contact._id },
                    update: { $set: { status: newStatus } }
                }
            });

            if (newStatus === 'DELIVERED') {
                 broadcastCounterUpdates[broadcastIdStr].delivered += 1;
            }
            if (newStatus === 'READ') {
                broadcastCounterUpdates[broadcastIdStr].read += 1;
            }
        }
    }

    // --- Execute DB Updates ---
    const promises = [];

    if (liveChatOps.length > 0) {
        promises.push(db.collection('outgoing_messages').bulkWrite(liveChatOps, { ordered: false }));
    }

    if (broadcastContactOps.length > 0) {
        promises.push(db.collection('broadcast_contacts').bulkWrite(broadcastContactOps, { ordered: false }));
    }

    const broadcastCounterOps = Object.entries(broadcastCounterUpdates)
        .filter(([_, counts]) => counts.delivered > 0 || counts.read > 0 || counts.failed > 0 || counts.success !== 0)
        .map(([broadcastId, counts]) => ({
            updateOne: {
                filter: { _id: new ObjectId(broadcastId) },
                update: { $inc: { 
                    deliveredCount: counts.delivered, 
                    readCount: counts.read,
                    errorCount: counts.failed,
                    successCount: counts.success,
                 } }
            }
        }));

    if (broadcastCounterOps.length > 0) {
        promises.push(db.collection('broadcasts').bulkWrite(broadcastCounterOps, { ordered: false }));
    }

    if (promises.length > 0) {
        await Promise.all(promises);
    }
    
    // Revalidate paths if any relevant operations were performed
    if (liveChatOps.length > 0) revalidatePath('/dashboard/chat');
    if (broadcastContactOps.length > 0) {
        revalidatePath('/dashboard/broadcasts/[broadcastId]', 'page');
        revalidatePath('/dashboard/broadcasts');
    }
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


export async function processSingleWebhook(db: Db, payload: any) {
    if (payload.object !== 'whatsapp_business_account') {
        return;
    }

    for (const entry of payload.entry || []) {
        const wabaId = entry.id;
        for (const change of entry.changes || []) {
            const value = change.value;
            if (!value) continue;

            let project = await db.collection('projects').findOne(
                { $or: [ { wabaId: wabaId }, { 'phoneNumbers.id': value.metadata?.phone_number_id } ] },
                { projection: { _id: 1, name: 1, wabaId: 1, businessCapabilities: 1 } }
            );

            if (!project) {
                const canAutoCreate = [
                    'messages', 'phone_number_quality_update', 'phone_number_name_update',
                    'message_template_quality_update', 'message_template_status_update', 'template_status_update'
                ];
                if (canAutoCreate.includes(change.field)) {
                    project = await findOrCreateProjectByWabaId(db, wabaId);
                }
            }

            switch (change.field) {
                case 'messages': {
                    if (value.statuses && Array.isArray(value.statuses) && value.statuses.length > 0) {
                        await processStatuses(db, value.statuses);
                    } else if (value.messages && Array.isArray(value.messages) && value.messages.length > 0 && project) {
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
                    }
                    break;
                }
                case 'account_update': {
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

    