
'use server';

import { revalidatePath } from 'next/cache';
import { Db, ObjectId, WithId } from 'mongodb';
import axios from 'axios';
import { generateAutoReply } from '@/ai/flows/auto-reply-flow';
import type { Project, Contact, OutgoingMessage, AutoReplySettings, Flow, FlowNode } from '@/app/dashboard/page';

async function sendFlowMessage(
    db: Db,
    project: WithId<Project>,
    contact: WithId<Contact>,
    phoneNumberId: string,
    messageText: string
) {
     try {
        const messagePayload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: contact.waId,
            type: 'text',
            text: { preview_url: false, body: messageText },
        };

        const response = await axios.post(
            `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
            messagePayload,
            { headers: { 'Authorization': `Bearer ${project.accessToken}` } }
        );

        const wamid = response.data?.messages?.[0]?.id;
        if (!wamid) {
            throw new Error('Message sent but no WAMID was returned from Meta.');
        }

        const now = new Date();
        const outgoingMessageDoc: Omit<OutgoingMessage, '_id'> = {
            direction: 'out',
            contactId: contact._id,
            projectId: project._id,
            wamid,
            messageTimestamp: now,
            type: 'text',
            content: messagePayload,
            status: 'sent',
            statusTimestamps: { sent: now },
            createdAt: now,
        };
        await db.collection('outgoing_messages').insertOne(outgoingMessageDoc);

        await db.collection('contacts').updateOne(
            { _id: contact._id },
            { $set: { lastMessage: `[Flow]: ${messageText.substring(0, 50)}`, lastMessageTimestamp: now } }
        );
        revalidatePath('/dashboard/chat');
    } catch (e: any) {
        console.error(`Failed to send flow message to ${contact.waId} for project ${project._id}:`, e.message);
    }
}

async function sendFlowImage(
    db: Db,
    project: WithId<Project>,
    contact: WithId<Contact>,
    phoneNumberId: string,
    imageUrl: string,
    caption?: string
) {
    if (!imageUrl) {
        console.error(`Flow execution skipped: Image URL is missing for project ${project._id}`);
        return;
    }

    try {
        const messagePayload: any = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: contact.waId,
            type: 'image',
            image: {
                link: imageUrl,
            },
        };

        if (caption) {
            messagePayload.image.caption = caption;
        }

        const response = await axios.post(
            `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
            messagePayload,
            { headers: { 'Authorization': `Bearer ${project.accessToken}` } }
        );

        const wamid = response.data?.messages?.[0]?.id;
        if (!wamid) {
            throw new Error('Message sent but no WAMID was returned from Meta.');
        }

        const now = new Date();
        const outgoingMessageDoc: Omit<OutgoingMessage, '_id'> = {
            direction: 'out',
            contactId: contact._id,
            projectId: project._id,
            wamid,
            messageTimestamp: now,
            type: 'image',
            content: messagePayload,
            status: 'sent',
            statusTimestamps: { sent: now },
            createdAt: now,
        };
        await db.collection('outgoing_messages').insertOne(outgoingMessageDoc);

        await db.collection('contacts').updateOne(
            { _id: contact._id },
            { $set: { lastMessage: caption || '[Flow]: Sent an image', lastMessageTimestamp: now } }
        );
        revalidatePath('/dashboard/chat');
    } catch (e: any) {
        console.error(`Failed to send flow image to ${contact.waId} for project ${project._id}:`, e.message);
    }
}


async function findAndExecuteFlow(db: Db, project: WithId<Project>, contact: WithId<Contact>, message: any, phoneNumberId: string): Promise<boolean> {
    const messageText = message.text?.body?.toLowerCase().trim();
    if (!messageText) return false;

    try {
        const flows = await db.collection<Flow>('flows').find({
            projectId: project._id,
            triggerKeywords: { $exists: true, $ne: [] }
        }).toArray();

        const triggeredFlow = flows.find(flow =>
            flow.triggerKeywords.some(keyword => messageText.includes(keyword.toLowerCase().trim()))
        );

        if (!triggeredFlow) {
            return false; // No flow triggered
        }

        console.log(`Triggering flow '${triggeredFlow.name}' for contact ${contact.waId}`);

        let currentNodeId: string | null | undefined = triggeredFlow.nodes.find(n => n.type === 'start')?.id;

        // This loop executes the flow sequentially. It does not yet support branching or user input pauses.
        while (currentNodeId) {
            // Find the next node in the sequence. Assumes a simple 'output-main' handle for linear flows.
            const currentEdge = triggeredFlow.edges.find(e => e.source === currentNodeId);
            const nextNode = currentEdge ? triggeredFlow.nodes.find(n => n.id === currentEdge.target) : null;

            if (!nextNode) {
                console.log('End of flow path reached.');
                break; // Exit loop if no next node
            }

            console.log(`Executing node: ${nextNode.id} (type: ${nextNode.type})`);
            switch (nextNode.type) {
                case 'text':
                    if (nextNode.data.text) {
                        await sendFlowMessage(db, project, contact, phoneNumberId, nextNode.data.text);
                    }
                    break;
                case 'image':
                    if (nextNode.data.imageUrl) {
                        await sendFlowImage(db, project, contact, phoneNumberId, nextNode.data.imageUrl, nextNode.data.caption);
                    }
                    break;
                case 'delay':
                    if (nextNode.data.delaySeconds > 0) {
                        await new Promise(resolve => setTimeout(resolve, nextNode.data.delaySeconds * 1000));
                    }
                    break;
                case 'buttons':
                case 'condition':
                case 'input':
                case 'webhook':
                case 'api':
                case 'carousel':
                case 'addToCart':
                    console.log(`Flow node type '${nextNode.type}' is not yet implemented for backend execution. Skipping.`);
                    break;
                default:
                    console.log(`Unknown flow node type: ${nextNode.type}`);
                    break;
            }

            // Move to the next node for the next iteration.
            currentNodeId = nextNode.id;
        }

        console.log(`Flow '${triggeredFlow.name}' execution finished for contact ${contact.waId}.`);
        return true; // A flow was triggered and completed.
    } catch (error: any) {
        console.error(`Error during flow execution for contact ${contact.waId}: ${error.message}`, error.stack);
        return true; // Still return true because a flow was attempted, to prevent auto-reply from firing.
    }
}


async function sendAutoReplyMessage(
    db: Db,
    project: WithId<Project>,
    contact: WithId<Contact>,
    phoneNumberId: string,
    messageText: string
) {
    try {
        const messagePayload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: contact.waId,
            type: 'text',
            text: { preview_url: false, body: messageText },
        };

        const response = await axios.post(
            `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
            messagePayload,
            { headers: { 'Authorization': `Bearer ${project.accessToken}` } }
        );

        const wamid = response.data?.messages?.[0]?.id;
        if (!wamid) {
            throw new Error('Message sent but no WAMID was returned from Meta.');
        }

        const now = new Date();
        const outgoingMessageDoc: Omit<OutgoingMessage, '_id'> = {
            direction: 'out',
            contactId: contact._id,
            projectId: project._id,
            wamid,
            messageTimestamp: now,
            type: 'text',
            content: messagePayload,
            status: 'sent',
            statusTimestamps: { sent: now },
            createdAt: now,
        };
        await db.collection('outgoing_messages').insertOne(outgoingMessageDoc);

        // Update last message on contact, but don't increment unread count for auto-replies
        await db.collection('contacts').updateOne(
            { _id: contact._id },
            { $set: { lastMessage: `[Auto]: ${messageText.substring(0, 50)}`, lastMessageTimestamp: now } }
        );
        revalidatePath('/dashboard/chat');
    } catch (e: any) {
        console.error(`Failed to send auto-reply to ${contact.waId} for project ${project._id}:`, e.message);
    }
}


async function triggerAutoReply(db: Db, project: WithId<Project>, contact: WithId<Contact>, message: any, phoneNumberId: string) {
    const settings = project.autoReplySettings;
    if (!settings || settings.masterEnabled === false) return;

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentOutgoingMessage = await db.collection('outgoing_messages').findOne({
        contactId: contact._id,
        createdAt: { $gte: fiveMinutesAgo },
    });

    if (recentOutgoingMessage) {
        console.log(`Auto-reply skipped for contact ${contact.waId} due to recent outgoing message.`);
        return;
    }

    let replyMessage: string | null = null;
    
    // 1. Check Inactive Hours
    if (settings.inactiveHours?.enabled && settings.inactiveHours.message) {
        const { startTime, endTime, timezone, days, message } = settings.inactiveHours;
        try {
            const now = new Date();
            const nowInTZ = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
            
            const currentDay = nowInTZ.getDay(); // 0 = Sunday
            const currentTime = nowInTZ.getHours() * 60 + nowInTZ.getMinutes();
            
            const [startHour, startMinute] = startTime.split(':').map(Number);
            const startTimeInMinutes = startHour * 60 + startMinute;

            const [endHour, endMinute] = endTime.split(':').map(Number);
            const endTimeInMinutes = endHour * 60 + endMinute;

            const isDayMatch = days.includes(currentDay);
            let isTimeMatch = false;

            // Handle overnight case (e.g., 18:00 - 09:00)
            if (startTimeInMinutes > endTimeInMinutes) {
                if (currentTime >= startTimeInMinutes || currentTime < endTimeInMinutes) {
                    isTimeMatch = true;
                }
            } else { // Handle same-day case (e.g., 09:00 - 18:00)
                if (currentTime >= startTimeInMinutes && currentTime < endTimeInMinutes) {
                    isTimeMatch = true;
                }
            }

            if (isDayMatch && isTimeMatch) {
                replyMessage = message;
            }
        } catch (e) {
            console.error("Error processing inactive hours:", e);
        }
    }

    // 2. Check AI Assistant (if no inactive reply was triggered)
    if (!replyMessage && settings.aiAssistant?.enabled && settings.aiAssistant.context && message.type === 'text') {
        try {
            const result = await generateAutoReply({
                incomingMessage: message.text.body,
                businessContext: settings.aiAssistant.context,
                userWaId: contact.waId,
            });
            replyMessage = result.replyMessage;
        } catch (e: any) {
            console.error("Error generating AI reply:", e.message);
        }
    }
    
    // 3. Check General Reply (if no other reply was triggered)
    if (!replyMessage && settings.general?.enabled && settings.general.message) {
        replyMessage = settings.general.message;
    }

    // 4. Send the determined reply
    if (replyMessage) {
        await sendAutoReplyMessage(db, project, contact, phoneNumberId, replyMessage);
    }
}


export async function processStatuses(db: Db, statuses: any[]) {
    if (!statuses || !Array.isArray(statuses) || statuses.length === 0) {
        return;
    }

    const wamids = statuses.map(s => s.id).filter(Boolean);
    if (wamids.length === 0) {
        return;
    }

    const contactsMap = new Map<string, WithId<any>>();
    const contactsCursor = db.collection('broadcast_contacts').find({ messageId: { $in: wamids } });
    for await (const contact of contactsCursor) {
        contactsMap.set(contact.messageId, contact);
    }

    const liveChatOps: any[] = [];
    const broadcastContactOps: any[] = [];
    const broadcastCounterUpdates: Record<string, { delivered: number; read: number; failed: number; success: number }> = {};

    for (const status of statuses) {
        if (!status || !status.id) continue;

        const wamid = status.id;
        const newStatus = (status.status || 'unknown').toUpperCase();
        const timestamp = new Date(parseInt(status.timestamp, 10) * 1000);
        
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

        const contact = contactsMap.get(wamid);
        if (!contact) {
            continue; 
        }
        
        const broadcastIdStr = contact.broadcastId.toString();
        if (!broadcastCounterUpdates[broadcastIdStr]) {
            broadcastCounterUpdates[broadcastIdStr] = { delivered: 0, read: 0, failed: 0, success: 0 };
        }

        const currentStatus = (contact.status || 'PENDING').toUpperCase();

        if (currentStatus === 'FAILED') {
            continue; 
        }

        if (newStatus === 'FAILED') {
            const error = status.errors?.[0] || { title: 'Unknown Failure', code: 'N/A' };
            const errorString = `${error.title} (Code: ${error.code})${error.details ? `: ${error.details}` : ''}`;
            
            broadcastContactOps.push({
                updateOne: {
                    filter: { _id: contact._id },
                    update: { $set: { status: 'FAILED', error: errorString } }
                }
            });
            broadcastCounterUpdates[broadcastIdStr].success -= 1;
            broadcastCounterUpdates[broadcastIdStr].failed += 1;

        } else {
            const statusHierarchy: Record<string, number> = { PENDING: 0, SENT: 1, DELIVERED: 2, READ: 3 };
            if (statusHierarchy[newStatus] !== undefined && statusHierarchy[newStatus] > statusHierarchy[currentStatus]) {
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
    }

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

            const phone_number_id = value.metadata?.phone_number_id;

            let project = await db.collection<Project>('projects').findOne(
                 { $or: [ { wabaId: wabaId }, ...(phone_number_id ? [{ 'phoneNumbers.id': phone_number_id }] : [])] }
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

                        console.log(`Processing incoming message from ${senderWaId} for project '${project.name}'.`);

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
                                message: `New message from ${senderName}.`,
                                link: `/dashboard/chat?contactId=${updatedContact._id.toString()}&phoneId=${businessPhoneNumberId}`,
                                isRead: false, createdAt: new Date(), eventType: change.field,
                            });
                            revalidatePath('/dashboard/chat'); revalidatePath('/dashboard/contacts');
                            revalidatePath('/dashboard/notifications'); revalidatePath('/dashboard', 'layout');
                            
                            const flowWasTriggered = await findAndExecuteFlow(db, project, updatedContact, message, businessPhoneNumberId);

                            if (!flowWasTriggered) {
                                await triggerAutoReply(db, project, updatedContact, message, businessPhoneNumberId);
                            }
                        }
                    }
                    break;
                }
                case 'account_update': {
                    const wabaIdToHandle = value.waba_info?.waba_id;
                    if (!wabaIdToHandle) continue;

                    console.log(`Processing account update event: ${value.event} for WABA ${wabaIdToHandle}`);

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
                        
                        console.log(`Processing phone quality update for ${value.display_phone_number}. New quality: ${newQuality}`);

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

                    console.log(`Processing phone name update for ${value.display_phone_number}. Decision: ${value.decision}`);
                    
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

                    console.log(`Processing template status update for '${value.message_template_name}'. New status: ${value.event.toUpperCase()}`);

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

                    console.log(`Processing template quality update for '${value.message_template_name}'. New score: ${value.new_quality_score.toUpperCase()}`);

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
