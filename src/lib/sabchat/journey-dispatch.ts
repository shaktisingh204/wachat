import 'server-only';

import { rustClient } from '@/lib/rust-client';

/**
 * Drain pending journey outbox items for the **ambient** Rust tenant — the
 * caller must already be inside `runWithRustTenant`/`runWithRustTenantAs`.
 *
 * This is the journeys → channel delivery dispatcher. v1 delivers the `chat`
 * channel in-app: for each pending `chat` outbox row it find-or-creates the
 * contact's conversation in the project's first inbox and appends the message
 * as a `bot` sender (which publishes `message.created` on the WS hub, so it
 * lands live in the agent inbox + the visitor widget), then marks the row sent.
 *
 * Other channels (email / sms / push) are left pending — their delivery is the
 * SabMail / SabSMS bridge seam — and reported as `skipped`.
 */
export async function deliverChatOutbox(): Promise<{
  delivered: number;
  skipped: number;
  failed: number;
}> {
  let delivered = 0;
  let skipped = 0;
  let failed = 0;

  const inboxes = await rustClient.sabchat.inboxes.list({}).catch(() => ({ items: [] as { _id: string }[] }));
  const inboxId = inboxes.items[0]?._id;

  const { items } = await rustClient.sabchatJourneys
    .listOutbox()
    .catch(() => ({ items: [] as { _id: string; channel: string; text: string; contactId?: string }[] }));

  for (const it of items) {
    if (it.channel !== 'chat' || !it.contactId || !inboxId) {
      skipped += 1;
      continue;
    }
    try {
      // find-or-create the contact's open conversation in the default inbox
      const conv = await rustClient.sabchat.conversations.create({
        inboxId,
        contactId: it.contactId,
      });
      await rustClient.sabchat.messages.append({
        conversationId: conv._id,
        content: { kind: 'text', text: it.text },
        senderType: 'bot',
      });
      await rustClient.sabchatJourneys.markOutboxSent(it._id);
      delivered += 1;
    } catch {
      failed += 1;
    }
  }

  return { delivered, skipped, failed };
}
