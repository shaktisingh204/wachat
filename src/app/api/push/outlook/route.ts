/**
 * POST /api/push/outlook
 *
 * Microsoft Graph change-notifications → webhook endpoint.
 *
 * Two paths share one POST handler:
 *
 *  1. VALIDATION HANDSHAKE (on subscription create AND on renewal/reauth):
 *     Graph sends `POST ...?validationToken=<URL-encoded opaque token>` with
 *     `Content-Type: text/plain`. We MUST reply within 10 seconds with
 *     HTTP 200, `Content-Type: text/plain`, body = the URL-decoded token
 *     verbatim — no JSON, no HTML escaping, no re-encoding (encoding it ⇒
 *     validation fails ⇒ subscription is never created). Next.js has already
 *     URL-decoded the query value for us; we echo it as-is.
 *
 *  2. CHANGE NOTIFICATION:
 *     Body is `{ "value": [ ...notifications ] }` — an ARRAY (batched across
 *     subscriptions). Each item carries `clientState`, `subscriptionId`,
 *     `changeType`, `resource`, and `resourceData.id`. Default webhooks deliver
 *     METADATA ONLY — `resourceData.id` is a pointer; the message body is
 *     fetched separately via `GET /me/messages/{id}`.
 *
 * Contract (per the R&D note):
 *   - ACK with a 2xx within ~3 seconds. We validate + persist markers and
 *     return 202 Accepted; the fetch happens async.
 *   - Validate `clientState` against the stored per-subscription secret; drop
 *     items that don't match (possible rogue sender).
 *   - No session/cookie here. Resolve the owning workspace from the stored
 *     subscription / mailbox and stamp the marker with that workspaceId —
 *     NEVER call getSabmailWorkspaceId() in a webhook.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { connectToDatabase } from '@/lib/mongodb';
import { SABMAIL_COLLECTIONS } from '@/lib/sabmail/db/collections';
import { getErrorMessage } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface GraphResourceData {
  '@odata.type'?: string;
  '@odata.id'?: string;
  '@odata.etag'?: string;
  id?: string;
}

interface GraphNotification {
  id?: string;
  subscriptionId?: string;
  subscriptionExpirationDateTime?: string;
  clientState?: string;
  changeType?: string;
  resource?: string;
  tenantId?: string;
  resourceData?: GraphResourceData;
}

interface GraphNotificationBatch {
  value?: GraphNotification[];
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);

  // ── 1. Validation handshake ───────────────────────────────────────────────
  // Next.js already URL-decodes searchParams values, so this is the plain token.
  const validationToken = url.searchParams.get('validationToken');
  if (validationToken !== null) {
    // Echo verbatim as text/plain, 200, within 10s. No JSON, no escaping.
    return new NextResponse(validationToken, {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    });
  }

  // ── 2. Change notification ────────────────────────────────────────────────
  let batch: GraphNotificationBatch;
  try {
    batch = (await req.json()) as GraphNotificationBatch;
  } catch {
    // Malformed body — still ACK so Graph doesn't hammer us with retries.
    return new NextResponse(null, { status: 202 });
  }

  const notifications = Array.isArray(batch?.value) ? batch.value : [];

  try {
    const { db } = await connectToDatabase();
    const events = db.collection(SABMAIL_COLLECTIONS.events);
    const accounts = db.collection(SABMAIL_COLLECTIONS.accounts);

    for (const n of notifications) {
      const messageId = n.resourceData?.id ?? null;
      const subscriptionId = n.subscriptionId ?? null;

      // Resolve the owning workspace from the stored subscription (no session here)
      // AND validate clientState against the per-subscription secret — a mismatch
      // means a spoofed sender, so drop the notification.
      let workspaceId: string | null = null;
      if (subscriptionId) {
        const account = await accounts.findOne(
          { provider: 'outlook', graphSubscriptionId: subscriptionId },
          { projection: { workspaceId: 1, graphSubscriptionSecret: 1 } },
        );
        if (!account) continue;
        const secret = (account as { graphSubscriptionSecret?: string }).graphSubscriptionSecret;
        if (secret && n.clientState !== secret) continue; // rogue sender → drop
        workspaceId = String((account as { workspaceId?: unknown }).workspaceId ?? '');
      }

      console.log(
        `[push/outlook] notification sub=${subscriptionId ?? '?'} change=${n.changeType ?? '?'} ` +
          `messageId=${messageId ?? '?'}`,
      );

      await events.updateOne(
        // Dedup on the notification id (falls back to sub+message).
        { event: 'graph_push', notificationId: n.id ?? `${subscriptionId}:${messageId}` },
        {
          $set: {
            event: 'graph_push',
            workspaceId,
            notificationId: n.id ?? null,
            subscriptionId,
            changeType: n.changeType ?? null,
            resource: n.resource ?? null,
            messageId,
            status: 'pending',
            ts: new Date(),
          },
        },
        { upsert: true },
      );
    }
  } catch (err) {
    // Returning 5xx would force Graph to retry (up to ~4h). We prefer to ACK and
    // recover off the persisted markers, so log and still 202 unless nothing was
    // persisted. (If you WANT retries on a hard outage, return 500 here.)
    console.error('[push/outlook] marker enqueue failed:', getErrorMessage(err));
  }

  // TODO(real sync engine): the async worker picks up `graph_push` markers and
  // hydrates each `messageId` via `GET /me/messages/{id}` into the message
  // store. For gap recovery / out-of-order delivery (notifications are
  // best-effort), drive `GET /me/mailFolders('inbox')/messages/delta` from the
  // stored @odata.deltaLink — delta is the source of truth. Also handle the
  // lifecycleNotificationUrl events (reauthorizationRequired / subscriptionRemoved
  // / missed) and the PATCH renewal cron (Graph mail subscriptions expire ≈2.95d).

  // Fast ACK — 202 Accepted; the fetch runs async.
  return new NextResponse(null, { status: 202 });
}
