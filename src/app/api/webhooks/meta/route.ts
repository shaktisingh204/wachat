
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
                        text += ` ${value.new_template_category || ''}`;
                        text += ` ${value.new_quality_score || ''}`;
                        
                        // Account related
                        text += ` ${value.update_type || ''}`;
                        text += ` ${value.new_review_status || ''}`;
                        if (value.ban_info) text += ` ${value.ban_info.waba_ban_state}`;
                        if (value.alert_type) text += ` ${value.alert_type} ${value.alert_status}`;
                        if (value.entity_id) text += ` ${value.entity_id}`;
                        
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
          const wabaId = entry.id;
          const project = await db.collection('projects').findOne({ wabaId: wabaId }, { projection: { _id: 1 } });
          
          if (!project) {
              console.log(`Webhook received for unknown WABA ID ${wabaId}, skipping DB updates.`);
              continue;
          }

          for (const change of entry.changes) {
            console.log(`Processing change for field: "${change.field}" in WABA ${wabaId}`);
            const value = change.value;
            if (!value) continue;
            
            switch (change.field) {
                // --- PHONE NUMBER UPDATES ---
                case 'phone_number_quality_update':
                    if (value.display_phone_number && value.event) {
                        const newQuality = value.event === 'FLAGGED' ? 'RED' : value.event === 'WARNED' ? 'YELLOW' : 'GREEN';
                        const updatePayload: any = {
                            'phoneNumbers.$.quality_rating': newQuality
                        };
                        if (value.current_limit) {
                            updatePayload['phoneNumbers.$.throughput.level'] = value.current_limit;
                        }

                        const result = await db.collection('projects').updateOne(
                            { _id: project._id, 'phoneNumbers.display_phone_number': value.display_phone_number },
                            { $set: updatePayload }
                        );
                        
                        if (result.modifiedCount > 0) {
                            await db.collection('notifications').insertOne({
                                projectId: project._id, wabaId,
                                message: `Quality for ${value.display_phone_number} is now ${newQuality}. Throughput limit is ${value.current_limit || 'unchanged'}.`,
                                link: '/dashboard/numbers', isRead: false, createdAt: new Date(),
                            });
                            revalidatePath('/dashboard/numbers');
                            revalidatePath('/dashboard/layout');
                        }
                    }
                    break;
                
                case 'phone_number_name_update':
                    if (value.display_phone_number && value.requested_verified_name && value.decision === 'APPROVED') {
                        const result = await db.collection('projects').updateOne(
                            { _id: project._id, 'phoneNumbers.display_phone_number': value.display_phone_number },
                            { $set: { 'phoneNumbers.$.verified_name': value.requested_verified_name } }
                        );

                        if (result.modifiedCount > 0) {
                             await db.collection('notifications').insertOne({
                                projectId: project._id, wabaId,
                                message: `Display name for ${value.display_phone_number} was approved as "${value.requested_verified_name}".`,
                                link: '/dashboard/numbers', isRead: false, createdAt: new Date(),
                            });
                            revalidatePath('/dashboard/numbers');
                            revalidatePath('/dashboard/layout');
                        }
                    }
                    break;
                    
                case 'phone_number_verification_update':
                    if (value.display_phone_number && value.new_code_verification_status) {
                        const result = await db.collection('projects').updateOne(
                            { _id: project._id, 'phoneNumbers.display_phone_number': value.display_phone_number },
                            { $set: { 'phoneNumbers.$.code_verification_status': value.new_code_verification_status } }
                        );
                        if (result.modifiedCount > 0) revalidatePath('/dashboard/numbers');
                    }
                    break;

                // --- TEMPLATE UPDATES ---
                case 'message_template_status_update': // Covers approved, rejected, etc.
                case 'template_status_update': // Older name for the same event
                    if (value.event && value.message_template_id) {
                        const result = await db.collection('templates').updateOne(
                            { metaId: value.message_template_id, projectId: project._id },
                            { $set: { status: value.event.toUpperCase() } }
                        );
                        if (result.modifiedCount > 0) {
                            await db.collection('notifications').insertOne({
                               projectId: project._id, wabaId,
                               message: `Template '${value.message_template_name}' status updated to ${value.event}. Reason: ${value.reason || 'None'}.`,
                               link: '/dashboard/templates', isRead: false, createdAt: new Date(),
                           });
                           revalidatePath('/dashboard/templates');
                           revalidatePath('/dashboard/layout');
                        }
                    }
                    break;
                
                case 'template_category_update':
                    if (value.message_template_id && value.new_category) {
                        const result = await db.collection('templates').updateOne(
                            { metaId: value.message_template_id, projectId: project._id },
                            { $set: { category: value.new_category.toUpperCase() } }
                        );
                        if (result.modifiedCount > 0) revalidatePath('/dashboard/templates');
                    }
                    break;
                
                case 'message_template_quality_update':
                    if (value.message_template_id && value.new_quality_score) {
                        const result = await db.collection('templates').updateOne(
                            { metaId: value.message_template_id, projectId: project._id },
                            { $set: { qualityScore: value.new_quality_score.toUpperCase() } }
                        );
                        if (result.modifiedCount > 0) {
                            await db.collection('notifications').insertOne({
                               projectId: project._id, wabaId,
                               message: `Quality for template '${value.message_template_name}' is now ${value.new_quality_score}.`,
                               link: '/dashboard/templates', isRead: false, createdAt: new Date(),
                           });
                           revalidatePath('/dashboard/templates');
                           revalidatePath('/dashboard/layout');
                        }
                    }
                    break;

                // --- ACCOUNT UPDATES ---
                case 'account_review_update':
                    if (value.decision) {
                        const result = await db.collection('projects').updateOne(
                            { _id: project._id },
                            { $set: { reviewStatus: value.decision } }
                        );
                        if (result.modifiedCount > 0) {
                            await db.collection('notifications').insertOne({
                                projectId: project._id, wabaId,
                                message: `Your account review was completed. The new status is ${value.decision}.`,
                                link: '/dashboard/information', isRead: false, createdAt: new Date(),
                            });
                            revalidatePath('/dashboard');
                            revalidatePath('/dashboard/layout');
                        }
                    }
                    break;
                
                case 'payment_configuration_update':
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
                        if (result.modifiedCount > 0) revalidatePath('/dashboard/information');
                    }
                    break;

                // --- LOG-ONLY EVENTS ---
                case 'messages':
                case 'message_deliveries':
                case 'message_reads':
                case 'message_reactions':
                case 'message_echoes':
                case 'smb_message_echoes':
                case 'status':
                case 'account_update':
                case 'account_alerts':
                case 'business_capability_update':
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
