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
import type { LineageRef } from '@/lib/definitions';
import { appendLineage, buildLineageFromParent } from '@/lib/lineage';
import { applyCustomFieldsToEntity } from '@/app/actions/worksuite/meta.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { isDateBefore } from '@/lib/form-validation';
import { requirePermission } from '@/lib/rbac-server';
import { crmTicketsApi } from '@/lib/rust-client/crm-tickets';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
  return process.env.USE_RUST_CRM === 'true';
}

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
    if (isDateBefore(data, 'startDate', 'endDate')) {
      return { error: 'End date cannot be before start date.' };
    }
    if (isDateBefore(data, 'startDate', 'dueDate')) {
      return { error: 'Due date cannot be before start date.' };
    }
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
  const user = await requireSession();
  if (!user) return { error: 'Access denied' };

  const editingId = (formData.get('_id') as string | null) || '';
  const guard = await requirePermission('crm_ticket', editingId ? 'edit' : 'create');
  if (!guard.ok) return { error: guard.error };

  if (useRustCrm()) {
    try {
      const subject = (formData.get('title') as string | null) || (formData.get('subject') as string | null) || '';
      const requesterId = (formData.get('clientId') as string | null) || (formData.get('requesterId') as string | null) || '';
      const channel = (formData.get('channel') as string | null) || 'web';
      const severity = (formData.get('severity') as string | null) || 'low';

      if (!subject) {
        return { error: 'Ticket subject is required.' };
      }
      if (!requesterId) {
        return { error: 'Requester is required.' };
      }

      const assigneeId = (formData.get('assigneeId') as string | null) || undefined;
      const category = (formData.get('category') as string | null) || (formData.get('categoryId') as string | null) || undefined;
      const priority = (formData.get('priority') as string | null) || undefined;
      const dueByRaw = (formData.get('dueBy') as string | null) || (formData.get('dueAt') as string | null) || undefined;
      const status = (formData.get('status') as string | null) || undefined;

      let id: string;
      if (editingId) {
        const patch: Record<string, unknown> = {};
        if (subject) patch.subject = subject;
        if (channel) patch.channel = channel;
        if (severity) patch.severity = severity;
        if (assigneeId) patch.assigneeId = assigneeId;
        if (category) patch.category = category;
        if (priority) patch.priority = priority;
        if (dueByRaw) patch.dueBy = new Date(dueByRaw).toISOString();
        if (status) patch.status = status;
        const updated = await crmTicketsApi.update(editingId, patch);
        id = String(updated._id ?? editingId);
      } else {
        const created = await crmTicketsApi.create({
          subject,
          requesterId,
          channel,
          severity,
          ...(assigneeId ? { assigneeId } : {}),
          ...(category ? { category } : {}),
          ...(priority ? { priority } : {}),
          ...(dueByRaw ? { dueBy: new Date(dueByRaw).toISOString() } : {}),
          ...(status ? { status } : {}),
        });
        id = String(created._id ?? '');
      }

      // Persist custom-field values for `entity=ticket` (best-effort).
      if (id) {
        const raw = formData.get('customFields');
        if (typeof raw === 'string' && raw.length > 0 && raw !== '{}') {
          try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
              await applyCustomFieldsToEntity('ticket', id, parsed);
            }
          } catch (e) {
            console.error('[saveTicket] customFields parse failed:', e);
          }
        }

        try {
          await writeAuditEntry({
            tenantUserId: user._id,
            actorId: user._id,
            action: editingId ? 'update' : 'create',
            entityKind: 'ticket',
            entityId: id,
          });
        } catch {
          /* non-fatal */
        }
      }

      revalidatePath('/dashboard/crm/tickets');
      return { message: 'Saved successfully.', id };
    } catch (e) {
      if (e instanceof RustApiError) {
        console.error('[saveTicket] rust path failed; falling back:', e);
      } else {
        console.error('[saveTicket] rust path failed; falling back:', e);
      }
      // fall through
    }
  }

  const result = await save('crm_tickets', '/dashboard/crm/tickets', formData, {
    idFields: ['clientId', 'assigneeId', 'categoryId'],
    dateFields: ['firstResponseAt', 'resolvedAt'],
  });

  // Persist custom-field values for `entity=ticket`. Best-effort —
  // if the field bag is malformed we still report the ticket save
  // succeeded so the user doesn't get a misleading error.
  if (result.id) {
    const raw = formData.get('customFields');
    if (typeof raw === 'string' && raw.length > 0 && raw !== '{}') {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          await applyCustomFieldsToEntity('ticket', result.id, parsed);
        }
      } catch (e) {
        console.error('[saveTicket] customFields parse failed:', e);
      }
    }

    // §12.21 audit trail.
    try {
      await writeAuditEntry({
        tenantUserId: user._id,
        actorId: user._id,
        action: editingId ? 'update' : 'create',
        entityKind: 'ticket',
        entityId: result.id,
      });
    } catch {
      /* non-fatal */
    }
  }

  return result;
}
export async function updateTicketStatus(
  id: string,
  status: HrTicket['status'],
): Promise<{ success: boolean; error?: string }> {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };

  const guard = await requirePermission('crm_ticket', 'edit');
  if (!guard.ok) return { success: false, error: guard.error };

  if (useRustCrm()) {
    try {
      await crmTicketsApi.update(id, { status });
      try {
        await writeAuditEntry({
          tenantUserId: user._id,
          actorId: user._id,
          action: 'status_change',
          entityKind: 'ticket',
          entityId: id,
        });
      } catch {
        /* non-fatal */
      }
      revalidatePath('/dashboard/crm/tickets');
      return { success: true };
    } catch (e) {
      console.error('[updateTicketStatus] rust path failed; falling back:', e);
      // fall through
    }
  }

  if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid id' };
  const { db } = await connectToDatabase();
  const update: Record<string, any> = { status, updatedAt: new Date() };
  if (status === 'resolved' || status === 'closed') update.resolvedAt = new Date();
  await db.collection('crm_tickets').updateOne(
    { _id: new ObjectId(id), userId: new ObjectId(user._id) },
    { $set: update },
  );

  try {
    await writeAuditEntry({
      tenantUserId: user._id,
      actorId: user._id,
      action: 'status_change',
      entityKind: 'ticket',
      entityId: id,
    });
  } catch {
    /* non-fatal */
  }

  revalidatePath('/dashboard/crm/tickets');
  return { success: true };
}
export async function deleteTicket(id: string) {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };

  const guard = await requirePermission('crm_ticket', 'delete');
  if (!guard.ok) return { success: false, error: guard.error };

  if (useRustCrm()) {
    try {
      await crmTicketsApi.delete(id);
      try {
        await writeAuditEntry({
          tenantUserId: user._id,
          actorId: user._id,
          action: 'delete',
          entityKind: 'ticket',
          entityId: id,
        });
      } catch {
        /* non-fatal */
      }
      revalidatePath('/dashboard/crm/tickets');
      return { success: true };
    } catch (e) {
      console.error('[deleteTicket] rust path failed; falling back:', e);
      // fall through
    }
  }

  const r = await hrDelete('crm_tickets', id);
  if (r.success) {
    try {
      await writeAuditEntry({
        tenantUserId: user._id,
        actorId: user._id,
        action: 'delete',
        entityKind: 'ticket',
        entityId: id,
      });
    } catch {
      /* non-fatal */
    }
  }
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

  // Build lineage for the new credit note from the parent invoice's
  // chain, plus the invoice itself. See crm_function_plan.md §13.5.
  const newLineage = buildLineageFromParent({
    kind: 'invoice',
    id: invoice._id.toString(),
    no: invoice.invoiceNumber || undefined,
    status: invoice.status || undefined,
    lineage: (invoice.lineage as LineageRef[] | undefined) ?? undefined,
  });

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
    lineage: newLineage,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const res = await db.collection('crm_credit_notes').insertOne(creditNote as any);

  // Best-effort back-reference: push the new credit note onto the
  // parent invoice's lineage so the rail on the invoice's detail
  // page sees the downstream credit note too. Idempotent via
  // appendLineage's (kind,id) dedupe.
  try {
    const updatedInvoiceLineage = appendLineage(invoice.lineage as LineageRef[] | undefined, {
      kind: 'creditNote',
      id: res.insertedId.toString(),
      no: undefined,
      status: 'draft',
      createdAt: new Date().toISOString(),
    });
    await db.collection('crm_invoices').updateOne(
      { _id: invoice._id },
      { $set: { lineage: updatedInvoiceLineage, updatedAt: new Date() } },
    );
  } catch {
    // Non-fatal — the conversion already succeeded.
  }

  revalidatePath('/dashboard/crm/sales/credit-notes');
  revalidatePath('/dashboard/crm/sales/invoices');
  return { success: true, creditNoteId: res.insertedId.toString() };
}
