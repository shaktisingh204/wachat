import 'server-only';

import nodemailer from 'nodemailer';

import { rustClient } from '@/lib/rust-client';

/**
 * Deliver a journey `email` step via the platform's transactional SMTP
 * (`SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` — the same creds
 * SabFlow uses). Resolves the contact's first email and sends the step text.
 * Returns `true` on a real send, `false` when SMTP or the email is missing
 * (the caller then marks the row skipped rather than sent).
 */
async function sendJourneyEmail(contactId: string | undefined, text: string): Promise<boolean> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !contactId) return false;
  let to = '';
  try {
    const contact = await rustClient.sabchat.contacts.get(contactId);
    to = contact.emails?.[0] ?? '';
  } catch {
    return false;
  }
  if (!to) return false;
  try {
    const port = Number(process.env.SMTP_PORT) || 587;
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    await transporter.sendMail({ from: user, to, subject: 'You have a new message', text });
    return true;
  } catch {
    return false;
  }
}

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
 * `email` is delivered for real via the platform SMTP relay. `sms` / `push`
 * have no adapter yet (the SabSMS bridge needs a per-project sender) — they're
 * marked `skipped` (terminal) so they don't starve the deliverable queue.
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
    // Email — deliver for real via the platform SMTP relay.
    if (it.channel === 'email') {
      const sent = await sendJourneyEmail(it.contactId, it.text);
      if (sent) {
        await rustClient.sabchatJourneys.markOutboxSent(it._id).catch(() => {});
        delivered += 1;
      } else {
        await rustClient.sabchatJourneys.markOutboxSkipped(it._id).catch(() => {});
        skipped += 1;
      }
      continue;
    }
    // sms / push have no adapter yet — mark terminal so chat isn't starved.
    if (it.channel !== 'chat') {
      await rustClient.sabchatJourneys.markOutboxSkipped(it._id).catch(() => {});
      skipped += 1;
      continue;
    }
    if (!it.contactId || !inboxId) {
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

/**
 * Drain due **scheduled messages** (send-later) for the ambient Rust tenant.
 * For each pending row whose `sendAt` has passed, append the text to its
 * conversation as a `bot` sender (publishes on the WS hub) and mark it sent.
 */
export async function deliverScheduledMessages(): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  const { scheduled } = await rustClient.sabchatCollab
    .listDueScheduled()
    .catch(() => ({ scheduled: [] as { _id: string; conversationId: string; text: string }[] }));

  for (const m of scheduled) {
    try {
      await rustClient.sabchat.messages.append({
        conversationId: m.conversationId,
        content: { kind: 'text', text: m.text },
        senderType: 'bot',
      });
      await rustClient.sabchatCollab.markScheduledSent(m._id);
      sent += 1;
    } catch {
      failed += 1;
    }
  }

  return { sent, failed };
}
