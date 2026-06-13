/**
 * POST /api/sabmail/internal/push-sync
 *
 * Internal hydration endpoint for the push-sync worker
 * (`src/workers/sabmail-push-sync.ts`). That worker runs under `tsx` as a
 * standalone process and CANNOT import the `server-only` provider adapters /
 * message store / credential decryptor, so when it claims a pending push marker
 * it POSTs the marker id here and this route does the actual provider
 * hydration server-side.
 *
 * What it does for a `{ markerId }`:
 *   1. Load the marker from `SABMAIL_COLLECTIONS.events` (a `gmail_push` or
 *      `graph_push` doc persisted by `/api/push/gmail` + `/api/push/outlook`).
 *   2. Resolve the owning mailbox account:
 *        - gmail_push → `{ provider:'gmail', email: emailAddress }`
 *        - graph_push → `{ provider:'outlook', graphSubscriptionId: subscriptionId }`
 *      (falling back to the marker's stamped `workspaceId` for scoping).
 *   3. `buildProviderContext` + `getMailProvider`, then
 *      `provider.listMessages(INBOX-equivalent, page 0)` and
 *      `upsertPersistedMessage` for each row into the unified message store.
 *
 * The push markers are POINTERS (Gmail historyId watermark / Graph metadata).
 * A real partial-sync engine would replay `users.history.list` / the Graph
 * `delta` link; until those adapters land, listing the INBOX head page is a
 * pragmatic hydration that converges the store on the latest mail.
 *
 * Auth mirrors the cron routes (and the sibling `bind-inbound` route):
 * `CRON_SECRET` via `Authorization: Bearer`, `x-cron-secret`, or `?secret=`.
 * When `CRON_SECRET` is unset (local/dev) the route is open. NOT a public
 * webhook — providers use `/api/push/*` instead.
 *
 * Everything here is best-effort: the provider adapters are `server-only` and
 * may not exist yet / may throw without live OAuth. We catch and return
 * `{ ok:false, error }` rather than crash so a marker can be re-claimed later.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { SABMAIL_COLLECTIONS } from '@/lib/sabmail/db/collections';
import {
  buildProviderContext,
  getMailProvider,
} from '@/lib/sabmail/providers/types';
import {
  ensureMessageStoreIndexes,
  upsertPersistedMessage,
  type PersistedMessageDoc,
} from '@/lib/sabmail/providers/message-store';
import type { SabmailAccount } from '@/lib/sabmail/types';
import type { SabmailMessageRow } from '@/app/sabmail/inbox/actions';
import { getErrorMessage } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Default page size for the INBOX head-page hydration. */
const HYDRATE_PAGE_SIZE = 25;

function authorize(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true; // not configured → open (local/dev)
  const auth = req.headers.get('authorization') ?? '';
  if (auth === `Bearer ${expected}`) return true;
  if ((req.headers.get('x-cron-secret') ?? '') === expected) return true;
  return (new URL(req.url).searchParams.get('secret') ?? '') === expected;
}

interface PushSyncBody {
  markerId?: string;
}

/** A push marker doc as persisted by `/api/push/gmail` + `/api/push/outlook`. */
interface PushMarkerDoc {
  _id: ObjectId;
  event?: string;
  workspaceId?: string | null;
  status?: string;
  /* gmail_push fields */
  emailAddress?: string;
  historyId?: string;
  /* graph_push fields */
  subscriptionId?: string | null;
  changeType?: string | null;
  resource?: string | null;
  messageId?: string | null;
}

/** The transport family's INBOX-equivalent folder/label id. */
function inboxFolderFor(provider: SabmailAccount['provider'] | string | undefined): string {
  // Gmail's INBOX label id is uppercase; Microsoft Graph's well-known folder is
  // lowercase `inbox`. IMAP/hosted adapters use the `INBOX` path.
  return provider === 'outlook' ? 'inbox' : 'INBOX';
}

/** Map an inbox row (transport-agnostic) to the unified persisted shape. */
function rowToPersisted(
  workspaceId: string,
  accountId: string,
  providerFamily: PersistedMessageDoc['provider'],
  folder: string,
  row: SabmailMessageRow,
): PersistedMessageDoc {
  return {
    workspaceId,
    accountId,
    provider: providerFamily,
    folder,
    // For IMAP the provider id is the UID string; gmail/graph rows still carry a
    // numeric `uid` on the shared row shape, so render it as the stable string.
    providerMessageId: String(row.uid),
    messageId: row.messageId ?? null,
    threadId: null,
    subject: row.subject || '(no subject)',
    fromName: row.fromName || '',
    fromEmail: (row.fromEmail || '').toLowerCase(),
    to: [],
    date: row.date ? new Date(row.date) : null,
    snippet: '',
    seen: !!row.seen,
    flagged: !!row.flagged,
    hasAttachments: !!row.hasAttachments,
    syncedAt: new Date(),
  };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!authorize(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: PushSyncBody;
  try {
    body = (await req.json()) as PushSyncBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  const markerId = String(body.markerId ?? '').trim();
  if (!markerId || !ObjectId.isValid(markerId)) {
    return NextResponse.json(
      { ok: false, error: 'A valid markerId is required.' },
      { status: 400 },
    );
  }

  try {
    const { db } = await connectToDatabase();
    // Ensure the message-store unique key {workspaceId,accountId,provider,
    // providerMessageId} is indexed so concurrent hydrations upsert idempotently
    // (best-effort; swallows errors if it already exists).
    await ensureMessageStoreIndexes(db);

    // 1. Load the marker.
    const marker = (await db
      .collection(SABMAIL_COLLECTIONS.events)
      .findOne({ _id: new ObjectId(markerId) })) as PushMarkerDoc | null;

    if (!marker) {
      return NextResponse.json({ ok: false, error: 'Marker not found.' }, { status: 404 });
    }
    if (marker.event !== 'gmail_push' && marker.event !== 'graph_push') {
      return NextResponse.json(
        { ok: false, error: `Unsupported marker event: ${marker.event ?? 'unknown'}` },
        { status: 400 },
      );
    }

    // 2. Resolve the owning account by the same key the push route used.
    const accountsCol = db.collection<SabmailAccount>(SABMAIL_COLLECTIONS.accounts);
    let account: SabmailAccount | null = null;

    if (marker.event === 'gmail_push') {
      const email = String(marker.emailAddress ?? '').toLowerCase();
      if (email) {
        account = await accountsCol.findOne({ provider: 'gmail', email });
      }
    } else {
      const subscriptionId = marker.subscriptionId ?? null;
      if (subscriptionId) {
        account = await accountsCol.findOne({
          provider: 'outlook',
          // graphSubscriptionId is an account-doc field set when the Graph
          // subscription is created (open shape — not on the typed interface).
          graphSubscriptionId: subscriptionId,
        } as Record<string, unknown>);
      }
    }

    if (!account) {
      return NextResponse.json(
        { ok: false, error: 'No mailbox account matched this marker.' },
        { status: 404 },
      );
    }

    // Prefer the account's workspace; fall back to the marker's stamped value.
    const workspaceId = String(account.workspaceId || marker.workspaceId || '').trim();
    if (!workspaceId) {
      return NextResponse.json(
        { ok: false, error: 'Could not resolve a workspace for this marker.' },
        { status: 422 },
      );
    }

    // 3. Build context + resolve the adapter, then hydrate the INBOX head page.
    const ctx = await buildProviderContext(workspaceId, account);
    const provider = await getMailProvider(account);
    if (!provider) {
      return NextResponse.json(
        {
          ok: false,
          error: `No provider adapter available for '${account.provider}'.`,
        },
        { status: 501 },
      );
    }

    const folder = inboxFolderFor(account.provider);
    const { messages } = await provider.listMessages(ctx, folder, 0, HYDRATE_PAGE_SIZE);

    const accountId = ctx.accountId || (account._id ? String(account._id) : '');
    let hydrated = 0;
    for (const row of messages) {
      try {
        await upsertPersistedMessage(
          db,
          rowToPersisted(workspaceId, accountId, provider.id, folder, row),
        );
        hydrated += 1;
      } catch {
        // One bad row must not abort the whole page — keep going.
      }
    }

    return NextResponse.json({ ok: true, hydrated });
  } catch (e) {
    // Adapter missing / no live OAuth / decrypt failure all land here. We do NOT
    // 5xx-storm the worker: a clean { ok:false } lets it leave the marker for a
    // later retry (it does not stamp consumedAt on a non-ok response).
    return NextResponse.json({ ok: false, error: getErrorMessage(e) }, { status: 200 });
  }
}
