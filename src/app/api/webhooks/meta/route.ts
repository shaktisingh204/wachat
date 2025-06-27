
import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { revalidatePath } from 'next/cache';

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
  // This is a best practice to avoid timeouts from Meta's servers.
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
          const wabaId = entry.id; // Can be Solution Partner ID or 0
          
          for (const change of entry.changes) {
            const value = change.value;
            if (!value) continue;

            // Handle special cases that don't rely on a pre-existing project matching the entry.id
            if (change.field === 'account_update') {
                console.log(`Processing account_update event: ${value.event}`);
                if (value.event === 'PARTNER_REMOVED' && value.waba_info?.waba_id) {
                    const wabaIdToRemove = value.waba_info.waba_id;
                    const projectToDelete = await db.collection('projects').findOne({ wabaId: wabaIdToRemove });

                    if (projectToDelete) {
                        await db.collection('projects').deleteOne({ _id: projectToDelete._id });
                        
                        await db.collection('notifications').insertOne({
                            projectId: projectToDelete._id,
                            wabaId: wabaIdToRemove,
                            message: `Project '${projectToDelete.name}' was removed as it is no longer managed by this business partner.`,
                            link: '/dashboard',
                            isRead: false,
                            createdAt: new Date(),
                            eventType: change.field,
                        });
                        revalidatePath('/dashboard');
                        revalidatePath('/dashboard', 'layout');
                    }
                    continue; // This change has been handled, move to the next.
                } else if (value.event === 'PARTNER_ADDED' && value.waba_info?.waba_id) {
                    const wabaIdToAdd = value.waba_info.waba_id;
                    const accessToken = process.env.META_SYSTEM_USER_ACCESS_TOKEN;
                    const apiVersion = 'v22.0';

                    if (!accessToken) {
                        console.error("Cannot add new partner project: META_SYSTEM_USER_ACCESS_TOKEN is not set.");
                        continue;
                    }

                    try {
                        const wabaDetailsResponse = await fetch(`https://graph.facebook.com/${apiVersion}/${wabaIdToAdd}?access_token=${accessToken}&fields=name`);
                        if (!wabaDetailsResponse.ok) {
                           const errorText = await wabaDetailsResponse.text();
                           throw new Error(`Failed to fetch WABA details for ${wabaIdToAdd}: ${errorText}`);
                        }
                        const wabaDetails = await wabaDetailsResponse.json();
                        const projectName = wabaDetails.name;

                        const phoneNumbersResponse = await fetch(`https://graph.facebook.com/${apiVersion}/${wabaIdToAdd}/phone_numbers?access_token=${accessToken}&fields=verified_name,display_phone_number,id,quality_rating,code_verification_status,platform_type,throughput`);
                        if (!phoneNumbersResponse.ok) {
                            const errorText = await phoneNumbersResponse.text();
                            throw new Error(`Failed to fetch phone numbers for ${wabaIdToAdd}: ${errorText}`);
                        }
                        const phoneNumbersData = await phoneNumbersResponse.json();
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
                            name: projectName,
                            wabaId: wabaIdToAdd,
                            accessToken: accessToken,
                            phoneNumbers: phoneNumbers,
                            messagesPerSecond: 1000,
                            reviewStatus: 'UNKNOWN',
                        };
                        
                        const updateResult = await db.collection('projects').updateOne(
                            { wabaId: wabaIdToAdd },
                            { $set: projectDoc, $setOnInsert: { createdAt: new Date() } },
                            { upsert: true }
                        );

                        const newProject = await db.collection('projects').findOne({wabaId: wabaIdToAdd}, {projection: {_id: 1}});

                        if (newProject) {
                            await db.collection('notifications').insertOne({
                                projectId: newProject._id,
                                wabaId: wabaIdToAdd,
                                message: `New project '${projectName}' was automatically added and synced from Meta.`,
                                link: '/dashboard',
                                isRead: false,
                                createdAt: new Date(),
                                eventType: change.field,
                            });
                            revalidatePath('/dashboard');
                            revalidatePath('/dashboard', 'layout');
                        }
                    } catch (e: any) {
                        console.error(`Failed to process PARTNER_ADDED event for WABA ${wabaIdToAdd}:`, e.message);
                    }
                    continue; // This change has been handled, move to the next.
                }
            }
            
            // For all other event types, we require a project to exist that is associated with the webhook event.
            // The project can be identified by the WABA ID, or by one of the phone numbers associated with it.
            const project = await db.collection('projects').findOne(
                { 
                    $or: [
                        // Match by WABA ID, for account-level events
                        { wabaId: wabaId },
                        // Match by phone number ID, primarily from 'messages' events
                        { 'phoneNumbers.id': value.metadata?.phone_number_id },
                        // Match by display phone number, from various phone-related events
                        { 'phoneNumbers.display_phone_number': value.display_phone_number }, 
                        // Match by display phone number from 'account_update' events
                        { 'phoneNumbers.display_phone_number': value.phone_number },
                        // Match by display phone number from 'messages' events where it's nested
                        { 'phoneNumbers.display_phone_number': value.metadata?.display_phone_number }
                    ]
                }, 
                { projection: { _id: 1, name: 1, wabaId: 1 } }
            );

            // Allow certain events to proceed even if the project lookup fails, as they may have self-contained identifiers
            if (!project && change.field !== 'message_template_quality_update') {
                const identifiers = `WABA ID: ${wabaId}, Phone Number ID: ${value.metadata?.phone_number_id}, Display Phone: ${value.display_phone_number || value.metadata?.display_phone_number || value.phone_number}`;
                console.log(`Webhook received for field '${change.field}' with no matching project found for identifiers (${identifiers}). Skipping DB updates.`);
                continue;
            }

            console.log(`Processing change for field: "${change.field}" for project ${project?.name || 'project identified by other means'}`);
            
            switch (change.field) {
                // --- MESSAGE EVENTS ---
                case 'messages': {
                    if (!project) break; // Needs a project to associate with
                    const { metadata, contacts, messages } = value;
                    if (!metadata || !contacts || !messages) continue;

                    const message = messages[0];
                    const contact = contacts[0];
                    const senderName = contact.profile?.name || 'Unknown User';
                    
                    // Prepare document for the new incoming_messages collection
                    await db.collection('incoming_messages').insertOne({
                        projectId: project._id,
                        wabaId: project.wabaId,
                        phoneNumberId: metadata.phone_number_id,
                        displayPhoneNumber: metadata.display_phone_number,
                        senderWaId: message.from,
                        senderName: senderName,
                        messageId: message.id,
                        messageTimestamp: new Date(parseInt(message.timestamp, 10) * 1000),
                        type: message.type,
                        content: message.text ? { body: message.text.body } : { raw: message }, // Handle text messages, store others raw
                        isRead: false,
                        receivedAt: new Date()
                    });

                    // Create a notification
                    await db.collection('notifications').insertOne({
                        projectId: project._id,
                        wabaId: project.wabaId,
                        message: `New message from ${senderName} for project '${project.name}'.`,
                        link: '/dashboard/notifications', // Placeholder for future inbox link
                        isRead: false,
                        createdAt: new Date(),
                        eventType: change.field,
                    });

                    // Revalidate paths to update UI
                    revalidatePath('/dashboard/notifications');
                    revalidatePath('/dashboard', 'layout'); // Update notification count in header
                    break;
                }

                // --- PHONE NUMBER UPDATES ---
                case 'phone_number_quality_update':
                    if (!project) break;
                    if (value.display_phone_number && value.event) {
                        const updatePayload: any = {};
                        let notificationMessage = '';
                        
                        if (value.current_limit) {
                            updatePayload['phoneNumbers.$.throughput.level'] = value.current_limit;
                        }

                        if (value.event === 'ONBOARDING') {
                            notificationMessage = `For project '${project.name}', phone number ${value.display_phone_number} has been onboarded. New limit is ${value.current_limit || 'N/A'}.`;
                        } else {
                            const newQuality = value.event === 'FLAGGED' ? 'RED' : value.event === 'WARNED' ? 'YELLOW' : 'GREEN';
                            updatePayload['phoneNumbers.$.quality_rating'] = newQuality;
                            notificationMessage = `For project '${project.name}', quality for ${value.display_phone_number} is now ${newQuality}. Throughput limit is ${value.current_limit || 'unchanged'}.`;
                        }

                        if (Object.keys(updatePayload).length > 0) {
                            const result = await db.collection('projects').updateOne(
                                { _id: project._id, 'phoneNumbers.display_phone_number': value.display_phone_number },
                                { $set: updatePayload }
                            );
                            
                            if (result.modifiedCount > 0) {
                                await db.collection('notifications').insertOne({
                                    projectId: project._id, wabaId: project.wabaId,
                                    message: notificationMessage,
                                    link: '/dashboard/numbers', isRead: false, createdAt: new Date(),
                                    eventType: change.field,
                                });
                                revalidatePath('/dashboard/numbers');
                                revalidatePath('/dashboard', 'layout');
                            }
                        }
                    }
                    break;
                
                case 'phone_number_name_update':
                    if (!project) break;
                    if (value.display_phone_number && value.decision === 'APPROVED') {
                        const newVerifiedName = value.new_verified_name || value.requested_verified_name;
                         if (newVerifiedName) {
                            const result = await db.collection('projects').updateOne(
                                { _id: project._id, 'phoneNumbers.display_phone_number': value.display_phone_number },
                                { $set: { 'phoneNumbers.$.verified_name': newVerifiedName } }
                            );

                            if (result.modifiedCount > 0) {
                                 await db.collection('notifications').insertOne({
                                    projectId: project._id, wabaId: project.wabaId,
                                    message: `For project '${project.name}', display name for ${value.display_phone_number} was approved as "${newVerifiedName}".`,
                                    link: '/dashboard/numbers', isRead: false, createdAt: new Date(),
                                    eventType: change.field,
                                });
                                revalidatePath('/dashboard/numbers');
                                revalidatePath('/dashboard', 'layout');
                            }
                        }
                    }
                    break;
                    
                case 'phone_number_verification_update':
                    if (!project) break;
                    if (value.display_phone_number && value.new_code_verification_status) {
                        const result = await db.collection('projects').updateOne(
                            { _id: project._id, 'phoneNumbers.display_phone_number': value.display_phone_number },
                            { $set: { 'phoneNumbers.$.code_verification_status': value.new_code_verification_status } }
                        );
                        if (result.modifiedCount > 0) {
                            await db.collection('notifications').insertOne({
                                projectId: project._id, wabaId: project.wabaId,
                                message: `For project '${project.name}', verification status for ${value.display_phone_number} is now ${value.new_code_verification_status.replace(/_/g, ' ').toLowerCase()}.`,
                                link: '/dashboard/numbers', isRead: false, createdAt: new Date(),
                                eventType: change.field,
                            });
                            revalidatePath('/dashboard/numbers');
                            revalidatePath('/dashboard', 'layout');
                        }
                    }
                    break;

                // --- TEMPLATE UPDATES ---
                case 'message_template_status_update': // Covers approved, rejected, etc.
                case 'template_status_update': // Older name for the same event
                    if (!project) break;
                    if (value.event && value.message_template_id) {
                        const result = await db.collection('templates').updateOne(
                            { metaId: value.message_template_id, projectId: project._id },
                            { $set: { status: value.event.toUpperCase() } }
                        );
                        if (result.modifiedCount > 0) {
                            await db.collection('notifications').insertOne({
                               projectId: project._id, wabaId: project.wabaId,
                               message: `For project '${project.name}', template '${value.message_template_name}' status updated to ${value.event}. Reason: ${value.reason || 'None'}.`,
                               link: '/dashboard/templates', isRead: false, createdAt: new Date(),
                               eventType: change.field,
                           });
                           revalidatePath('/dashboard/templates');
                           revalidatePath('/dashboard', 'layout');
                        }
                    }
                    break;
                
                case 'template_category_update':
                    if (!project) break;
                    if (value.message_template_id && value.new_category) {
                        const result = await db.collection('templates').updateOne(
                            { metaId: value.message_template_id, projectId: project._id },
                            { $set: { category: value.new_category.toUpperCase() } }
                        );
                        if (result.modifiedCount > 0) {
                             await db.collection('notifications').insertOne({
                                projectId: project._id, wabaId: project.wabaId,
                                message: `For project '${project.name}', category for template '${value.message_template_name}' was changed to ${value.new_category}.`,
                                link: '/dashboard/templates', isRead: false, createdAt: new Date(),
                                eventType: change.field,
                            });
                            revalidatePath('/dashboard/templates');
                            revalidatePath('/dashboard', 'layout');
                        }
                    }
                    break;
                
                case 'message_template_quality_update': {
                    if (value.message_template_id && value.new_quality_score) {
                        // Find the template by its unique Meta ID, since WABA ID might be '0'
                        const template = await db.collection('templates').findOne({ metaId: value.message_template_id });
                        if (!template) {
                            console.log(`Webhook for template quality update skipped: template with metaId ${value.message_template_id} not found.`);
                            break;
                        }

                        const projectForTemplate = await db.collection('projects').findOne(
                            { _id: template.projectId },
                            { projection: { _id: 1, name: 1, wabaId: 1 } }
                        );
                        if (!projectForTemplate) {
                            console.log(`Webhook for template quality update skipped: project with id ${template.projectId} not found for template ${template.name}.`);
                            break;
                        }

                        const result = await db.collection('templates').updateOne(
                            { _id: template._id },
                            { $set: { qualityScore: value.new_quality_score.toUpperCase() } }
                        );

                        if (result.modifiedCount > 0) {
                             await db.collection('notifications').insertOne({
                                projectId: projectForTemplate._id, wabaId: projectForTemplate.wabaId,
                                message: `For project '${projectForTemplate.name}', quality for template '${value.message_template_name}' is now ${value.new_quality_score}.`,
                                link: '/dashboard/templates', isRead: false, createdAt: new Date(),
                                eventType: change.field,
                            });
                            revalidatePath('/dashboard/templates');
                            revalidatePath('/dashboard', 'layout');
                        }
                    }
                    break;
                }

                // --- ACCOUNT UPDATES ---
                case 'account_review_update':
                    if (!project) break;
                    if (value.decision) {
                        const result = await db.collection('projects').updateOne(
                            { _id: project._id },
                            { $set: { reviewStatus: value.decision } }
                        );
                        if (result.modifiedCount > 0) {
                            await db.collection('notifications').insertOne({
                                projectId: project._id, wabaId: project.wabaId,
                                message: `Account review for '${project.name}' was completed. The new status is ${value.decision}.`,
                                link: '/dashboard/information', isRead: false, createdAt: new Date(),
                                eventType: change.field,
                            });
                            revalidatePath('/dashboard');
                            revalidatePath('/dashboard/information');
                            revalidatePath('/dashboard', 'layout');
                        }
                    }
                    break;
                
                case 'account_update':
                    if (!project) break;
                    if (value.event === 'VERIFIED_ACCOUNT') {
                        const result = await db.collection('projects').updateOne(
                            { _id: project._id },
                            { $set: { reviewStatus: 'VERIFIED' } }
                        );
                        if (result.modifiedCount > 0) {
                            await db.collection('notifications').insertOne({
                                projectId: project._id, wabaId: project.wabaId,
                                message: `Account for project '${project.name}' has been verified.`,
                                link: '/dashboard/information', isRead: false, createdAt: new Date(),
                                eventType: change.field,
                            });
                            revalidatePath('/dashboard');
                            revalidatePath('/dashboard/information');
                            revalidatePath('/dashboard', 'layout');
                        }
                    }
                    break;

                case 'business_capability_update': {
                    if (!project) break;
                    const updatePayload: any = {};
                    if (value.max_daily_conversation_per_phone !== undefined) {
                        updatePayload['businessCapabilities.max_daily_conversation_per_phone'] = value.max_daily_conversation_per_phone;
                    }
                    if (value.max_phone_numbers_per_business !== undefined) {
                        updatePayload['businessCapabilities.max_phone_numbers_per_business'] = value.max_phone_numbers_per_business;
                    }

                    if (Object.keys(updatePayload).length > 0) {
                        const result = await db.collection('projects').updateOne(
                            { _id: project._id },
                            { $set: updatePayload }
                        );

                        if (result.modifiedCount > 0) {
                            await db.collection('notifications').insertOne({
                                projectId: project._id, wabaId: project.wabaId,
                                message: `Business capabilities for '${project.name}' have been updated.`,
                                link: '/dashboard/information', isRead: false, createdAt: new Date(),
                                eventType: change.field,
                            });
                            revalidatePath('/dashboard/information');
                            revalidatePath('/dashboard', 'layout');
                        }
                    }
                    break;
                }

                case 'payment_configuration_update':
                    if (!project) break;
                    if (value.configuration_name && value.provider_name) {
                        const result = await db.collection('projects').updateOne(
                            { _id: project._id },
                            { 
                                $set: { 
                                    'paymentConfiguration': {
                                        configuration_name: value.configuration_name,
                                        provider_name: value.provider_name,
                                        provider_mid: value.provider_mid,
                                        status: value.status,
                                        created_timestamp: value.created_timestamp,
                                        updated_timestamp: value.updated_timestamp,
                                    }
                                } 
                            }
                        );
                        if (result.modifiedCount > 0) {
                            await db.collection('notifications').insertOne({
                                projectId: project._id, wabaId: project.wabaId,
                                message: `For project '${project.name}', payment configuration '${value.configuration_name}' updated. New status: ${value.status}.`,
                                link: '/dashboard/information', isRead: false, createdAt: new Date(),
                                eventType: change.field,
                            });
                            revalidatePath('/dashboard/information');
                            revalidatePath('/dashboard', 'layout');
                        }
                    }
                    break;

                // --- LOG-ONLY EVENTS ---
                case 'message_deliveries':
                case 'message_reads':
                case 'message_reactions':
                case 'message_echoes':
                case 'smb_message_echoes':
                case 'status':
                case 'account_alerts':
                case 'message_template_edit_update':
                case 'message_template_limit_update':
                case 'commerce_policy_update':
                case 'permanent_failure':
                case 'security':
                case 'partner_solutions':
                case 'user_preferences':
                case 'tracking_events':
                case 'audience_consent_update':
                case 'privacy_status_update':
                case 'messaging_payment_update':
                case 'two_step_verification_update':
                case 'messaging_handovers':
                    console.log(`Received and logged event type: "${change.field}"`);
                    break;
                    
                default:
                    console.log(`Received and logged an unhandled event type: "${change.field}"`);
                    break;
            }
          }
        }
      }
    } catch (error) {
      // Log any errors that occur during background processing
      console.error('Error processing webhook in background:', error);
    }
  })();

  // Acknowledge receipt of the event immediately to prevent retries
  return NextResponse.json({ status: 'success' }, { status: 200 });
}
