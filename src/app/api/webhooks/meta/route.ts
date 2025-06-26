
import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { revalidatePath } from 'next/cache';

const getSearchableText = (payload: any): string => {
    let text = '';
    try {
        if (payload.object === 'whatsapp_business_account' && payload.entry) {
            for (const entry of payload.entry) {
                text += ` ${entry.id}`; // WABA ID
                if (entry.changes) {
                    for (const change of entry.changes) {
                        text += ` ${change.field}`; // The type of change
                        const value = change.value;
                        if (!value) continue;

                        text += ` ${value.messaging_product || ''}`;
                        text += ` ${value.event || ''}`; // Common field for template/phone updates
                        
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

                        // Phone Number related
                        if (value.display_phone_number) text += ` ${value.display_phone_number}`;
                        if (value.new_verified_name) text += ` ${value.new_verified_name}`;
                        if (value.new_code_verification_status) text += ` ${value.new_code_verification_status}`;
                        if (value.current_limit) text += ` ${value.current_limit}`;

                        // Template related
                        if (value.message_template_id) text += ` ${value.message_template_id}`;
                        if (value.message_template_name) text += ` ${value.message_template_name}`;
                        if (value.new_template_category) text += ` ${value.new_template_category}`;
                        if (value.new_template_quality) text += ` ${value.new_template_quality}`;

                        // Account related
                        if (value.update_type) text += ` ${value.update_type}`;
                        if (value.new_review_status) text += ` ${value.new_review_status}`;
                        if (value.ban_info) text += ` ${value.ban_info.waba_ban_state}`;
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

      if (body.object === 'whatsapp_business_account') {
        for (const entry of body.entry) {
          const wabaId = entry.id;
          for (const change of entry.changes) {
            console.log(`Processing change for field: "${change.field}" in WABA ${wabaId}`);
            const value = change.value;
            if (!value) continue;
            
            switch (change.field) {
                case 'phone_number_quality_update':
                    if (value.event === 'messaging_limit_update') {
                        const { current_limit, display_phone_number } = value;
                        console.log(`Processing messaging limit update for ${display_phone_number} to ${current_limit}`);
                        const result = await db.collection('projects').updateOne(
                            { wabaId: wabaId, 'phoneNumbers.display_phone_number': display_phone_number },
                            { $set: { 'phoneNumbers.$.throughput.level': current_limit } }
                        );
                        if (result.modifiedCount > 0) {
                            console.log(`Successfully updated messaging limit for ${display_phone_number}.`);
                            revalidatePath('/dashboard/numbers');
                        }
                    }
                    break;

                case 'message_template_status_update':
                case 'template_status_update':
                    if (value.event && value.message_template_id) {
                        console.log(`Processing template status update for template '${value.message_template_name}'. New status: ${value.event}`);
                        const result = await db.collection('templates').updateOne(
                            { metaId: value.message_template_id },
                            { $set: { status: value.event.toUpperCase() } }
                        );
                        if (result.modifiedCount > 0) {
                            console.log(`Successfully updated status for template ${value.message_template_id}.`);
                            revalidatePath('/dashboard/templates');
                        }
                    }
                    break;
                
                case 'phone_number_name_update':
                    if (value.display_phone_number && value.new_verified_name) {
                        console.log(`Processing name update for ${value.display_phone_number} to "${value.new_verified_name}"`);
                        const result = await db.collection('projects').updateOne(
                            { wabaId: wabaId, 'phoneNumbers.display_phone_number': value.display_phone_number },
                            { $set: { 'phoneNumbers.$.verified_name': value.new_verified_name } }
                        );
                        if (result.modifiedCount > 0) {
                            console.log(`Successfully updated name for ${value.display_phone_number}.`);
                            revalidatePath('/dashboard/numbers');
                        }
                    }
                    break;
                    
                case 'phone_number_verification_update':
                    if (value.display_phone_number && value.new_code_verification_status) {
                        console.log(`Processing verification status update for ${value.display_phone_number} to ${value.new_code_verification_status}`);
                        const result = await db.collection('projects').updateOne(
                            { wabaId: wabaId, 'phoneNumbers.display_phone_number': value.display_phone_number },
                            { $set: { 'phoneNumbers.$.code_verification_status': value.new_code_verification_status } }
                        );
                        if (result.modifiedCount > 0) {
                            console.log(`Successfully updated verification status for ${value.display_phone_number}.`);
                            revalidatePath('/dashboard/numbers');
                        }
                    }
                    break;
                
                case 'template_category_update':
                    if (value.message_template_id && value.new_template_category) {
                        console.log(`Processing category update for template ${value.message_template_id} to ${value.new_template_category}`);
                        const result = await db.collection('templates').updateOne(
                            { metaId: value.message_template_id },
                            { $set: { category: value.new_template_category.toUpperCase() } }
                        );
                        if (result.modifiedCount > 0) {
                            console.log(`Successfully updated category for template ${value.message_template_id}.`);
                            revalidatePath('/dashboard/templates');
                        }
                    }
                    break;

                case 'account_review_update':
                    console.log(`Account review update for WABA ${wabaId}. New status: ${value.new_review_status}`);
                    break;
                    
                default:
                    console.log(`Received and logged unhandled event type: "${change.field}"`);
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
