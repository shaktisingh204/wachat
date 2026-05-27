'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, type Filter, type Document, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { crmContractsApi } from '@/lib/rust-client/crm-contracts';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { generatePublicHash } from '@/lib/public-hash';
import { pushToCalendar } from '@/lib/integrations/google-calendar';

function useRustCrm(): boolean {
  return process.env.USE_RUST_CRM === 'true';
}

function revalidateContracts(id?: string) {
  revalidatePath('/dashboard/crm/sales/contracts');
  if (id) revalidatePath(`/dashboard/crm/sales/contracts/${id}`);
}

interface ContractListResult {
  contracts: WithId<Record<string, unknown>>[];
  total: number;
  page: number;
  limit: number;
  error?: string;
}

export async function listContracts(
  page = 1,
  limit = 25,
  search?: string,
  status?: string,
): Promise<ContractListResult> {
  const session = await getSession();
  if (!session?.user) return { contracts: [], total: 0, page, limit, error: 'Unauthorized' };
  const guard = await requirePermission('crm_contract', 'view');
  if (!guard.ok) return { contracts: [], total: 0, page, limit, error: guard.error };

  try {
    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(session.user._id as string);
    const filter: Filter<Document> = { userId: userObjectId };
    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ title: re }, { partyName: re }];
    }
    if (status === 'expiring30') {
      const now = new Date();
      const thirty = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      filter.expiryDate = { $gte: now, $lte: thirty };
      filter.status = { $nin: ['cancelled', 'archived'] };
    } else if (status && status !== 'all') {
      filter.status = status;
    }

    const skip = Math.max(0, (page - 1) * limit);
    const [contracts, total] = await Promise.all([
      db.collection('crm_contracts').find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      db.collection('crm_contracts').countDocuments(filter),
    ]);
    return {
      contracts: contracts as WithId<Record<string, unknown>>[],
      total,
      page,
      limit,
    };
  } catch (e: any) {
    console.error('listContracts error:', e);
    return { contracts: [], total: 0, page, limit, error: e?.message ?? 'Failed.' };
  }
}

interface ContractKpis {
  active: number;
  expiring30: number;
  renewing: number;
  cancelled: number;
  avgDurationDays: number;
}

export async function getContractKpis(): Promise<ContractKpis> {
  const zero: ContractKpis = { active: 0, expiring30: 0, renewing: 0, cancelled: 0, avgDurationDays: 0 };

  const session = await getSession();
  if (!session?.user) return zero;
  const guard = await requirePermission('crm_contract', 'view');
  if (!guard.ok) return zero;

  try {
    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(session.user._id as string);
    const base: Filter<Document> = { userId: userObjectId };
    const now = new Date();
    const thirty = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [active, expiring30, renewing, cancelled, sample] = await Promise.all([
      db.collection('crm_contracts').countDocuments({ ...base, status: { $nin: ['cancelled', 'archived'] } }),
      db.collection('crm_contracts').countDocuments({ ...base, expiryDate: { $gte: now, $lte: thirty }, status: { $nin: ['cancelled', 'archived'] } }),
      db.collection('crm_contracts').countDocuments({ ...base, autoRenew: true, status: { $nin: ['cancelled', 'archived'] } }),
      db.collection('crm_contracts').countDocuments({ ...base, status: 'cancelled' }),
      db
        .collection('crm_contracts')
        .find({ ...base, effectiveDate: { $exists: true }, expiryDate: { $exists: true } } as Filter<Document>)
        .limit(500)
        .toArray(),
    ]);

    let totalDays = 0;
    let n = 0;
    for (const row of sample) {
      const start = row.effectiveDate instanceof Date ? row.effectiveDate : new Date(row.effectiveDate as string);
      const end = row.expiryDate instanceof Date ? row.expiryDate : new Date(row.expiryDate as string);
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start) {
        totalDays += (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        n += 1;
      }
    }
    const avgDurationDays = n > 0 ? Math.round(totalDays / n) : 0;

    return { active, expiring30, renewing, cancelled, avgDurationDays };
  } catch (e) {
    console.error('getContractKpis error:', e);
    return zero;
  }
}

export async function getContractById(
  contractId: string,
): Promise<WithId<Record<string, unknown>> | null> {
  const session = await getSession();
  if (!session?.user) return null;
  if (!ObjectId.isValid(contractId)) return null;

  if (useRustCrm()) {
    try {
      const doc = await crmContractsApi.getById(contractId);
      return JSON.parse(JSON.stringify(doc));
    } catch (e) {
      console.error('[getContractById] rust path failed; falling back:', e);
      recordRustFallback({
        entity: 'contract',
        op: 'get',
        errorCode: e instanceof RustApiError ? e.code : undefined,
        status: e instanceof RustApiError ? e.status : undefined,
      });
    }
  }

  try {
    const { db } = await connectToDatabase();
    const contract = await db.collection('crm_contracts').findOne({
      _id: new ObjectId(contractId),
      userId: new ObjectId(session.user._id as string),
    });
    if (!contract) return null;
    return JSON.parse(JSON.stringify(contract));
  } catch (e) {
    console.error('Failed to fetch contract by id:', e);
    return null;
  }
}

function readContractFormFields(formData: FormData) {
  const title = ((formData.get('title') as string | null) ?? '').trim();
  const partyName = ((formData.get('partyName') as string | null) ?? '').trim();
  const type = (formData.get('type') as string | null) ?? 'nda';
  const partyEmail = ((formData.get('partyEmail') as string | null) ?? '').trim();
  const partyPhone = ((formData.get('partyPhone') as string | null) ?? '').trim();
  const signatoryName = ((formData.get('signatoryName') as string | null) ?? '').trim();
  const signatoryEmail = ((formData.get('signatoryEmail') as string | null) ?? '').trim();
  const scope = ((formData.get('scope') as string | null) ?? '').trim();
  const deliverables = ((formData.get('deliverables') as string | null) ?? '').trim();
  const currency = ((formData.get('currency') as string | null) ?? 'INR').trim();
  const branch = ((formData.get('branch') as string | null) ?? '').trim();
  const ownerId = ((formData.get('ownerId') as string | null) ?? '').trim();
  const sourceProposalId = ((formData.get('sourceProposalId') as string | null) ?? '').trim();
  const sourceProposalNumber = ((formData.get('sourceProposalNumber') as string | null) ?? '').trim();
  const effectiveDateRaw = (formData.get('effectiveDate') as string | null) ?? '';
  const expiryDateRaw = (formData.get('expiryDate') as string | null) ?? '';
  const autoRenew = formData.get('autoRenew') === 'on';
  const renewalNoticeDaysRaw = (formData.get('renewalNoticeDays') as string | null) ?? '';
  const valueRaw = (formData.get('value') as string | null) ?? '';
  const esignProvider = (formData.get('esignProvider') as string | null) ?? 'none';
  const notes = ((formData.get('notes') as string | null) ?? '').trim();
  const attachmentsRaw = ((formData.get('attachments') as string | null) ?? '').trim();
  const status = (formData.get('status') as string | null) ?? undefined;

  return {
    title,
    partyName,
    type,
    partyEmail,
    partyPhone,
    signatoryName,
    signatoryEmail,
    scope,
    deliverables,
    currency,
    branch,
    ownerId,
    sourceProposalId,
    sourceProposalNumber,
    effectiveDateRaw,
    expiryDateRaw,
    autoRenew,
    renewalNoticeDaysRaw,
    valueRaw,
    esignProvider,
    notes,
    attachmentsRaw,
    status,
  };
}

async function nextContractNumber(userObjectId: ObjectId): Promise<string> {
  try {
    const { db } = await connectToDatabase();
    const count = await db.collection('crm_contracts').countDocuments({ userId: userObjectId });
    return `CTR-${String(count + 1).padStart(5, '0')}`;
  } catch {
    return `CTR-${Date.now().toString().slice(-5)}`;
  }
}

export async function updateContract(
  _prev: any,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Access denied.' };

  const guard = await requirePermission('crm_contract', 'edit');
  if (!guard.ok) return { error: guard.error };

  const contractId = (formData.get('contractId') as string | null) || '';
  if (!contractId || !ObjectId.isValid(contractId)) {
    return { error: 'Invalid contract id.' };
  }

  const f = readContractFormFields(formData);
  if (!f.title) return { error: 'Contract title is required.' };
  if (!f.partyName) return { error: 'Counter-party name is required.' };

  try {
    const { db } = await connectToDatabase();
    const $set: Record<string, any> = {
      title: f.title,
      type: f.type,
      partyName: f.partyName,
      autoRenew: f.autoRenew,
      esignProvider: f.esignProvider,
      notes: f.notes,
      currency: f.currency,
      updatedAt: new Date(),
    };
    if (f.partyEmail) $set.partyEmail = f.partyEmail;
    if (f.partyPhone) $set.partyPhone = f.partyPhone;
    if (f.signatoryName) $set.signatoryName = f.signatoryName;
    if (f.signatoryEmail) $set.signatoryEmail = f.signatoryEmail;
    if (f.scope) $set.scope = f.scope;
    if (f.deliverables) $set.deliverables = f.deliverables;
    if (f.branch) $set.branch = f.branch;
    if (f.ownerId && ObjectId.isValid(f.ownerId)) $set.ownerId = new ObjectId(f.ownerId);
    if (f.effectiveDateRaw) $set.effectiveDate = new Date(f.effectiveDateRaw);
    if (f.expiryDateRaw) $set.expiryDate = new Date(f.expiryDateRaw);
    if (f.renewalNoticeDaysRaw) {
      const days = parseInt(f.renewalNoticeDaysRaw, 10);
      if (!isNaN(days)) $set.renewalNoticeDays = days;
    }
    if (f.valueRaw) {
      const val = parseFloat(f.valueRaw);
      if (!isNaN(val)) $set.value = val;
    }
    if (f.status) $set.status = f.status;
    if (f.attachmentsRaw) {
      $set.attachments = f.attachmentsRaw.split('|').map((s) => s.trim()).filter(Boolean);
    }

    const result = await db.collection('crm_contracts').updateOne(
      {
        _id: new ObjectId(contractId),
        userId: new ObjectId(session.user._id as string),
      },
      { $set },
    );

    if (result.matchedCount === 0) {
      return { error: 'Contract not found.' };
    }

    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'update',
        entityKind: 'contract',
        entityId: contractId,
      });
    } catch {
      /* non-fatal */
    }

    revalidateContracts(contractId);
    return { message: 'Contract updated successfully.', id: contractId };
  } catch (e: any) {
    console.error('updateContract error:', e);
    return { error: e?.message || 'Failed to update contract.' };
  }
}

export async function saveContract(
  _prev: any,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Access denied.' };

  const guard = await requirePermission('crm_contract', 'create');
  if (!guard.ok) return { error: guard.error };

  const f = readContractFormFields(formData);
  if (!f.title) return { error: 'Contract title is required.' };
  if (!f.partyName) return { error: 'Counter-party name is required.' };

  try {
    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(session.user._id as string);
    const contractNumber = await nextContractNumber(userObjectId);

    const doc: Record<string, any> = {
      userId: userObjectId,
      contractNumber,
      title: f.title,
      type: f.type,
      partyName: f.partyName,
      autoRenew: f.autoRenew,
      esignProvider: f.esignProvider,
      status: 'draft',
      currency: f.currency,
      notes: f.notes,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (f.partyEmail) doc.partyEmail = f.partyEmail;
    if (f.partyPhone) doc.partyPhone = f.partyPhone;
    if (f.signatoryName) doc.signatoryName = f.signatoryName;
    if (f.signatoryEmail) doc.signatoryEmail = f.signatoryEmail;
    if (f.scope) doc.scope = f.scope;
    if (f.deliverables) doc.deliverables = f.deliverables;
    if (f.branch) doc.branch = f.branch;
    if (f.ownerId && ObjectId.isValid(f.ownerId)) doc.ownerId = new ObjectId(f.ownerId);
    if (f.sourceProposalId && ObjectId.isValid(f.sourceProposalId)) {
      doc.sourceProposalId = new ObjectId(f.sourceProposalId);
    }
    if (f.sourceProposalNumber) doc.sourceProposalNumber = f.sourceProposalNumber;
    if (f.effectiveDateRaw) doc.effectiveDate = new Date(f.effectiveDateRaw);
    if (f.expiryDateRaw) doc.expiryDate = new Date(f.expiryDateRaw);
    if (f.renewalNoticeDaysRaw) {
      const days = parseInt(f.renewalNoticeDaysRaw, 10);
      if (!isNaN(days)) doc.renewalNoticeDays = days;
    }
    if (f.valueRaw) {
      const val = parseFloat(f.valueRaw);
      if (!isNaN(val)) doc.value = val;
    }
    if (f.attachmentsRaw) {
      doc.attachments = f.attachmentsRaw.split('|').map((s) => s.trim()).filter(Boolean);
    }

    // Public portal hash — drives `/share/contract/[hash]`.
    (doc as Record<string, unknown>).publicHash = generatePublicHash();
    const { insertedId } = await db.collection('crm_contracts').insertOne(doc);

    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'create',
        entityKind: 'contract',
        entityId: insertedId.toString(),
      });
    } catch {
      /* non-fatal */
    }

    revalidateContracts();

    // Google Calendar — push the contract end date as a renewal reminder.
    // Non-fatal; if it fails we flag the contract doc so ops can review.
    try {
      if (f.expiryDateRaw) {
        const expiry = new Date(f.expiryDateRaw);
        if (!Number.isNaN(expiry.getTime())) {
          // All-day reminder on the expiry date.
          const startStr = expiry.toISOString().slice(0, 10);
          const endStr = new Date(expiry.getTime() + 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10);
          const push = await pushToCalendar(String(session.user._id), {
            summary: `Contract renewal: ${f.title}`,
            description: `Contract ${contractNumber} with ${f.partyName} expires today.`,
            start: startStr,
            end: endStr,
            allDay: true,
          });
          await db.collection('crm_contracts').updateOne(
            { _id: insertedId },
            {
              $set: {
                googleEventId: push.googleEventId ?? null,
                googleCalendarSyncFailed: !push.ok,
                googleCalendarSyncError: push.ok ? null : push.error ?? null,
              },
            },
          );
        }
      }
    } catch (err) {
      console.warn('[saveContract] google calendar push failed:', err);
    }

    return { message: 'Contract saved successfully.', id: insertedId.toString() };
  } catch (e: any) {
    console.error('Failed to save CRM contract:', e);
    return { error: e?.message || 'Failed to save contract.' };
  }
}

export async function setContractStatus(
  contractId: string,
  status: 'draft' | 'sent' | 'signed' | 'active' | 'expired' | 'renewed' | 'cancelled',
): Promise<{ success: boolean; error?: string }> {
  if (!contractId || !ObjectId.isValid(contractId)) return { success: false, error: 'Invalid id.' };

  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Unauthorized' };

  const guard = await requirePermission('crm_contract', 'edit');
  if (!guard.ok) return { success: false, error: guard.error };

  try {
    const { db } = await connectToDatabase();
    const result = await db.collection('crm_contracts').updateOne(
      { _id: new ObjectId(contractId), userId: new ObjectId(session.user._id as string) },
      { $set: { status, updatedAt: new Date() } },
    );
    if (result.matchedCount === 0) return { success: false, error: 'Contract not found.' };

    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'status_change',
        entityKind: 'contract',
        entityId: contractId,
        diff: { status: { after: status } },
      });
    } catch {
      /* non-fatal */
    }
    revalidateContracts(contractId);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Failed.' };
  }
}

export async function archiveContract(contractId: string) {
  return setContractStatus(contractId, 'cancelled');
}

/* ─── Renewal helpers ────────────────────────────────────────────── */

interface RenewalActionResult {
  processed: number;
  errors: string[];
}

/**
 * Mark a batch of contracts as renewed (status → 'renewed').
 * RBAC: crm_contract / edit.
 */
export async function bulkMarkRenewed(
  ids: string[],
): Promise<RenewalActionResult> {
  if (!ids.length) return { processed: 0, errors: [] };

  const session = await getSession();
  if (!session?.user) return { processed: 0, errors: ['Unauthorized'] };
  const guard = await requirePermission('crm_contract', 'edit');
  if (!guard.ok) return { processed: 0, errors: [guard.error ?? 'Forbidden'] };

  let processed = 0;
  const errors: string[] = [];

  await Promise.all(
    ids.map(async (id) => {
      if (!ObjectId.isValid(id)) {
        errors.push(`${id}: invalid id`);
        return;
      }
      try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_contracts').updateOne(
          {
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id as string),
          },
          { $set: { status: 'renewed', updatedAt: new Date() } },
        );
        if (result.matchedCount === 0) {
          errors.push(`${id}: not found`);
        } else {
          processed += 1;
        }
      } catch (e: unknown) {
        errors.push(`${id}: ${e instanceof Error ? e.message : 'failed'}`);
      }
    }),
  );

  try {
    await writeAuditEntry({
      tenantUserId: String(session.user._id),
      actorId: String(session.user._id),
      action: 'bulk_renew',
      entityKind: 'contract',
      entityId: ids.join(','),
    });
  } catch {
    /* non-fatal */
  }

  revalidatePath('/dashboard/crm/sales/contracts');
  revalidatePath('/dashboard/crm/sales/contracts/renewals');
  return { processed, errors };
}

/**
 * Send renewal notice emails/notifications for the given contract IDs.
 *
 * Implementation: queues a notification log entry in `crm_renewal_notices`
 * so the worker can pick it up. Adjust to your notification transport.
 * RBAC: crm_contract / edit.
 */
export async function sendRenewalNotices(
  ids: string[],
): Promise<RenewalActionResult> {
  if (!ids.length) return { processed: 0, errors: [] };

  const session = await getSession();
  if (!session?.user) return { processed: 0, errors: ['Unauthorized'] };
  const guard = await requirePermission('crm_contract', 'edit');
  if (!guard.ok) return { processed: 0, errors: [guard.error ?? 'Forbidden'] };

  let processed = 0;
  const errors: string[] = [];

  try {
    const { db } = await connectToDatabase();
    const validIds = ids.filter((id) => ObjectId.isValid(id));
    const invalidCount = ids.length - validIds.length;
    if (invalidCount > 0) {
      for (let i = 0; i < invalidCount; i++) errors.push('invalid id');
    }

    if (validIds.length > 0) {
      const notices = validIds.map((id) => ({
        contractId: new ObjectId(id),
        userId: new ObjectId(session.user._id as string),
        status: 'pending',
        queuedAt: new Date(),
      }));
      await db.collection('crm_renewal_notices').insertMany(notices);
      processed = validIds.length;
    }
  } catch (e: unknown) {
    errors.push(e instanceof Error ? e.message : 'Failed to queue notices');
  }

  try {
    await writeAuditEntry({
      tenantUserId: String(session.user._id),
      actorId: String(session.user._id),
      action: 'send_renewal_notices',
      entityKind: 'contract',
      entityId: ids.join(','),
    });
  } catch {
    /* non-fatal */
  }

  return { processed, errors };
}

export async function deleteContract(
  contractId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!contractId || !ObjectId.isValid(contractId)) return { success: false, error: 'Invalid id.' };

  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Unauthorized' };

  const guard = await requirePermission('crm_contract', 'delete');
  if (!guard.ok) return { success: false, error: guard.error };

  try {
    const { db } = await connectToDatabase();
    const result = await db.collection('crm_contracts').deleteOne({
      _id: new ObjectId(contractId),
      userId: new ObjectId(session.user._id as string),
    });
    if (result.deletedCount === 0) return { success: false, error: 'Contract not found.' };

    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'delete',
        entityKind: 'contract',
        entityId: contractId,
      });
    } catch {
      /* non-fatal */
    }
    revalidateContracts(contractId);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Failed.' };
  }
}
