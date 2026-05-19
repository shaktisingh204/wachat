import 'server-only';

import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { findTenantByTicketInbox } from './module-connections.server';

/**
 * Ingest an inbound email into the CRM as a ticket, honoring the
 * ticket-email connection set by the tenant under
 * `/dashboard/crm/settings/integrations/ticket-email`.
 *
 * Wire this from whichever inbound-email handler the Email module
 * uses — pass the parsed envelope and we'll create the ticket if a
 * tenant is bound to the recipient address and `autoCreateTicket` is on.
 *
 * Returns `{ created: boolean, ticketId?, skipped?, reason? }` so the
 * caller can decide whether to still archive the message elsewhere.
 */
export interface IncomingEmail {
  to: string;
  from: string;
  fromName?: string;
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  messageId?: string;
  receivedAt?: Date;
}

export async function ingestTicketEmail(email: IncomingEmail): Promise<{
  created: boolean;
  ticketId?: string;
  skipped?: boolean;
  reason?: string;
}> {
  const recipient = email.to.toLowerCase().trim();
  const match = await findTenantByTicketInbox(recipient);
  if (!match) {
    return { created: false, skipped: true, reason: 'no-binding' };
  }
  if (!match.binding.autoCreateTicket) {
    return { created: false, skipped: true, reason: 'auto-create-off' };
  }

  const { db } = await connectToDatabase();
  const now = email.receivedAt ?? new Date();

  // Deduplicate by Message-ID so a retry doesn't double-create.
  if (email.messageId) {
    const existing = await db.collection('crm_tickets').findOne({
      userId: new ObjectId(match.userId),
      'source.messageId': email.messageId,
    });
    if (existing) {
      return {
        created: false,
        skipped: true,
        reason: 'duplicate',
        ticketId: String(existing._id),
      };
    }
  }

  const doc = {
    userId: new ObjectId(match.userId),
    subject: email.subject || '(no subject)',
    description: email.bodyHtml || email.bodyText || '',
    requester: {
      name: email.fromName ?? email.from,
      email: email.from,
    },
    category: match.binding.defaultCategory || 'Inbound email',
    assignee: match.binding.defaultAssignee || null,
    status: 'open',
    priority: 'normal',
    source: {
      channel: 'email',
      inboxAddress: match.binding.inboxAddress,
      messageId: email.messageId,
    },
    createdAt: now,
    updatedAt: now,
  };

  const res = await db.collection('crm_tickets').insertOne(doc);
  return { created: true, ticketId: String(res.insertedId) };
}
