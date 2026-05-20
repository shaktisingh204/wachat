'use server';

import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { requirePermission } from '@/lib/rbac-server';
import { revalidatePath } from 'next/cache';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { crmServiceContractsApi } from '@/lib/rust-client/crm-service-contracts';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
  return process.env.USE_RUST_CRM === 'true';
}

export async function getServiceContractById(id: string): Promise<any | null> {
  const session = await getSession();
  if (!session?.user) return null;
  if (!ObjectId.isValid(id)) return null;

  if (useRustCrm()) {
    try {
      const doc = await crmServiceContractsApi.getById(id);
      return JSON.parse(JSON.stringify(doc));
    } catch (e) {
      console.error('[getServiceContractById] rust path failed; falling back:', e);
      recordRustFallback({
        entity: 'service_contract',
        op: 'get',
        errorCode: e instanceof RustApiError ? e.code : undefined,
        status: e instanceof RustApiError ? e.status : undefined,
      });
    }
  }

  try {
    const { db } = await connectToDatabase();
    const doc = await db.collection('crm_service_contracts').findOne({
      _id: new ObjectId(id),
      userId: new ObjectId(session.user._id as string),
    });
    if (!doc) return null;
    return JSON.parse(JSON.stringify(doc));
  } catch (e) {
    console.error('Failed to fetch service contract by id:', e);
    return null;
  }
}

export async function updateServiceContract(
  _prev: any,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Access denied.' };

  const guard = await requirePermission('crm_service_contract', 'edit');
  if (!guard.ok) return { error: guard.error };

  const id = (formData.get('id') as string) || '';
  if (!id || !ObjectId.isValid(id)) {
    return { error: 'Invalid contract ID.' };
  }

  try {
    const { db } = await connectToDatabase();

    const contractNo = ((formData.get('contractNo') as string | null) || '').trim();
    const title = (formData.get('title') as string | null) || '';
    const customerId = (formData.get('customerId') as string | null) || '';
    const customerName = (formData.get('customerName') as string) || '';
    const contactId = (formData.get('contactId') as string | null) || '';
    const contactName = (formData.get('contactName') as string | null) || '';
    const assetName = (formData.get('assetName') as string) || '';
    const coverage = (formData.get('coverage') as string) || '';
    const frequency = (formData.get('frequency') as string) || '';
    const periodStart = (formData.get('periodStart') as string | null) || '';
    const periodEnd = (formData.get('periodEnd') as string | null) || '';
    const billingAmount = parseFloat((formData.get('billingAmount') as string) || '0');
    const billing = (formData.get('billing') as string | null) || '';
    const currency = ((formData.get('currency') as string | null) || 'INR').trim().toUpperCase();
    const technicianId = (formData.get('technicianId') as string | null) || '';
    const technician = (formData.get('technician') as string) || '';
    const accountManagerId = (formData.get('accountManagerId') as string | null) || '';
    const accountManagerName = (formData.get('accountManagerName') as string | null) || '';
    const autoRenewRaw = (formData.get('autoRenew') as string | null) || '';
    const autoRenew = autoRenewRaw === 'true' || autoRenewRaw === 'on';
    const renewalNoticeDaysRaw = (formData.get('renewalNoticeDays') as string | null) || '';
    const renewalNoticeDays = renewalNoticeDaysRaw ? parseInt(renewalNoticeDaysRaw, 10) || 0 : 0;
    const nextRenewalAt = (formData.get('nextRenewalAt') as string | null) || '';
    const terms = (formData.get('terms') as string | null) || '';
    const documentsRaw = (formData.get('documents') as string | null) || '';
    const notes = (formData.get('notes') as string) || '';
    const status = (formData.get('status') as string) || 'active';

    if (!contractNo) {
      return { error: 'Contract number is required.' };
    }
    if (billingAmount < 0) {
      return { error: 'Contract value cannot be negative.' };
    }
    if (renewalNoticeDays < 0 || renewalNoticeDays > 365) {
      return { error: 'Renewal notice must be between 0 and 365 days.' };
    }
    if (periodStart && periodEnd) {
      const s = new Date(periodStart).getTime();
      const e = new Date(periodEnd).getTime();
      if (Number.isFinite(s) && Number.isFinite(e) && e < s) {
        return { error: 'End date must be after the start date.' };
      }
    }

    type DocAttachment = { id: string; url: string; name: string };
    let documents: DocAttachment[] = [];
    if (documentsRaw) {
      try {
        const parsed = JSON.parse(documentsRaw);
        if (Array.isArray(parsed)) {
          documents = parsed
            .filter((d: unknown): d is Record<string, unknown> => !!d && typeof d === 'object')
            .map((d: Record<string, unknown>) => ({
              id: typeof d.id === 'string' ? d.id : '',
              url: typeof d.url === 'string' ? d.url : '',
              name: typeof d.name === 'string' ? d.name : 'document',
            }))
            .filter((d) => d.id);
        }
      } catch {
        /* ignore malformed documents */
      }
    }

    const setDoc: Record<string, any> = {
      contractNo,
      title,
      customerName,
      contactName,
      assetName,
      coverage,
      frequency,
      billingAmount,
      billing,
      currency,
      technician,
      accountManagerName,
      autoRenew,
      renewalNoticeDays,
      terms,
      documents,
      status,
      notes,
      updatedAt: new Date(),
    };
    if (customerId && ObjectId.isValid(customerId)) {
      setDoc.customerId = new ObjectId(customerId);
    }
    if (contactId && ObjectId.isValid(contactId)) {
      setDoc.contactId = new ObjectId(contactId);
    }
    if (technicianId && ObjectId.isValid(technicianId)) {
      setDoc.technicianId = new ObjectId(technicianId);
    }
    if (accountManagerId && ObjectId.isValid(accountManagerId)) {
      setDoc.accountManagerId = new ObjectId(accountManagerId);
    }
    if (periodStart) setDoc.periodStart = new Date(periodStart);
    if (periodEnd) setDoc.periodEnd = new Date(periodEnd);
    if (nextRenewalAt) {
      const d = new Date(nextRenewalAt);
      if (!Number.isNaN(d.getTime())) setDoc.nextRenewalAt = d;
    }

    const result = await db.collection('crm_service_contracts').updateOne(
      {
        _id: new ObjectId(id),
        userId: new ObjectId(session.user._id as string),
      },
      { $set: setDoc },
    );

    if (result.matchedCount === 0) {
      return { error: 'Service contract not found or permission denied.' };
    }

    revalidatePath('/dashboard/crm/service-contracts');
    revalidatePath(`/dashboard/crm/service-contracts/${id}`);
    return { message: 'Service contract updated.', id };
  } catch (e: any) {
    console.error('updateServiceContract error:', e);
    return { error: e?.message || 'Failed to update service contract.' };
  }
}

export async function saveServiceContract(
  _prev: any,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Access denied.' };

  const guard = await requirePermission('crm_service_contract', 'create');
  if (!guard.ok) return { error: guard.error };

  try {
    const { db } = await connectToDatabase();

    const contractNoRaw = (formData.get('contractNo') as string | null) || '';
    const contractNo = contractNoRaw.trim() || `AMC-${Date.now().toString().slice(-6)}`;
    const customerName = (formData.get('customerName') as string) || '';
    const customerId = (formData.get('customerId') as string | null) || '';
    const assetName = (formData.get('assetName') as string) || '';
    const coverage = (formData.get('coverage') as string) || '';
    const frequency = (formData.get('frequency') as string) || '';
    const periodStart = (formData.get('periodStart') as string | null) || '';
    const periodEnd = (formData.get('periodEnd') as string | null) || '';
    const billingAmount = parseFloat((formData.get('billingAmount') as string) || '0');
    const technician = (formData.get('technician') as string) || '';
    const notes = (formData.get('notes') as string) || '';

    const doc: Record<string, any> = {
      userId: new ObjectId(session.user._id as string),
      contractNo,
      customerName,
      assetName,
      coverage,
      frequency,
      billingAmount,
      technician,
      status: 'active',
      notes,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (customerId && ObjectId.isValid(customerId)) {
      doc.customerId = new ObjectId(customerId);
    }
    if (periodStart) {
      doc.periodStart = new Date(periodStart);
    }
    if (periodEnd) {
      doc.periodEnd = new Date(periodEnd);
    }

    const { insertedId } = await db.collection('crm_service_contracts').insertOne(doc);

    revalidatePath('/dashboard/crm/service-contracts');
    return { message: 'Service contract created.', id: insertedId.toString() };
  } catch (e: any) {
    console.error('saveServiceContract error:', e);
    return { error: e?.message || 'Failed to save service contract.' };
  }
}

/* ─── Lifecycle ───────────────────────────────────────────────── */

export async function scheduleServiceVisit(
  contractId: string,
  date: string,
  technician: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Access denied.' };
  if (!ObjectId.isValid(contractId)) {
    return { success: false, error: 'Invalid contract ID.' };
  }
  if (!date) return { success: false, error: 'Visit date is required.' };
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return { success: false, error: 'Invalid visit date.' };
  }

  try {
    const { db } = await connectToDatabase();
    const visit = {
      _id: new ObjectId(),
      date: parsed,
      technician: technician || '',
      status: 'scheduled',
      createdAt: new Date(),
    };
    const res = await db.collection('crm_service_contracts').updateOne(
      {
        _id: new ObjectId(contractId),
        userId: new ObjectId(session.user._id as string),
      },
      {
        $push: { visits: visit },
        $set: { updatedAt: new Date() },
      } as any,
    );
    if (res.matchedCount === 0) {
      return { success: false, error: 'Contract not found.' };
    }
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'create',
        entityKind: 'service_contract',
        entityId: contractId,
        reason: 'visit_scheduled',
        diff: {
          visitDate: { after: parsed.toISOString() },
          technician: { after: technician || '' },
        },
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath(`/dashboard/crm/service-contracts/${contractId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to schedule visit.' };
  }
}

export async function renewServiceContract(
  contractId: string,
  range: { startDate: string; endDate: string },
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Access denied.' };
  if (!ObjectId.isValid(contractId)) {
    return { success: false, error: 'Invalid contract ID.' };
  }
  const start = new Date(range.startDate);
  const end = new Date(range.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { success: false, error: 'Invalid date range.' };
  }
  if (end.getTime() <= start.getTime()) {
    return { success: false, error: 'End must be after start.' };
  }

  try {
    const { db } = await connectToDatabase();
    const res = await db.collection('crm_service_contracts').updateOne(
      {
        _id: new ObjectId(contractId),
        userId: new ObjectId(session.user._id as string),
      },
      {
        $set: {
          periodStart: start,
          periodEnd: end,
          status: 'active',
          renewedAt: new Date(),
          updatedAt: new Date(),
        },
      } as any,
    );
    if (res.matchedCount === 0) {
      return { success: false, error: 'Contract not found.' };
    }
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'update',
        entityKind: 'service_contract',
        entityId: contractId,
        reason: 'renewed',
        diff: {
          periodStart: { after: start.toISOString() },
          periodEnd: { after: end.toISOString() },
        },
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath(`/dashboard/crm/service-contracts/${contractId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to renew contract.' };
  }
}

export async function updateServiceContractStatus(
  contractId: string,
  status: 'draft' | 'active' | 'paused' | 'closed' | 'expired',
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Access denied.' };
  const guard = await requirePermission('crm_service_contract', 'edit');
  if (!guard.ok) return { success: false, error: guard.error };
  if (!ObjectId.isValid(contractId)) {
    return { success: false, error: 'Invalid contract ID.' };
  }
  try {
    const { db } = await connectToDatabase();
    const res = await db.collection('crm_service_contracts').updateOne(
      {
        _id: new ObjectId(contractId),
        userId: new ObjectId(session.user._id as string),
      },
      { $set: { status, updatedAt: new Date() } } as any,
    );
    if (res.matchedCount === 0) {
      return { success: false, error: 'Contract not found.' };
    }
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'status_change',
        entityKind: 'service_contract',
        entityId: contractId,
        diff: { status: { after: status } },
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath(`/dashboard/crm/service-contracts/${contractId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to update status.' };
  }
}

export async function deleteServiceContract(
  contractId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Access denied.' };
  const guard = await requirePermission('crm_service_contract', 'delete');
  if (!guard.ok) return { success: false, error: guard.error };
  if (!ObjectId.isValid(contractId)) {
    return { success: false, error: 'Invalid contract ID.' };
  }
  try {
    const { db } = await connectToDatabase();
    const res = await db.collection('crm_service_contracts').deleteOne({
      _id: new ObjectId(contractId),
      userId: new ObjectId(session.user._id as string),
    } as any);
    if (res.deletedCount === 0) {
      return { success: false, error: 'Contract not found.' };
    }
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'delete',
        entityKind: 'service_contract',
        entityId: contractId,
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath('/dashboard/crm/service-contracts');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to delete.' };
  }
}

/* ─── Bulk ─────────────────────────────────────────────────────────── */

/**
 * Bulk action on service contracts owned by the current user.
 *
 * Operations:
 *   - `renew`      → sets status to `active`, advances periodStart to today,
 *                    extends periodEnd by the original contract duration (or 1 year
 *                    when duration cannot be computed).
 *   - `terminate`  → sets status to `closed`.
 *   - `delete`     → hard-deletes documents.
 */
export async function bulkServiceContractAction(
  ids: string[],
  op: 'renew' | 'terminate' | 'delete',
): Promise<{ success: boolean; processed: number; error?: string }> {
  if (!ids.length) {
    return { success: false, processed: 0, error: 'No IDs provided.' };
  }
  const session = await getSession();
  if (!session?.user) {
    return { success: false, processed: 0, error: 'Access denied.' };
  }

  const permission = op === 'delete' ? 'delete' : 'edit';
  const guard = await requirePermission('crm_service_contract', permission);
  if (!guard.ok) {
    return { success: false, processed: 0, error: guard.error };
  }

  const validIds = ids.filter((id) => ObjectId.isValid(id));
  if (validIds.length === 0) {
    return { success: false, processed: 0, error: 'No valid IDs.' };
  }

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id as string);
    const objectIds = validIds.map((id) => new ObjectId(id));
    const filter = { _id: { $in: objectIds }, userId } as Record<string, unknown>;

    let processed = 0;

    if (op === 'delete') {
      const res = await db.collection('crm_service_contracts').deleteMany(filter);
      processed = res.deletedCount ?? 0;
    } else if (op === 'terminate') {
      const res = await db.collection('crm_service_contracts').updateMany(filter, {
        $set: { status: 'closed', updatedAt: new Date() },
      } as any);
      processed = res.modifiedCount ?? 0;
    } else {
      // renew: read each doc's original period, compute new end, write back
      const docs = await db
        .collection('crm_service_contracts')
        .find(filter)
        .toArray();
      const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;
      const now = new Date();
      let count = 0;
      for (const doc of docs) {
        const rawStart = doc.periodStart
          ? new Date(doc.periodStart as string | Date)
          : null;
        const rawEnd = doc.periodEnd
          ? new Date(doc.periodEnd as string | Date)
          : null;
        const durationMs =
          rawStart &&
          rawEnd &&
          !Number.isNaN(rawStart.getTime()) &&
          !Number.isNaN(rawEnd.getTime())
            ? rawEnd.getTime() - rawStart.getTime()
            : MS_PER_YEAR;
        const newEnd = new Date(now.getTime() + Math.max(durationMs, MS_PER_YEAR));
        await db.collection('crm_service_contracts').updateOne(
          { _id: doc._id, userId },
          {
            $set: {
              status: 'active',
              periodStart: now,
              periodEnd: newEnd,
              renewedAt: now,
              renewalDue: false,
              updatedAt: now,
            },
          } as any,
        );
        count += 1;
      }
      processed = count;
    }

    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: op === 'delete' ? 'delete' : 'status_change',
        entityKind: 'service_contract',
        entityId: validIds.join(','),
        reason: `bulk_${op} on ${processed} contracts`,
      });
    } catch {
      /* non-fatal */
    }

    revalidatePath('/dashboard/crm/service-contracts');
    return { success: true, processed };
  } catch (e: any) {
    console.error('bulkServiceContractAction error:', e);
    return {
      success: false,
      processed: 0,
      error: e?.message || 'Bulk action failed.',
    };
  }
}
