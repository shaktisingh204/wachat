
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
                        text += ` ${change.field}`; // The type of change, e.g., 'messages', 'template_status_update'
                        const value = change.value;
                        if (value) {
                            text += ` ${value.messaging_product || ''}`;
                            text += ` ${value.event || ''}`; // e.g., 'sent', 'delivered', 'APPROVED', 'REJECTED'
                            
                            // For 'messages' field
                            if (value.messages) {
                                for (const message of value.messages) {
                                    text += ` ${message.from || ''} ${message.id || ''} ${message.type || ''}`;
                                }
                            }
                            
                            // For 'statuses' field (part of 'messages' change)
                            if (value.statuses) {
                                for (const status of value.statuses) {
                                    text += ` ${status.id || ''} ${status.recipient_id || ''} ${status.status || ''}`;
                                }
                            }
                            
                            // For 'phone_number_quality_update' or 'phone_number_name_update'
                            if (value.display_phone_number) {
                                text += ` ${value.display_phone_number}`;
                            }

                            // For 'template_status_update'
                            if (value.message_template_id) {
                                text += ` ${value.message_template_id}`;
                            }
                            if (value.message_template_name) {
                                text += ` ${value.message_template_name}`;
                            }
                        }
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
            
            // Handle changes to a phone number's messaging limit (throughput)
            if (change.field === 'phone_number_quality_update') {
              const { event, current_limit, display_phone_number } = change.value;

              if (event === 'messaging_limit_update') {
                console.log(
                  `Processing messaging limit update for ${display_phone_number} to ${current_limit} in WABA ${wabaId}`
                );

                const result = await db.collection('projects').updateOne(
                  { wabaId: wabaId },
                  { $set: { 'phoneNumbers.$[phone].throughput.level': current_limit } },
                  { arrayFilters: [{ 'phone.display_phone_number': display_phone_number }] }
                );

                if (result.matchedCount > 0 && result.modifiedCount > 0) {
                  console.log(`Successfully updated messaging limit for ${display_phone_number}.`);
                  revalidatePath('/dashboard/numbers');
                } else if (result.matchedCount > 0 && result.modifiedCount === 0) {
                  console.log(`Messaging limit for ${display_phone_number} is already ${current_limit}. No update needed.`);
                } else {
                  console.warn(`Could not find a matching project or phone number for WABA ID ${wabaId} and phone ${display_phone_number} to update limit.`);
                }
              }
            }

            // Handle message template status changes
            if (change.field === 'message_template_status_update' || change.field === 'template_status_update') {
                const { event, message_template_id, message_template_name } = change.value;
                console.log(
                    `Processing template status update for template '${message_template_name}' (${message_template_id}). New status: ${event}`
                );

                if (event && message_template_id) {
                    const result = await db.collection('templates').updateOne(
                        { metaId: message_template_id },
                        { $set: { status: event.toUpperCase() } }
                    );

                    if (result.matchedCount > 0 && result.modifiedCount > 0) {
                        console.log(`Successfully updated status for template ${message_template_id}.`);
                        revalidatePath('/dashboard/templates');
                    } else if (result.matchedCount > 0 && result.modifiedCount === 0) {
                        console.log(`Template ${message_template_id} status is already ${event}. No update needed.`);
                    } else {
                        console.warn(`Could not find a matching template with metaId ${message_template_id} to update status.`);
                    }
                }
            }

            // You can add other event handlers here in the future
            // For example, to handle incoming messages or message status updates:
            // if (change.field === 'messages') { ... }

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
