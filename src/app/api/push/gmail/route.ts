/**
 * POST /api/push/gmail
 *
 * Gmail API → Cloud Pub/Sub → push webhook endpoint.
 *
 * Gmail watches a user's INBOX and, on change, publishes a Pub/Sub message to
 * a topic whose push subscription POSTs here. The Pub/Sub envelope looks like:
 *
 *   { "message": { "data": "<base64url JSON>", "messageId": "...",
 *                  "publishTime": "..." },
 *     "subscription": "projects/PROJECT/subscriptions/SUB" }
 *
 * `message.data` base64-decodes to `{ "emailAddress", "historyId" }`.
 * IMPORTANT: `historyId` is a WATERMARK, not a message id — the push carries
 * only a pointer; the actual messages must be fetched separately via
 * `users.history.list(startHistoryId)`.
 *
 * Contract (per the R&D note):
 *   - Respond 2xx FAST to ACK. Non-2xx / timeout ⇒ Pub/Sub redelivers.
 *   - Do NOT fetch synchronously here — just record a resync marker and let the
 *     async sync engine do the work.
 *   - This handler runs WITHOUT a session/cookie. We resolve the workspace
 *     from the matching `sabmail_accounts` doc (by emailAddress) and stamp the
 *     marker with that workspaceId — NEVER call getSabmailWorkspaceId() here.
 *
 * No webhook secret to manage in-app: auth is enforced at the Pub/Sub
 * subscription layer (OIDC bearer / shared `?token=`). See TODO below to wire
 * OIDC JWT verification once the push SA + audience are provisioned.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { connectToDatabase } from '@/lib/mongodb';
import { SABMAIL_COLLECTIONS } from '@/lib/sabmail/db/collections';
import { getErrorMessage } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface GmailPushEnvelope {
  message?: {
    data?: string;
    messageId?: string;
    publishTime?: string;
  };
  subscription?: string;
}

interface GmailPushData {
  emailAddress?: string;
  historyId?: string | number;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // TODO(auth): when the Pub/Sub push subscription has OIDC enabled, verify the
  // `Authorization: Bearer <JWT>` against Google's OIDC certs
  // (https://www.googleapis.com/oauth2/v3/certs), and check `aud` == the
  // configured audience and `email` == the push service account. Reject 401/403
  // otherwise. (Pub/Sub also supports a weaker `?token=` shared secret.)

  let envelope: GmailPushEnvelope;
  try {
    envelope = (await req.json()) as GmailPushEnvelope;
  } catch {
    // Malformed body — ACK so Pub/Sub stops retrying a poison message.
    return new NextResponse(null, { status: 204 });
  }

  const message = envelope?.message;
  if (!message?.data) {
    // Empty/malformed — ACK to drop it.
    return new NextResponse(null, { status: 204 });
  }

  let payload: GmailPushData;
  try {
    payload = JSON.parse(Buffer.from(message.data, 'base64').toString('utf8')) as GmailPushData;
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const emailAddress = String(payload.emailAddress ?? '').toLowerCase();
  const historyId = payload.historyId != null ? String(payload.historyId) : '';

  console.log(
    `[push/gmail] notification emailAddress=${emailAddress || '?'} historyId=${historyId || '?'} ` +
      `messageId=${message.messageId ?? '?'}`,
  );

  // Enqueue a resync marker (fast, non-blocking). The async sync engine claims
  // these and runs the partial sync. Dedup on the Pub/Sub messageId.
  try {
    const { db } = await connectToDatabase();
    const events = db.collection(SABMAIL_COLLECTIONS.events);

    // Resolve the owning workspace from the connected mailbox (no session here).
    let workspaceId: string | null = null;
    if (emailAddress) {
      const account = await db
        .collection(SABMAIL_COLLECTIONS.accounts)
        .findOne({ provider: 'gmail', email: emailAddress }, { projection: { workspaceId: 1 } });
      workspaceId = account ? String((account as { workspaceId?: unknown }).workspaceId ?? '') : null;
    }

    await events.updateOne(
      // Idempotency key — Pub/Sub is at-least-once; duplicates/out-of-order are normal.
      { event: 'gmail_push', pubsubMessageId: message.messageId ?? `${emailAddress}:${historyId}` },
      {
        $set: {
          event: 'gmail_push',
          workspaceId,
          emailAddress,
          historyId,
          pubsubMessageId: message.messageId ?? null,
          status: 'pending',
          ts: new Date(),
        },
      },
      { upsert: true },
    );
  } catch (err) {
    // Persisting the marker failed — log but still ACK. (Returning non-2xx would
    // trigger a Pub/Sub redelivery storm; prefer our own retry off the marker.)
    console.error('[push/gmail] marker enqueue failed:', getErrorMessage(err));
  }

  // TODO(real sync engine): the async worker picks up `gmail_push` markers and
  // runs `users.history.list(startHistoryId=lastHistoryId)`, paging by
  // nextPageToken; for each `messagesAdded` it hydrates via
  // `users.messages.get(id)` into the message store, then stores the response's
  // top-level historyId as the new lastHistoryId on the account syncCursor.
  // CRITICAL gotcha: if startHistoryId is too old, history.list returns HTTP 404
  // ⇒ do a FULL resync via messages.list and re-establish the watch baseline.

  // Fast ACK — any 2xx tells Pub/Sub the message is handled.
  return new NextResponse(null, { status: 200 });
}
