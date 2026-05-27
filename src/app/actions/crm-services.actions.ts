'use server';

import { revalidatePath } from 'next/cache';
import { cache } from 'react';
import { ObjectId } from 'mongodb';
import crypto from 'node:crypto';
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
import { crmProjectTasksApi } from '@/lib/rust-client/crm-project-tasks';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { buildMagicLink, getProvider } from '@/lib/contracts/esign-providers';

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

/**
 * Fetch a single project task document scoped to the current user.
 *
 * Dual-impl: when `USE_RUST_CRM === 'true'`, calls the Rust BFF first
 * and falls back to the legacy Mongo path on error.
 */
export async function getProjectTaskById(id: string) {
  if (!ObjectId.isValid(id)) return null;

  if (useRustCrm()) {
    try {
      const doc = await crmProjectTasksApi.getById(id);
      return JSON.parse(JSON.stringify(doc)) as HrProjectTask & { _id: string };
    } catch (e) {
      console.error('[getProjectTaskById] rust path failed; falling back:', e);
      recordRustFallback({
        entity: 'project_task',
        op: 'get',
        errorCode: e instanceof RustApiError ? e.code : undefined,
        status: e instanceof RustApiError ? e.status : undefined,
      });
    }
  }

  return hrGetById<HrProjectTask>('crm_project_tasks', id);
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
export const getContractById = cache(async function getContractById(id: string) {
  return hrGetById<HrContract>('crm_contracts', id);
});
export async function saveContract(_prev: any, formData: FormData) {
  return save('crm_contracts', '/dashboard/crm/contracts', formData, {
    idFields: ['clientId'],
    dateFields: ['startDate', 'endDate', 'signedAt'],
    numericKeys: ['value'],
  });
}

/**
 * Richer contract update path used by the full-page edit form. Accepts
 * the same scalar fields as `saveContract` plus JSON-encoded
 * `attachmentsJson` (SabFiles node ids + names) and `signersJson`
 * (counter-party recipients). Falls through to a Mongo `$set` so
 * arrays survive the round trip (`formToObject` would otherwise drop
 * them to a single string).
 */
export async function updateContractWithDetails(
  _prev: any,
  formData: FormData,
): Promise<FormState> {
  const user = await requireSession();
  if (!user) return { error: 'Access denied.' };

  const guard = await requirePermission('crm_contract', 'edit');
  if (!guard.ok) return { error: guard.error };

  const id = (formData.get('_id') as string | null) ?? '';
  if (!id || !ObjectId.isValid(id)) return { error: 'Invalid contract id.' };

  const title = ((formData.get('title') as string | null) ?? '').trim();
  if (!title) return { error: 'Title is required.' };

  const status = (formData.get('status') as string | null) ?? 'draft';
  const clientId = (formData.get('clientId') as string | null) ?? '';
  const clientName = (formData.get('clientName') as string | null) ?? '';
  const currency = (formData.get('currency') as string | null) ?? 'INR';
  const value = formData.get('value');
  const startDate = (formData.get('startDate') as string | null) ?? '';
  const endDate = (formData.get('endDate') as string | null) ?? '';
  const body = (formData.get('body') as string | null) ?? '';
  const notes = (formData.get('notes') as string | null) ?? '';
  const autoRenew = formData.get('autoRenew') === 'on';
  const renewalNoticeDaysRaw = formData.get('renewalNoticeDays');
  const esignProvider =
    (formData.get('esignProvider') as string | null) ?? 'internal';
  const attachmentsJson =
    (formData.get('attachmentsJson') as string | null) ?? '[]';
  const signersJson = (formData.get('signersJson') as string | null) ?? '[]';

  if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
    return { error: 'End date cannot be before start date.' };
  }

  type AttachmentInput = { id?: unknown; name?: unknown };
  type SignerInput = {
    name?: unknown;
    email?: unknown;
    role?: unknown;
    order?: unknown;
  };

  let attachments: { id: string; name: string }[] = [];
  let signers: { name?: string; email: string; role?: string; order?: number }[] = [];
  try {
    const parsedAttachments = JSON.parse(attachmentsJson) as unknown;
    if (Array.isArray(parsedAttachments)) {
      attachments = parsedAttachments
        .filter((a: unknown): a is AttachmentInput => Boolean(a) && typeof a === 'object')
        .map((a) => ({
          id: typeof a.id === 'string' ? a.id : '',
          name: typeof a.name === 'string' ? a.name : '',
        }))
        .filter((a) => Boolean(a.id));
    }
    const parsedSigners = JSON.parse(signersJson) as unknown;
    if (Array.isArray(parsedSigners)) {
      signers = parsedSigners
        .filter((s: unknown): s is SignerInput => Boolean(s) && typeof s === 'object')
        .map((s, idx) => ({
          name: typeof s.name === 'string' ? s.name : undefined,
          email: typeof s.email === 'string' ? s.email : '',
          role: typeof s.role === 'string' ? s.role : undefined,
          order: typeof s.order === 'number' ? s.order : idx,
        }))
        .filter((s) => Boolean(s.email));
    }
  } catch {
    return { error: 'Invalid attachments or signers payload.' };
  }

  const $set: Record<string, unknown> = {
    title,
    status,
    currency,
    body,
    notes,
    autoRenew,
    esignProvider,
    attachments: attachments.map((a) => a.id),
    attachmentNames: attachments.map((a) => a.name),
    signers,
    updatedAt: new Date(),
  };
  if (clientName) $set.clientName = clientName;
  if (clientId && ObjectId.isValid(clientId)) {
    $set.clientId = new ObjectId(clientId);
  }
  if (typeof value === 'string' && value !== '') {
    const v = parseFloat(value);
    if (!isNaN(v)) $set.value = v;
  }
  if (startDate) $set.startDate = new Date(startDate);
  if (endDate) $set.endDate = new Date(endDate);
  if (typeof renewalNoticeDaysRaw === 'string' && renewalNoticeDaysRaw !== '') {
    const days = parseInt(renewalNoticeDaysRaw, 10);
    if (!isNaN(days)) $set.renewalNoticeDays = days;
  }

  try {
    const { db } = await connectToDatabase();
    const result = await db
      .collection('crm_contracts')
      .updateOne(
        { _id: new ObjectId(id), userId: new ObjectId(user._id as string) },
        { $set },
      );
    if (result.matchedCount === 0) return { error: 'Contract not found.' };

    try {
      await writeAuditEntry({
        tenantUserId: String(user._id),
        actorId: String(user._id),
        action: 'update',
        entityKind: 'contract',
        entityId: id,
      });
    } catch {
      /* non-fatal */
    }

    revalidatePath('/dashboard/crm/contracts');
    revalidatePath(`/dashboard/crm/contracts/${id}`);
    return { message: 'Contract updated successfully.', id };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to update contract.';
    return { error: message };
  }
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
  try {
    await writeAuditEntry({
      tenantUserId: String(user._id),
      actorId: String(user._id),
      action: 'sign',
      entityKind: 'contract',
      entityId: contractId,
      reason: payload.signedByName,
    });
  } catch { /* non-fatal */ }
  revalidatePath(`/dashboard/crm/contracts/${contractId}`);
  revalidatePath('/dashboard/crm/contracts');
  return { success: true };
}

/** Mark a contract `sent` and record the signers list in `signers[]`. */
export async function sendContractForSignature(
  contractId: string,
  signers: Array<{ name: string; email: string; role?: string }>,
): Promise<{
  success: boolean;
  error?: string;
  delivered?: number;
  failed?: Array<{ email: string; error: string }>;
}> {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(contractId)) return { success: false, error: 'Invalid contract' };
  if (!signers.length) return { success: false, error: 'At least one signer is required.' };
  const clean = signers
    .map((s, i) => ({
      name: (s.name || '').trim(),
      email: (s.email || '').trim().toLowerCase(),
      role: (s.role || '').trim() || undefined,
      order: i,
    }))
    .filter((s) => s.email && s.email.includes('@'));
  if (!clean.length) return { success: false, error: 'No valid signers provided.' };

  const { db } = await connectToDatabase();

  // Load the contract once so we can read its title + provider choice
  // before generating tokens.
  const contract = await db.collection('crm_contracts').findOne({
    _id: new ObjectId(contractId),
    userId: new ObjectId(user._id),
  });
  if (!contract) return { success: false, error: 'Contract not found.' };

  // Issue a fresh, single-use, cryptographically-strong token per signer.
  const now = new Date();
  const signersWithTokens = clean.map((s) => ({
    ...s,
    token: crypto.randomBytes(32).toString('hex'),
    tokenIssuedAt: now,
  }));

  // Persist signers + status before kicking off email — that way a
  // delivery failure still leaves a `sent` contract the operator can
  // re-send from.
  const update = await db.collection('crm_contracts').updateOne(
    { _id: new ObjectId(contractId), userId: new ObjectId(user._id) },
    {
      $set: {
        status: 'sent',
        signers: signersWithTokens,
        sentAt: now,
        updatedAt: now,
      },
    },
  );
  if (update.matchedCount === 0) {
    return { success: false, error: 'Contract not found.' };
  }

  // Send via the configured e-sign provider. Internal = email magic
  // link to /sign/...; other providers are stubbed.
  const provider = getProvider((contract.esignProvider as string | undefined) ?? 'internal');
  const title = (contract.title as string | undefined) || 'Contract';
  const failed: Array<{ email: string; error: string }> = [];
  let delivered = 0;
  for (const s of signersWithTokens) {
    const link = buildMagicLink(contractId, s.token);
    try {
      const r = await provider.sendForSignature({
        contractId,
        contractTitle: title,
        signerEmail: s.email,
        signerName: s.name || s.email,
        magicLinkUrl: link,
        tenantUserId: String(user._id),
      });
      if (r.ok) delivered += 1;
      else failed.push({ email: s.email, error: r.error || 'Send failed' });
    } catch (e: any) {
      failed.push({ email: s.email, error: e?.message || 'Send failed' });
    }
  }

  try {
    await writeAuditEntry({
      tenantUserId: String(user._id),
      actorId: String(user._id),
      action: 'send',
      entityKind: 'contract',
      entityId: contractId,
      reason: `Sent to ${signersWithTokens.length} signer${signersWithTokens.length === 1 ? '' : 's'} via ${provider.id} (delivered: ${delivered}${failed.length ? `, failed: ${failed.length}` : ''})`,
    });
  } catch { /* non-fatal */ }
  revalidatePath(`/dashboard/crm/contracts/${contractId}`);
  revalidatePath('/dashboard/crm/contracts');
  return { success: true, delivered, failed };
}

/**
 * Re-issue a fresh token and resend the magic-link email to a single
 * signer (identified by email). Used by the "Resend invite" sub-action
 * on the contract detail page.
 */
export async function resendContractToSigner(
  contractId: string,
  signerEmail: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(contractId)) return { success: false, error: 'Invalid contract' };
  const targetEmail = (signerEmail || '').trim().toLowerCase();
  if (!targetEmail || !targetEmail.includes('@')) {
    return { success: false, error: 'Invalid signer email.' };
  }

  const { db } = await connectToDatabase();
  const contract = await db.collection('crm_contracts').findOne({
    _id: new ObjectId(contractId),
    userId: new ObjectId(user._id),
  });
  if (!contract) return { success: false, error: 'Contract not found.' };

  const signers: Array<Record<string, any>> = Array.isArray(contract.signers)
    ? (contract.signers as Array<Record<string, any>>)
    : [];
  const idx = signers.findIndex((s) => (s?.email || '').toLowerCase() === targetEmail);
  if (idx === -1) return { success: false, error: 'Signer not found on this contract.' };
  if (signers[idx].signedAt) {
    return { success: false, error: 'This signer has already signed.' };
  }

  const now = new Date();
  const token = crypto.randomBytes(32).toString('hex');
  signers[idx] = {
    ...signers[idx],
    token,
    tokenIssuedAt: now,
    tokenUsedAt: null,
  };

  await db.collection('crm_contracts').updateOne(
    { _id: new ObjectId(contractId), userId: new ObjectId(user._id) },
    { $set: { signers, updatedAt: now } },
  );

  const provider = getProvider((contract.esignProvider as string | undefined) ?? 'internal');
  const r = await provider.sendForSignature({
    contractId,
    contractTitle: (contract.title as string | undefined) || 'Contract',
    signerEmail: targetEmail,
    signerName: (signers[idx].name as string | undefined) || targetEmail,
    magicLinkUrl: buildMagicLink(contractId, token),
    tenantUserId: String(user._id),
  });

  try {
    await writeAuditEntry({
      tenantUserId: String(user._id),
      actorId: String(user._id),
      action: 'send',
      entityKind: 'contract',
      entityId: contractId,
      reason: `Resent invite to ${targetEmail}${r.ok ? '' : ` (failed: ${r.error || 'unknown'})`}`,
    });
  } catch { /* non-fatal */ }

  revalidatePath(`/dashboard/crm/contracts/${contractId}`);
  if (!r.ok) return { success: false, error: r.error || 'Failed to send.' };
  return { success: true };
}

/** Move the contract to `terminated` with a reason. */
export async function voidContract(
  contractId: string,
  reason: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(contractId)) return { success: false, error: 'Invalid contract' };
  const { db } = await connectToDatabase();
  const res = await db.collection('crm_contracts').updateOne(
    { _id: new ObjectId(contractId), userId: new ObjectId(user._id) },
    {
      $set: {
        status: 'terminated',
        voidedAt: new Date(),
        voidReason: reason || '',
        updatedAt: new Date(),
      },
    },
  );
  if (res.matchedCount === 0) {
    return { success: false, error: 'Contract not found.' };
  }
  try {
    await writeAuditEntry({
      tenantUserId: String(user._id),
      actorId: String(user._id),
      action: 'void',
      entityKind: 'contract',
      entityId: contractId,
      reason: reason || undefined,
    });
  } catch { /* non-fatal */ }
  revalidatePath(`/dashboard/crm/contracts/${contractId}`);
  revalidatePath('/dashboard/crm/contracts');
  return { success: true };
}

/** Renew with a new end date; resets status to `draft`. */
export async function renewContract(
  contractId: string,
  newEndDate: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(contractId)) return { success: false, error: 'Invalid contract' };
  if (!newEndDate) return { success: false, error: 'End date is required.' };
  const parsed = new Date(newEndDate);
  if (Number.isNaN(parsed.getTime())) {
    return { success: false, error: 'Invalid end date.' };
  }
  const { db } = await connectToDatabase();
  const res = await db.collection('crm_contracts').updateOne(
    { _id: new ObjectId(contractId), userId: new ObjectId(user._id) },
    {
      $set: {
        endDate: parsed,
        status: 'draft',
        renewedAt: new Date(),
        updatedAt: new Date(),
      },
    },
  );
  if (res.matchedCount === 0) {
    return { success: false, error: 'Contract not found.' };
  }
  try {
    await writeAuditEntry({
      tenantUserId: String(user._id),
      actorId: String(user._id),
      action: 'update',
      entityKind: 'contract',
      entityId: contractId,
      reason: 'renewed',
      diff: { endDate: { after: parsed.toISOString() } },
    });
  } catch { /* non-fatal */ }
  revalidatePath(`/dashboard/crm/contracts/${contractId}`);
  revalidatePath('/dashboard/crm/contracts');
  return { success: true };
}

/** Set status without other side effects (e.g. mark signed manually). */
export async function updateContractStatus(
  contractId: string,
  status: 'draft' | 'sent' | 'signed' | 'expired' | 'terminated',
): Promise<{ success: boolean; error?: string }> {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(contractId)) return { success: false, error: 'Invalid contract' };
  const { db } = await connectToDatabase();
  const res = await db.collection('crm_contracts').updateOne(
    { _id: new ObjectId(contractId), userId: new ObjectId(user._id) },
    {
      $set: {
        status,
        updatedAt: new Date(),
        ...(status === 'signed' ? { signedAt: new Date() } : {}),
      },
    },
  );
  if (res.matchedCount === 0) {
    return { success: false, error: 'Contract not found.' };
  }
  try {
    await writeAuditEntry({
      tenantUserId: String(user._id),
      actorId: String(user._id),
      action: 'status_change',
      entityKind: 'contract',
      entityId: contractId,
      diff: { status: { after: status } },
    });
  } catch { /* non-fatal */ }
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

      revalidatePath('/dashboard/sabdesk');
      return { message: 'Saved successfully.', id };
    } catch (e) {
      console.error('[saveTicket] rust path failed; falling back:', e);
      recordRustFallback({ entity: 'ticket', op: 'create', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
      // fall through
    }
  }

  const result = await save('crm_tickets', '/dashboard/sabdesk', formData, {
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
      revalidatePath('/dashboard/sabdesk');
      return { success: true };
    } catch (e) {
      console.error('[updateTicketStatus] rust path failed; falling back:', e);
      recordRustFallback({ entity: 'ticket', op: 'update', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
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

  revalidatePath('/dashboard/sabdesk');
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
      revalidatePath('/dashboard/sabdesk');
      return { success: true };
    } catch (e) {
      console.error('[deleteTicket] rust path failed; falling back:', e);
      recordRustFallback({ entity: 'ticket', op: 'delete', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
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
  revalidatePath('/dashboard/sabdesk');
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
