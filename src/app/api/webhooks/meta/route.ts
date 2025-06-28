
import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { revalidatePath } from 'next/cache';
import type { Db, WithId } from 'mongodb';

const getSearchableText = (payload: any): string => {
    let text = '';
    try {
        if (payload.object === 'whatsapp_business_account' && payload.entry) {
            for (const entry of payload.entry) {
                text += ` ${entry.id}`; // WABA ID or 0
                if (entry.changes) {
                    for (const change of entry.changes) {
                        const field = change.field;
                        text += ` ${field}`; // The type of change, e.g., 'messages', 'account_review_update'
                        const value = change.value;
                        if (!value) continue;

                        // Common fields
                        text += ` ${value.messaging_product || ''}`;
                        text += ` ${value.event || ''}`;

                        // Message-related
                        if (value.messages) {
                            for (const message of value.messages) {
                                text += ` ${message.from || ''} ${message.id || ''} ${message.type || ''}`;
                                if (message.text?.body) {
                                    text += ` ${message.text.body}`;
                                }
                            }
                        }
                        if (value.statuses) {
                            for (const status of value.statuses) {
                                text += ` ${status.id || ''} ${status.recipient_id || ''} ${status.status || ''}`;
                            }
                        }
                        if (value.message_echoes) {
                            for (const echo of value.message_echoes) {
                                text += ` ${echo.from || ''} ${echo.to || ''} ${echo.id || ''} ${echo.type || ''}`;
                            }
                        }

                        // Phone Number related
                        text += ` ${value.display_phone_number || ''}`;
                        text += ` ${value.decision || ''}`;
                        text += ` ${value.requested_verified_name || ''}`;
                        text += ` ${value.new_verified_name || ''}`;
                        text += ` ${value.new_code_verification_status || ''}`;
                        text += ` ${value.current_limit || ''}`;

                        // Template related
                        text += ` ${value.message_template_id || ''}`;
                        text += ` ${value.message_template_name || ''}`;
                        text += ` ${value.message_template_language || ''}`;
                        text += ` ${value.previous_category || ''}`;
                        text += ` ${value.new_category || ''}`;
                        text += ` ${value.new_quality_score || ''}`;
                        
                        // Account related
                        text += ` ${value.update_type || ''}`;
                        if (value.event && field === 'account_update') text += ` ${value.event}`;
                        if (value.waba_info?.waba_id) text += ` ${value.waba_info.waba_id}`;
                        text += ` ${value.new_review_status || ''}`;
                        if (value.ban_info) text += ` ${value.ban_info.waba_ban_state}`;
                        if (value.alert_type) text += ` ${value.alert_type} ${value.alert_status}`;
                        if (value.entity_id) text += ` ${value.entity_id}`;
                        if (value.max_daily_conversation_per_phone) text += ` ${value.max_daily_conversation_per_phone}`;
                        if (value.max_phone_numbers_per_business) text += ` ${value.max_phone_numbers_per_business}`;
                        
                        // Other events
                        if (value.configuration_name) text += ` ${value.configuration_name} ${value.provider_name} ${value.status}`;
                        if (value.user_preferences) {
                            for (const pref of value.user_preferences) {
                                text += ` ${pref.wa_id} ${pref.category} ${pref.value}`;
                            }
                        }
                        if (value.events && field === 'tracking_events') { // Differentiate from other 'events'
                             for (const ev of value.events) {
                                text += ` ${ev.event_name} ${ev.tracking_data?.click_id}`;
                            }
                        }
                        if (field === 'security') text += ` ${value.requester}`;
                        if (value.solution_id) text += ` ${value.solution_id} ${value.solution_status}`;
                    }
                }
            }
        }
    } catch(e) { /* ignore errors during text creation */ }
    return text.replace(/\s+/g, ' ').trim();
};

async function processStatuses(db: Db, statuses: any[]) {
    if (!statuses || !Array.isArray(statuses) || statuses.length === 0) {
        return;
    }

    const bulkOps = statuses.map((status: any) => {
        const updatePayload: any = {
            status: status.status,
            [`statusTimestamps.${status.status}`]: new Date(parseInt(status.timestamp, 10) * 1000)
        };
        
        if (status.status === 'failed' && status.errors && status.errors.length > 0) {
            const error = status.errors[0];
            updatePayload.error = `${error.title} (Code: ${error.code})${error.details ? `: ${error.details}` : ''}`;
        }

        return {
            updateOne: {
                filter: { wamid: status.id },
                update: { $set: updatePayload }
            }
        };
    });

    if (bulkOps.length > 0) {
        await db.collection('outgoing_messages').bulkWrite(bulkOps, { ordered: false });
        revalidatePath('/dashboard/chat');
    }
}

async function findOrCreateProjectByWabaId(db: Db, wabaId: string): Promise<WithId<any> | null> {
    const existingProject = await db.collection('projects').findOne({ wabaId });
    if (existingProject) {
        return existingProject;
    }

    // Project not found, try to create it
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
            id: num.id,
            display_phone_number: num.display_phone_number,
            verified_name: num.verified_name,
            code_verification_status: num.code_verification_status,
            quality_rating: num.quality_rating,
            platform_type: num.platform_type,
            throughput: num.throughput,
        })) : [];

        const projectDoc = {
            name: wabaDetails.name,
            wabaId: wabaId,
            accessToken: accessToken,
            phoneNumbers: phoneNumbers,
            messagesPerSecond: 1000,
            reviewStatus: 'UNKNOWN',
        };
        
        const result = await db.collection('projects').findOneAndUpdate(
            { wabaId: wabaId },
            { 
                $set: {
                    name: projectDoc.name,
                    accessToken: projectDoc.accessToken,
                    phoneNumbers: projectDoc.phoneNumbers,
                    reviewStatus: projectDoc.reviewStatus,
                },
                $setOnInsert: {
                     createdAt: new Date(),
                     messagesPerSecond: projectDoc.messagesPerSecond,
                }
            },
            { upsert: true, returnDocument: 'after' }
        );

        const newProject = result;

        if (newProject) {
            await db.collection('notifications').insertOne({
                projectId: newProject._id,
                wabaId: wabaId,
                message: `New project '${wabaDetails.name}' was automatically created from a webhook event.`,
                link: '/dashboard',
                isRead: false,
                createdAt: new Date(),
                eventType: 'project_auto_created',
            });
            revalidatePath('/dashboard');
            revalidatePath('/dashboard', 'layout');
        }

        return newProject;

    } catch (e: any) {
        console.error(`Failed to automatically create project for WABA ${wabaId}:`, e.message);
        return null;
    }
}


/**
 * Handles webhook verification requests from Meta.
 * https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  // Check the mode and token
  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    // Respond with the challenge token
    console.log("Webhook verified successfully!");
    return new NextResponse(challenge, { status: 200 });
  } else {
    // Respond with '403 Forbidden' if tokens do not match
    console.error("Webhook verification failed. Tokens do not match.");
    return new NextResponse('Forbidden', { status: 403 });
  }
}

/**
 * Handles incoming webhook event notifications from Meta.
 * https://developers.facebook.com/docs/graph-api/webhooks/getting-started#event-notifications
 */
export async function POST(request: NextRequest) {
  const body = await request.json();

  // Process the webhook in the background without blocking the response.
  (async () => {
    try {
      const { db } = await connectToDatabase();

      // Store the raw webhook log
      const searchableText = getSearchableText(body);
      await db.collection('webhook_logs').insertOne({
        payload: body,
        searchableText,
        createdAt: new Date(),
      });
      revalidatePath('/dashboard/webhooks');

      if (body.object === 'whatsapp_business_account') {
        for (const entry of body.entry) {
          const wabaId = entry.id; 
          
          for (const change of entry.changes) {
            const value = change.value;
            if (!value) continue;

            // A change can contain status updates. Process these first as they don't need project lookup.
            if (value.statuses) {
                await processStatuses(db, value.statuses);
            }

            if (change.field === 'message_status' || (change.field === 'messages' && !value.messages)) {
                continue;
            }

            // Handle special cases that don't rely on a pre-existing project matching the entry.id
            if (change.field === 'account_update') {
                if (value.event === 'PARTNER_REMOVED' && value.waba_info?.waba_id) {
                    const wabaIdToRemove = value.waba_info.waba_id;
                    const projectToDelete = await db.collection('projects').findOne({ wabaId: wabaIdToRemove });

                    if (projectToDelete) {
                        await db.collection('projects').deleteOne({ _id: projectToDelete._id });
                        await db.collection('notifications').insertOne({
                            projectId: projectToDelete._id, wabaId: wabaIdToRemove,
                            message: `Project '${projectToDelete.name}' was removed as it is no longer managed by this business partner.`,
                            link: '/dashboard', isRead: false, createdAt: new Date(), eventType: change.field,
                        });
                        revalidatePath('/dashboard');
                        revalidatePath('/dashboard', 'layout');
                    }
                    continue; 
                } else if (value.event === 'PARTNER_ADDED' && value.waba_info?.waba_id) {
                    await findOrCreateProjectByWabaId(db, value.waba_info.waba_id);
                    continue; 
                }
            }
            
            const project = await db.collection('projects').findOne(
                { $or: [ { wabaId: wabaId }, { 'phoneNumbers.id': value.metadata?.phone_number_id }, { 'phoneNumbers.display_phone_number': value.display_phone_number }, { 'phoneNumbers.display_phone_number': value.phone_number }, { 'phoneNumbers.display_phone_number': value.metadata?.display_phone_number } ] }, 
                { projection: { _id: 1, name: 1, wabaId: 1, businessCapabilities: 1 } }
            );

            if (!project && !['message_template_quality_update', 'phone_number_name_update'].includes(change.field)) {
                continue;
            }
            
            switch (change.field) {
                case 'messages': {
                    if (!value.messages || !value.contacts || !value.metadata) {
                        break;
                    }

                    const projectForMessage = await db.collection('projects').findOne(
                        { 'phoneNumbers.id': value.metadata.phone_number_id },
                        { projection: { _id: 1, name: 1, wabaId: 1 } }
                    );

                    if (!projectForMessage) {
                        break;
                    }
                    
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
                        { waId: senderWaId, projectId: projectForMessage._id },
                        {
                            $set: {
                                name: senderName,
                                phoneNumberId: businessPhoneNumberId,
                                lastMessage: lastMessageText,
                                lastMessageTimestamp: new Date(parseInt(message.timestamp, 10) * 1000),
                            },
                            $inc: { unreadCount: 1 },
                            $setOnInsert: {
                                waId: senderWaId,
                                projectId: projectForMessage._id,
                                createdAt: new Date(),
                            }
                        },
                        { upsert: true, returnDocument: 'after' }
                    );
                    
                    const updatedContact = contactUpdateResult;

                    if (updatedContact) {
                         let contentToStore;
                         const messageType = message.type as string;
                         if (message[messageType]) {
                            contentToStore = { [messageType]: message[messageType] };
                         } else {
                            contentToStore = { unknown: {} };
                         }

                        await db.collection('incoming_messages').insertOne({
                            direction: 'in',
                            projectId: projectForMessage._id,
                            contactId: updatedContact._id,
                            wamid: message.id,
                            messageTimestamp: new Date(parseInt(message.timestamp, 10) * 1000),
                            type: message.type,
                            content: contentToStore,
                            isRead: false,
                            createdAt: new Date(),
                        });

                        await db.collection('notifications').insertOne({
                            projectId: projectForMessage._id,
                            wabaId: projectForMessage.wabaId,
                            message: `New message from ${senderName} for project '${projectForMessage.name}'.`,
                            link: `/dashboard/chat?contactId=${updatedContact._id.toString()}&phoneId=${businessPhoneNumberId}`,
                            isRead: false,
                            createdAt: new Date(),
                            eventType: change.field,
                        });

                        revalidatePath('/dashboard/chat');
                        revalidatePath('/dashboard/contacts');
                        revalidatePath('/dashboard/notifications');
                        revalidatePath('/dashboard', 'layout');
                    }
                    break;
                }
                
                case 'phone_number_quality_update':
                    if (!project) break;
                    if (value.display_phone_number && value.event) {
                        const updatePayload: any = {};
                        if (value.current_limit) updatePayload['phoneNumbers.$.throughput.level'] = value.current_limit;
                        const newQuality = value.event === 'FLAGGED' ? 'RED' : value.event === 'WARNED' ? 'YELLOW' : 'GREEN';
                        updatePayload['phoneNumbers.$.quality_rating'] = newQuality;
                        const notificationMessage = `For project '${project.name}', quality for ${value.display_phone_number} is now ${newQuality}. Throughput limit is ${value.current_limit || 'unchanged'}.`;
                        
                        const result = await db.collection('projects').updateOne({ _id: project._id, 'phoneNumbers.display_phone_number': value.display_phone_number }, { $set: updatePayload });
                        if (result.modifiedCount > 0) {
                            await db.collection('notifications').insertOne({
                                projectId: project._id, wabaId: project.wabaId, message: notificationMessage,
                                link: '/dashboard/numbers', isRead: false, createdAt: new Date(), eventType: change.field,
                            });
                            revalidatePath('/dashboard/numbers'); revalidatePath('/dashboard', 'layout');
                        }
                    }
                    break;
                
                case 'phone_number_name_update': {
                    let projectForUpdate = project;
                    if (!projectForUpdate) {
                        projectForUpdate = await findOrCreateProjectByWabaId(db, wabaId);
                    }
                    if (!projectForUpdate) break;

                    if (!value.display_phone_number || !value.decision) break;

                    let notificationMessage = '';
                    let shouldNotify = false;

                    if (value.decision === 'APPROVED') {
                        const newVerifiedName = value.new_verified_name || value.requested_verified_name;
                        if (newVerifiedName) {
                            const result = await db.collection('projects').updateOne(
                                { _id: projectForUpdate._id, 'phoneNumbers.display_phone_number': value.display_phone_number },
                                { $set: { 'phoneNumbers.$.verified_name': newVerifiedName } }
                            );
                            if (result.modifiedCount > 0) {
                                shouldNotify = true;
                                notificationMessage = `For project '${projectForUpdate.name}', display name for ${value.display_phone_number} was approved as "${newVerifiedName}".`;
                            } else {
                                // This can happen if the number isn't in our DB yet.
                                // We still want to create the notification.
                                shouldNotify = true;
                                notificationMessage = `For project '${projectForUpdate.name}', a display name update for ${value.display_phone_number} was approved as "${newVerifiedName}". The project's numbers might need syncing.`;
                            }
                        }
                    } else { // Handle DEFERRED, REJECTED, etc.
                        const requestedName = value.requested_verified_name;
                        const decision = value.decision.toLowerCase().replace(/_/g, ' ');
                        notificationMessage = `For project '${projectForUpdate.name}', the name update for ${value.display_phone_number} to "${requestedName}" has been ${decision}.`;
                        if (value.rejection_reason && value.rejection_reason !== 'NONE') {
                            notificationMessage += ` Reason: ${value.rejection_reason}.`;
                        }
                        shouldNotify = true;
                    }

                    if (shouldNotify && notificationMessage) {
                        await db.collection('notifications').insertOne({
                            projectId: projectForUpdate._id,
                            wabaId: projectForUpdate.wabaId,
                            message: notificationMessage,
                            link: '/dashboard/numbers',
                            isRead: false,
                            createdAt: new Date(),
                            eventType: change.field,
                        });
                        revalidatePath('/dashboard/numbers');
                        revalidatePath('/dashboard', 'layout');
                    }
                    break;
                }
                    
                case 'phone_number_verification_update':
                    if (!project) break;
                    if (value.display_phone_number && value.new_code_verification_status) {
                        const result = await db.collection('projects').updateOne({ _id: project._id, 'phoneNumbers.display_phone_number': value.display_phone_number }, { $set: { 'phoneNumbers.$.code_verification_status': value.new_code_verification_status } });
                        if (result.modifiedCount > 0) {
                            await db.collection('notifications').insertOne({
                                projectId: project._id, wabaId: project.wabaId, message: `For project '${project.name}', verification status for ${value.display_phone_number} is now ${value.new_code_verification_status.replace(/_/g, ' ').toLowerCase()}.`,
                                link: '/dashboard/numbers', isRead: false, createdAt: new Date(), eventType: change.field,
                            });
                            revalidatePath('/dashboard/numbers'); revalidatePath('/dashboard', 'layout');
                        }
                    }
                    break;

                case 'message_template_status_update': 
                case 'template_status_update': 
                    if (!project) break;
                    if (value.event && value.message_template_id) {
                        const result = await db.collection('templates').updateOne({ metaId: value.message_template_id, projectId: project._id }, { $set: { status: value.event.toUpperCase() } });
                        if (result.modifiedCount > 0) {
                            await db.collection('notifications').insertOne({
                               projectId: project._id, wabaId: project.wabaId, message: `For project '${project.name}', template '${value.message_template_name}' status updated to ${value.event}. Reason: ${value.reason || 'None'}.`,
                               link: '/dashboard/templates', isRead: false, createdAt: new Date(), eventType: change.field,
                           });
                           revalidatePath('/dashboard/templates'); revalidatePath('/dashboard', 'layout');
                        }
                    }
                    break;
                
                case 'template_category_update':
                    if (!project) break;
                    if (value.message_template_id && value.new_category) {
                        const result = await db.collection('templates').updateOne({ metaId: value.message_template_id, projectId: project._id }, { $set: { category: value.new_category.toUpperCase() } });
                        if (result.modifiedCount > 0) {
                             await db.collection('notifications').insertOne({
                                projectId: project._id, wabaId: project.wabaId, message: `For project '${project.name}', category for template '${value.message_template_name}' was changed to ${value.new_category}.`,
                                link: '/dashboard/templates', isRead: false, createdAt: new Date(), eventType: change.field,
                            });
                            revalidatePath('/dashboard/templates'); revalidatePath('/dashboard', 'layout');
                        }
                    }
                    break;
                
                case 'message_template_quality_update': {
                    if (value.message_template_id && value.new_quality_score) {
                        const template = await db.collection('templates').findOne({ metaId: value.message_template_id });
                        if (template) {
                            const projectForTemplate = await db.collection('projects').findOne({ _id: template.projectId }, { projection: { _id: 1, name: 1, wabaId: 1 } });
                            if (projectForTemplate) {
                                const result = await db.collection('templates').updateOne({ _id: template._id }, { $set: { qualityScore: value.new_quality_score.toUpperCase() } });
                                if (result.modifiedCount > 0) {
                                     await db.collection('notifications').insertOne({
                                        projectId: projectForTemplate._id, wabaId: projectForTemplate.wabaId, message: `For project '${projectForTemplate.name}', quality for template '${value.message_template_name}' is now ${value.new_quality_score}.`,
                                        link: '/dashboard/templates', isRead: false, createdAt: new Date(), eventType: change.field,
                                    });
                                    revalidatePath('/dashboard/templates'); revalidatePath('/dashboard', 'layout');
                                }
                            }
                        }
                    }
                    break;
                }
                
                case 'account_review_update':
                    if (!project) break;
                    if (value.decision) {
                        const result = await db.collection('projects').updateOne({ _id: project._id }, { $set: { reviewStatus: value.decision } });
                        if (result.modifiedCount > 0) {
                            await db.collection('notifications').insertOne({
                                projectId: project._id, wabaId: project.wabaId, message: `Account review for '${project.name}' was completed. The new status is ${value.decision}.`,
                                link: '/dashboard/information', isRead: false, createdAt: new Date(), eventType: change.field,
                            });
                            revalidatePath('/dashboard'); revalidatePath('/dashboard/information'); revalidatePath('/dashboard', 'layout');
                        }
                    }
                    break;
                
                case 'account_update':
                    if (value.event === 'VERIFIED_ACCOUNT' && project) {
                        const result = await db.collection('projects').updateOne({ _id: project._id }, { $set: { reviewStatus: 'VERIFIED' } });
                        if (result.modifiedCount > 0) {
                            await db.collection('notifications').insertOne({
                                projectId: project._id, wabaId: project.wabaId, message: `Account for project '${project.name}' has been verified.`,
                                link: '/dashboard/information', isRead: false, createdAt: new Date(), eventType: change.field,
                            });
                            revalidatePath('/dashboard'); revalidatePath('/dashboard/information'); revalidatePath('/dashboard', 'layout');
                        }
                    }
                    break;

                case 'business_capability_update': {
                    if (!project) break;
                    const updatePayload: any = {};
                    if (value.max_daily_conversation_per_phone !== undefined) updatePayload['businessCapabilities.max_daily_conversation_per_phone'] = value.max_daily_conversation_per_phone;
                    if (value.max_phone_numbers_per_business !== undefined) updatePayload['businessCapabilities.max_phone_numbers_per_business'] = value.max_phone_numbers_per_business;
                    if (Object.keys(updatePayload).length > 0) {
                        const result = await db.collection('projects').updateOne({ _id: project._id }, { $set: updatePayload });
                        if (result.modifiedCount > 0) {
                            await db.collection('notifications').insertOne({
                                projectId: project._id, wabaId: project.wabaId, message: `Business capabilities for '${project.name}' have been updated.`,
                                link: '/dashboard/information', isRead: false, createdAt: new Date(), eventType: change.field,
                            });
                            revalidatePath('/dashboard/information'); revalidatePath('/dashboard', 'layout');
                        }
                    }
                    break;
                }

                default:
                    console.log(`Received and logged an unhandled or log-only event type: "${change.field}"`);
                    break;
            }
          }
        }
      }
    } catch (error) {
      console.error('Error processing webhook in background:', error);
    }
  })();

  return NextResponse.json({ status: 'success' }, { status: 200 });
}
