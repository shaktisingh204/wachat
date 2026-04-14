'use server';

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import { requireSession } from '@/lib/hr-crud';

/**
 * Cross-entity conversion actions — ported from the collection of
 * `convertToX` controllers and service actions scattered across
 * Worksuite PHP. Each helper reads a source resource, creates a
 * denormalized target resource, and where relevant flips the
 * source's lifecycle stage to `converted`.
 *
 * All operations are tenant-scoped via the authenticated session.
 */

type Result<T> = { success: boolean; error?: string } & Partial<T>;

/* ─────────────────────────────────────────────────────────────
 *  Lead → Account
 * ──────────────────────────────────────────────────────────── */

export async function convertLeadToAccount(
  leadId: string,
): Promise<Result<{ accountId: string }>> {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(leadId)) {
    return { success: false, error: 'Invalid lead id' };
  }

  const { db } = await connectToDatabase();
  const userId = new ObjectId(user._id);
  const _id = new ObjectId(leadId);

  const lead = await db.collection('crm_leads').findOne({ _id, userId });
  if (!lead) return { success: false, error: 'Lead not found' };

  const now = new Date();
  const accountDoc = {
    userId,
    name:
      (lead as any).company ||
      (lead as any).title ||
      (lead as any).contactName ||
      'Untitled Account',
    industry: (lead as any).industry || '',
    website: (lead as any).website || '',
    phone: (lead as any).phone || '',
    country: (lead as any).country || '',
    currency: (lead as any).currency || 'INR',
    status: 'active',
    category: 'new',
    contactIds: [] as ObjectId[],
    dealIds: [] as ObjectId[],
    createdAt: now,
    updatedAt: now,
    sourceLeadId: _id,
  };

  const accountRes = await db.collection('crm_accounts').insertOne(accountDoc);
  const accountId = accountRes.insertedId;

  // Link any contacts that carry the same email as the lead.
  const leadEmail = (lead as any).email;
  if (leadEmail) {
    const contacts = await db
      .collection('crm_contacts')
      .find({ userId, email: leadEmail })
      .toArray();
    if (contacts.length > 0) {
      const contactIds = contacts.map((c) => c._id as ObjectId);
      await db
        .collection('crm_contacts')
        .updateMany(
          { userId, _id: { $in: contactIds } },
          { $set: { accountId, updatedAt: now } },
        );
      await db
        .collection('crm_accounts')
        .updateOne({ _id: accountId, userId }, { $set: { contactIds } });
    }
  }

  // Flip lead stage → converted.
  await db.collection('crm_leads').updateOne(
    { _id, userId },
    {
      $set: {
        stage: 'converted',
        status: 'Converted',
        convertedAccountId: accountId,
        updatedAt: now,
      },
    },
  );

  revalidatePath('/dashboard/crm/accounts');
  revalidatePath('/dashboard/crm/sales-crm/all-leads');
  return { success: true, accountId: accountId.toString() };
}

/* ─────────────────────────────────────────────────────────────
 *  Lead → Contact
 * ──────────────────────────────────────────────────────────── */

export async function convertLeadToContact(
  leadId: string,
): Promise<Result<{ contactId: string }>> {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(leadId)) {
    return { success: false, error: 'Invalid lead id' };
  }

  const { db } = await connectToDatabase();
  const userId = new ObjectId(user._id);
  const _id = new ObjectId(leadId);

  const lead = await db.collection('crm_leads').findOne({ _id, userId });
  if (!lead) return { success: false, error: 'Lead not found' };

  const now = new Date();
  const contactDoc = {
    userId,
    name:
      (lead as any).contactName ||
      (lead as any).title ||
      'Unnamed Contact',
    email: (lead as any).email || '',
    phone: (lead as any).phone || '',
    company: (lead as any).company || '',
    status: 'contacted',
    leadSource: (lead as any).source || '',
    createdAt: now,
    updatedAt: now,
    sourceLeadId: _id,
  };

  const res = await db.collection('crm_contacts').insertOne(contactDoc);

  await db.collection('crm_leads').updateOne(
    { _id, userId },
    {
      $set: {
        stage: 'converted',
        status: 'Converted',
        convertedContactId: res.insertedId,
        updatedAt: now,
      },
    },
  );

  revalidatePath('/dashboard/crm/contacts');
  revalidatePath('/dashboard/crm/sales-crm/all-leads');
  return { success: true, contactId: res.insertedId.toString() };
}

/* ─────────────────────────────────────────────────────────────
 *  Deal → Invoice
 * ──────────────────────────────────────────────────────────── */

export async function convertDealToInvoice(
  dealId: string,
): Promise<Result<{ invoiceId: string }>> {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(dealId)) {
    return { success: false, error: 'Invalid deal id' };
  }

  const { db } = await connectToDatabase();
  const userId = new ObjectId(user._id);
  const _id = new ObjectId(dealId);

  const deal = await db.collection('crm_deals').findOne({ _id, userId });
  if (!deal) return { success: false, error: 'Deal not found' };

  const now = new Date();
  const value = Number((deal as any).value || 0);
  const currency = (deal as any).currency || 'INR';
  const name = (deal as any).name || 'Deal';

  const invoiceDoc = {
    userId,
    accountId: (deal as any).accountId || null,
    invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
    invoiceDate: now,
    lineItems: [
      {
        id: `item-${Date.now()}`,
        name,
        description: (deal as any).description || '',
        quantity: 1,
        rate: value,
      },
    ],
    termsAndConditions: [] as string[],
    notes: (deal as any).description || '',
    status: 'Draft',
    currency,
    subtotal: value,
    total: value,
    createdAt: now,
    updatedAt: now,
    sourceDealId: _id,
  };

  const res = await db.collection('crm_invoices').insertOne(invoiceDoc);
  revalidatePath('/dashboard/crm/sales/invoices');
  return { success: true, invoiceId: res.insertedId.toString() };
}

/* ─────────────────────────────────────────────────────────────
 *  Proposal → Contract
 * ──────────────────────────────────────────────────────────── */

export async function convertProposalToContract(
  proposalId: string,
): Promise<Result<{ contractId: string }>> {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(proposalId)) {
    return { success: false, error: 'Invalid proposal id' };
  }

  const { db } = await connectToDatabase();
  const userId = new ObjectId(user._id);
  const _id = new ObjectId(proposalId);

  const proposal = await db
    .collection('crm_proposals')
    .findOne({ _id, userId });
  if (!proposal) return { success: false, error: 'Proposal not found' };

  const now = new Date();
  const contractDoc = {
    userId,
    subject: (proposal as any).title || 'Untitled Contract',
    client_id: (proposal as any).client_id || '',
    value: Number((proposal as any).total || 0),
    currency: (proposal as any).currency || 'INR',
    start_date: now,
    description: (proposal as any).note || '',
    signed: false,
    createdAt: now,
    updatedAt: now,
    sourceProposalId: _id,
  };

  const res = await db.collection('crm_contracts').insertOne(contractDoc);
  revalidatePath('/dashboard/crm/contracts');
  revalidatePath('/dashboard/crm/sales/proposals');
  return { success: true, contractId: res.insertedId.toString() };
}

/* ─────────────────────────────────────────────────────────────
 *  Ticket → Task
 * ──────────────────────────────────────────────────────────── */

export async function convertTicketToTask(
  ticketId: string,
  projectId?: string,
): Promise<Result<{ taskId: string }>> {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(ticketId)) {
    return { success: false, error: 'Invalid ticket id' };
  }

  const { db } = await connectToDatabase();
  const userId = new ObjectId(user._id);
  const _id = new ObjectId(ticketId);

  const ticket = await db.collection('crm_tickets').findOne({ _id, userId });
  if (!ticket) return { success: false, error: 'Ticket not found' };

  const priorityRaw = String((ticket as any).priority || 'medium').toLowerCase();
  const priority: 'High' | 'Medium' | 'Low' =
    priorityRaw === 'urgent' || priorityRaw === 'high'
      ? 'High'
      : priorityRaw === 'low'
        ? 'Low'
        : 'Medium';

  const now = new Date();
  const taskDoc: Record<string, unknown> = {
    userId,
    title: (ticket as any).subject || 'Task from ticket',
    description: (ticket as any).description || '',
    status: 'To-Do',
    priority,
    type: 'Follow-up',
    createdAt: now,
    updatedAt: now,
    sourceTicketId: _id,
  };
  if (projectId && ObjectId.isValid(projectId)) {
    taskDoc.projectId = new ObjectId(projectId);
  }

  const res = await db.collection('crm_tasks').insertOne(taskDoc);
  revalidatePath('/dashboard/crm/tasks');
  revalidatePath('/dashboard/crm/tickets');
  return { success: true, taskId: res.insertedId.toString() };
}
