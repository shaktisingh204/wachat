'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import {
  hrList,
  hrGetById,
  hrSave,
  hrDelete,
  formToObject,
  requireSession,
} from '@/lib/hr-crud';
import type {
  HrProject,
  HrProjectTask,
  HrContract,
  HrTicket,
} from '@/lib/hr-types';

type FormState = { message?: string; error?: string; id?: string };

async function save(
  collection: string,
  revalidate: string,
  formData: FormData,
  opts: {
    idFields?: string[];
    dateFields?: string[];
    numericKeys?: string[];
  } = {},
): Promise<FormState> {
  try {
    const data = formToObject(formData, opts.numericKeys || []);
    const res = await hrSave(collection, data, {
      idFields: opts.idFields,
      dateFields: opts.dateFields,
    });
    if (res.error) return { error: res.error };
    revalidatePath(revalidate);
    return { message: 'Saved successfully.', id: res.id };
  } catch (e: any) {
    return { error: e?.message || 'Failed to save' };
  }
}

/* ── Projects ─────────────────────────────────────────────────── */

export async function getProjects() {
  return hrList<HrProject>('crm_projects', { sortBy: { createdAt: -1 } });
}
export async function getProjectById(id: string) {
  return hrGetById<HrProject>('crm_projects', id);
}
export async function saveProject(_prev: any, formData: FormData) {
  return save('crm_projects', '/dashboard/crm/projects', formData, {
    idFields: ['clientId'],
    dateFields: ['startDate', 'endDate'],
    numericKeys: ['progress', 'budget'],
  });
}
export async function deleteProject(id: string) {
  const r = await hrDelete('crm_projects', id);
  revalidatePath('/dashboard/crm/projects');
  return r;
}

/* ── Project Tasks ────────────────────────────────────────────── */

export async function getProjectTasks(projectId?: string) {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();
  const filter: Record<string, any> = { userId: new ObjectId(user._id) };
  if (projectId && ObjectId.isValid(projectId)) {
    filter.projectId = new ObjectId(projectId);
  }
  const docs = await db
    .collection('crm_project_tasks')
    .find(filter)
    .sort({ createdAt: -1 })
    .toArray();
  return JSON.parse(JSON.stringify(docs)) as (HrProjectTask & { _id: string })[];
}

export async function saveProjectTask(_prev: any, formData: FormData) {
  return save('crm_project_tasks', '/dashboard/crm/projects/kanban', formData, {
    idFields: ['projectId'],
    dateFields: ['startDate', 'dueDate'],
    numericKeys: ['estimatedHours', 'actualHours'],
  });
}

export async function updateProjectTaskStatus(
  id: string,
  status: HrProjectTask['status'],
): Promise<{ success: boolean; error?: string }> {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid id' };
  const { db } = await connectToDatabase();
  await db.collection('crm_project_tasks').updateOne(
    { _id: new ObjectId(id), userId: new ObjectId(user._id) },
    { $set: { status, updatedAt: new Date() } },
  );
  revalidatePath('/dashboard/crm/projects/kanban');
  revalidatePath('/dashboard/crm/projects');
  return { success: true };
}

export async function deleteProjectTask(id: string) {
  const r = await hrDelete('crm_project_tasks', id);
  revalidatePath('/dashboard/crm/projects/kanban');
  revalidatePath('/dashboard/crm/projects');
  return r;
}

/* ── Contracts ────────────────────────────────────────────────── */

export async function getContracts() {
  return hrList<HrContract>('crm_contracts');
}
export async function getContractById(id: string) {
  return hrGetById<HrContract>('crm_contracts', id);
}
export async function saveContract(_prev: any, formData: FormData) {
  return save('crm_contracts', '/dashboard/crm/contracts', formData, {
    idFields: ['clientId'],
    dateFields: ['startDate', 'endDate', 'signedAt'],
    numericKeys: ['value'],
  });
}
export async function deleteContract(id: string) {
  const r = await hrDelete('crm_contracts', id);
  revalidatePath('/dashboard/crm/contracts');
  return r;
}

export async function signContract(
  contractId: string,
  payload: { signedByName: string; signedByEmail: string; signatureDataUrl: string },
): Promise<{ success: boolean; error?: string }> {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(contractId)) return { success: false, error: 'Invalid contract' };
  if (!payload.signatureDataUrl) return { success: false, error: 'Signature is required' };
  const { db } = await connectToDatabase();
  await db.collection('crm_contracts').updateOne(
    { _id: new ObjectId(contractId), userId: new ObjectId(user._id) },
    {
      $set: {
        status: 'signed',
        signedAt: new Date(),
        signedByName: payload.signedByName,
        signedByEmail: payload.signedByEmail,
        signatureDataUrl: payload.signatureDataUrl,
        updatedAt: new Date(),
      },
    },
  );
  revalidatePath(`/dashboard/crm/contracts/${contractId}`);
  revalidatePath('/dashboard/crm/contracts');
  return { success: true };
}

/* ── Tickets ──────────────────────────────────────────────────── */

export async function getTickets() {
  return hrList<HrTicket>('crm_tickets');
}
export async function getTicketById(id: string) {
  return hrGetById<HrTicket>('crm_tickets', id);
}
export async function saveTicket(_prev: any, formData: FormData) {
  return save('crm_tickets', '/dashboard/crm/tickets', formData, {
    idFields: ['clientId'],
    dateFields: ['firstResponseAt', 'resolvedAt'],
  });
}
export async function updateTicketStatus(
  id: string,
  status: HrTicket['status'],
): Promise<{ success: boolean; error?: string }> {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid id' };
  const { db } = await connectToDatabase();
  const update: Record<string, any> = { status, updatedAt: new Date() };
  if (status === 'resolved' || status === 'closed') update.resolvedAt = new Date();
  await db.collection('crm_tickets').updateOne(
    { _id: new ObjectId(id), userId: new ObjectId(user._id) },
    { $set: update },
  );
  revalidatePath('/dashboard/crm/tickets');
  return { success: true };
}
export async function deleteTicket(id: string) {
  const r = await hrDelete('crm_tickets', id);
  revalidatePath('/dashboard/crm/tickets');
  return r;
}

/* ── Invoice → Credit Note conversion ────────────────────────── */

/**
 * Clone an invoice into a new credit note. The credit note starts
 * in draft with the invoice's line items and client reference so
 * the user only needs to confirm and save. The original invoice is
 * left untouched.
 */
export async function convertInvoiceToCreditNote(
  invoiceId: string,
): Promise<{ success: boolean; creditNoteId?: string; error?: string }> {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(invoiceId)) return { success: false, error: 'Invalid invoice id' };
  const { db } = await connectToDatabase();

  const invoice = await db.collection('crm_invoices').findOne({
    _id: new ObjectId(invoiceId),
    userId: new ObjectId(user._id),
  });
  if (!invoice) return { success: false, error: 'Invoice not found' };

  const lineItems = (invoice.lineItems || []).map((li: any) => ({
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: li.name || li.description || '',
    description: li.description || '',
    quantity: li.quantity || 0,
    rate: li.rate || 0,
  }));

  const creditNote = {
    userId: new ObjectId(user._id),
    accountId: invoice.accountId,
    creditNoteDate: new Date(),
    originalInvoiceNumber: invoice.invoiceNumber || '',
    originalInvoiceId: invoice._id,
    currency: invoice.currency || 'INR',
    lineItems,
    reason: 'Converted from invoice',
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const res = await db.collection('crm_credit_notes').insertOne(creditNote as any);
  revalidatePath('/dashboard/crm/sales/credit-notes');
  revalidatePath('/dashboard/crm/sales/invoices');
  return { success: true, creditNoteId: res.insertedId.toString() };
}
