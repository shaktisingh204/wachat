'use server';

/**
 * SabBigin email — wired to the **SabMail** module.
 *
 * Sending: delivers through the platform transport (`dispatchTransactionalEmail`,
 * the real nodemailer path that SabMail's transport will unify on) AND records
 * the sent message into SabMail (`sendMailMessage`) when the tenant has a
 * SabMail account, so it threads in the unified inbox. Every send is also
 * logged as a `crm_activities` Email row linked to the contact/deal.
 */

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { dispatchTransactionalEmail } from '@/lib/email-dispatcher';
import { listMailAccounts, sendMailMessage } from '@/app/actions/mailbox.actions';
import type { OutboundMailEnvelope } from '@/lib/mailbox/imail-transport';

export interface SabbiginMailAccount {
  connected: boolean;
  accountId?: string;
  address?: string;
  displayName?: string;
}

/** First active SabMail account for the tenant (the "from" identity). */
export async function getSabbiginMailAccount(): Promise<SabbiginMailAccount> {
  try {
    const accounts = await listMailAccounts({ status: 'active', limit: 1 });
    const a = accounts[0];
    if (!a) return { connected: false };
    return {
      connected: true,
      accountId: a._id,
      address: a.emailAddress ?? `${a.localPart}`,
      displayName: a.displayName,
    };
  } catch {
    return { connected: false };
  }
}

export interface SendSabbiginEmailInput {
  to: string;
  subject: string;
  body: string; // HTML or plain text
  contactId?: string;
  dealId?: string;
}

export async function sendSabbiginEmail(
  input: SendSabbiginEmailInput,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Access denied' };
  const to = input.to.trim();
  if (!to) return { success: false, error: 'A recipient is required' };
  if (!input.subject.trim()) return { success: false, error: 'A subject is required' };

  const html = /<[a-z][\s\S]*>/i.test(input.body)
    ? input.body
    : `<div style="font-family:system-ui,sans-serif;white-space:pre-wrap">${input.body}</div>`;

  // 1. deliver via the real platform transport
  const delivery = await dispatchTransactionalEmail({
    tenantUserId: String(session.user._id),
    to,
    subject: input.subject,
    html,
    body: input.body,
  });

  // 2. record into SabMail (best-effort) for unified threading
  const account = await getSabbiginMailAccount();
  if (account.connected && account.accountId && account.address) {
    try {
      const envelope: OutboundMailEnvelope = {
        accountId: account.accountId,
        from: { email: account.address, name: account.displayName },
        to: [{ email: to }],
        subject: input.subject,
        html,
        text: input.body,
      };
      await sendMailMessage(envelope);
    } catch {
      /* SabMail recording is best-effort */
    }
  }

  // 3. log a CRM activity linked to the contact/deal
  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id);
    let contactId = input.contactId;
    if (!contactId) {
      const contact = await db
        .collection('crm_contacts')
        .findOne({ userId, email: to.toLowerCase() }, { projection: { _id: 1 } });
      if (contact) contactId = String(contact._id);
    }
    await db.collection('crm_activities').insertOne({
      userId,
      type: 'email',
      typeLabel: 'Email',
      direction: 'out',
      subject: input.subject,
      title: input.subject,
      status: 'completed',
      notes: input.body,
      contactId: contactId ?? null,
      dealId: input.dealId ?? null,
      toAddress: to,
      messageId: delivery.messageId ?? null,
      createdAt: new Date(),
    });
  } catch {
    /* activity log is best-effort */
  }

  if (input.contactId)
    revalidatePath(`/dashboard/sabbigin/contacts/${input.contactId}`);
  if (input.dealId) revalidatePath(`/dashboard/sabbigin/deals/${input.dealId}`);

  if (!delivery.ok) {
    return {
      success: false,
      error:
        delivery.error === 'send_failed'
          ? 'Email could not be delivered. Check your email settings.'
          : delivery.error ?? 'Send failed',
    };
  }
  return { success: true, messageId: delivery.messageId };
}
