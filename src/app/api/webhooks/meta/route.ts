
import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

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
  console.log('Received webhook payload:', JSON.stringify(body, null, 2));

  // Process the webhook in the background without blocking the response.
  // This is a best practice to avoid timeouts from Meta's servers.
  (async () => {
    try {
      if (body.object === 'whatsapp_business_account') {
        const { db } = await connectToDatabase();

        for (const entry of body.entry) {
          const wabaId = entry.id;
          for (const change of entry.changes) {
            
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
                } else if (result.matchedCount > 0 && result.modifiedCount === 0) {
                  console.log(`Messaging limit for ${display_phone_number} is already ${current_limit}. No update needed.`);
                } else {
                  console.warn(`Could not find a matching project or phone number for WABA ID ${wabaId} and phone ${display_phone_number} to update limit.`);
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
