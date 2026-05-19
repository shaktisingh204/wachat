'use server';

/**
 * CRM Petty Cash server actions.
 *
 * **Dual implementation:** when `USE_RUST_CRM === 'true'` the read paths
 * delegate to `/v1/crm/petty-cash` on the Rust BFF; otherwise legacy
 * direct-Mongo runs. Failures record via `recordRustFallback` and fall
 * through to the legacy path.
 */

import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { requirePermission } from '@/lib/rbac-server';
import { revalidatePath } from 'next/cache';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { crmPettyCashApi } from '@/lib/rust-client/crm-petty-cash';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
  return process.env.USE_RUST_CRM === 'true';
}

export async function getPettyCashFloatById(id: string): Promise<any | null> {
  const session = await getSession();
  if (!session?.user?._id) return null;
  if (!ObjectId.isValid(id)) return null;

  if (useRustCrm()) {
    try {
      const doc = await crmPettyCashApi.getById(id);
      return JSON.parse(JSON.stringify(doc));
    } catch (e) {
      console.error('[getPettyCashFloatById] rust path failed; falling back:', e);
      recordRustFallback({
        entity: 'petty_cash',
        op: 'get',
        errorCode: e instanceof RustApiError ? e.code : undefined,
        status: e instanceof RustApiError ? e.status : undefined,
      });
    }
  }

  try {
    const { db } = await connectToDatabase();
    const doc = await db.collection('crm_petty_cash_floats').findOne({
      _id: new ObjectId(id),
      userId: new ObjectId(session.user._id as string),
    });
    if (!doc) return null;
    return JSON.parse(JSON.stringify(doc));
  } catch (e) {
    console.error('Failed to fetch petty cash float by id:', e);
    return null;
  }
}

export async function updatePettyCashFloat(
  _prev: any,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user?._id) {
    return { error: 'Access denied.' };
  }
  const guard = await requirePermission('crm_petty_cash', 'edit');
  if (!guard.ok) return { error: guard.error };

  const id = (formData.get('id') as string) || '';
  if (!id || !ObjectId.isValid(id)) {
    return { error: 'Invalid float ID.' };
  }

  const name = (formData.get('name') as string | null)?.trim() ?? '';
  const branchId = (formData.get('branchId') as string | null) ?? '';
  const branchName = (formData.get('branchName') as string | null) ?? '';
  const custodianId = (formData.get('custodianId') as string | null) ?? '';
  const custodianName = (formData.get('custodianName') as string | null) ?? '';
  const approverId = (formData.get('approverId') as string | null) ?? '';
  const approverName = (formData.get('approverName') as string | null) ?? '';
  const currency = ((formData.get('currency') as string | null) ?? 'INR').trim().toUpperCase();
  const openingBalance = parseFloat((formData.get('openingBalance') as string | null) ?? '0') || 0;
  const notes = (formData.get('notes') as string | null) ?? '';
  const status = (formData.get('status') as string | null) ?? 'active';
  const policyFileId = (formData.get('policyFileId') as string | null) ?? '';
  const policyFileUrl = (formData.get('policyFileUrl') as string | null) ?? '';
  const policyFileName = (formData.get('policyFileName') as string | null) ?? '';

  if (!name) {
    return { error: 'Float name is required.' };
  }
  if (openingBalance < 0) {
    return { error: 'Opening balance cannot be negative.' };
  }

  try {
    const { db } = await connectToDatabase();
    const setDoc: Record<string, unknown> = {
      name,
      branchName,
      custodianName,
      approverName,
      currency,
      openingBalance,
      notes,
      status,
      updatedAt: new Date(),
    };
    if (branchId && ObjectId.isValid(branchId)) {
      setDoc.branchId = new ObjectId(branchId);
    }
    if (custodianId && ObjectId.isValid(custodianId)) {
      setDoc.custodianId = new ObjectId(custodianId);
    }
    if (approverId && ObjectId.isValid(approverId)) {
      setDoc.approverId = new ObjectId(approverId);
    }
    if (policyFileId) {
      setDoc.policyFileId = policyFileId;
      setDoc.policyFileUrl = policyFileUrl;
      setDoc.policyFileName = policyFileName;
    } else {
      setDoc.policyFileId = null;
      setDoc.policyFileUrl = null;
      setDoc.policyFileName = null;
    }
    const result = await db.collection('crm_petty_cash_floats').updateOne(
      {
        _id: new ObjectId(id),
        userId: new ObjectId(session.user._id as string),
      },
      { $set: setDoc },
    );

    if (result.matchedCount === 0) {
      return { error: 'Float not found or permission denied.' };
    }

    revalidatePath('/dashboard/crm/petty-cash');
    revalidatePath(`/dashboard/crm/petty-cash/${id}`);
    return { message: 'Petty cash float updated.', id };
  } catch (e: any) {
    console.error('updatePettyCashFloat error:', e);
    return { error: e?.message || 'Failed to update petty cash float.' };
  }
}

export async function savePettyCashFloat(
  _prev: any,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user?._id) {
    return { error: 'Access denied.' };
  }
  const guard = await requirePermission('crm_petty_cash', 'create');
  if (!guard.ok) return { error: guard.error };

  const branchName = (formData.get('branchName') as string | null) ?? '';
  const custodianName = (formData.get('custodianName') as string | null) ?? '';
  const openingBalance = parseFloat((formData.get('openingBalance') as string | null) ?? '0') || 0;
  const notes = (formData.get('notes') as string | null) ?? '';

  if (!branchName.trim()) {
    return { error: 'Branch name is required.' };
  }

  try {
    const { db } = await connectToDatabase();
    const result = await db.collection('crm_petty_cash_floats').insertOne({
      userId: new ObjectId(session.user._id as string),
      branchName,
      custodianName,
      openingBalance,
      totalTopUps: 0,
      totalSpent: 0,
      balance: openingBalance,
      status: 'active',
      notes,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    revalidatePath('/dashboard/crm/petty-cash');
    return { message: 'Petty cash float created.', id: result.insertedId.toString() };
  } catch (e) {
    console.error('savePettyCashFloat error:', e);
    return { error: 'Failed to create petty cash float. Please try again.' };
  }
}

/* ─── Lifecycle ───────────────────────────────────────────────── */

export async function topUpPettyCash(
  floatId: string,
  amount: number,
  notes?: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) {
    return { success: false, error: 'Unauthorized.' };
  }
  const guard = await requirePermission('crm_petty_cash', 'edit');
  if (!guard.ok) return { success: false, error: guard.error };
  if (!ObjectId.isValid(floatId)) {
    return { success: false, error: 'Invalid float ID.' };
  }
  if (!amount || amount <= 0) {
    return { success: false, error: 'Amount must be greater than 0.' };
  }

  try {
    const { db } = await connectToDatabase();
    const float = (await db.collection('crm_petty_cash_floats').findOne({
      _id: new ObjectId(floatId),
      userId: new ObjectId(session.user._id as string),
    })) as { balance?: number; totalTopUps?: number } | null;
    if (!float) {
      return { success: false, error: 'Float not found.' };
    }
    const newBalance = (float.balance ?? 0) + amount;
    const newTotalTopUps = (float.totalTopUps ?? 0) + amount;

    await db.collection('crm_petty_cash_floats').updateOne(
      {
        _id: new ObjectId(floatId),
        userId: new ObjectId(session.user._id as string),
      },
      {
        $set: {
          balance: newBalance,
          totalTopUps: newTotalTopUps,
          updatedAt: new Date(),
        },
        $push: {
          topUps: {
            _id: new ObjectId(),
            amount,
            notes: notes || '',
            postedAt: new Date(),
          },
        } as any,
      } as any,
    );
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'update',
        entityKind: 'petty_cash',
        entityId: floatId,
        reason: notes || 'top_up',
        diff: {
          balance: { before: float.balance ?? 0, after: newBalance },
          topUp: { after: amount },
        },
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath(`/dashboard/crm/petty-cash/${floatId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Top-up failed.' };
  }
}

export async function recordPettyCashVoucher(
  floatId: string,
  payload: { category: string; amount: number; payee: string; date?: string },
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) {
    return { success: false, error: 'Unauthorized.' };
  }
  const guard = await requirePermission('crm_petty_cash', 'edit');
  if (!guard.ok) return { success: false, error: guard.error };
  if (!ObjectId.isValid(floatId)) {
    return { success: false, error: 'Invalid float ID.' };
  }
  if (!payload.amount || payload.amount <= 0) {
    return { success: false, error: 'Amount must be greater than 0.' };
  }
  if (!payload.category) {
    return { success: false, error: 'Category is required.' };
  }

  try {
    const { db } = await connectToDatabase();
    const float = (await db.collection('crm_petty_cash_floats').findOne({
      _id: new ObjectId(floatId),
      userId: new ObjectId(session.user._id as string),
    })) as { balance?: number; totalSpent?: number } | null;
    if (!float) {
      return { success: false, error: 'Float not found.' };
    }
    const newBalance = (float.balance ?? 0) - payload.amount;
    if (newBalance < 0) {
      return { success: false, error: 'Insufficient balance.' };
    }
    const newTotalSpent = (float.totalSpent ?? 0) + payload.amount;
    const voucher = {
      _id: new ObjectId(),
      category: payload.category,
      amount: payload.amount,
      payee: payload.payee || '',
      date: payload.date ? new Date(payload.date) : new Date(),
      createdAt: new Date(),
    };

    await db.collection('crm_petty_cash_floats').updateOne(
      {
        _id: new ObjectId(floatId),
        userId: new ObjectId(session.user._id as string),
      },
      {
        $set: {
          balance: newBalance,
          totalSpent: newTotalSpent,
          updatedAt: new Date(),
        },
        $push: { vouchers: voucher } as any,
      } as any,
    );
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'create',
        entityKind: 'petty_cash',
        entityId: floatId,
        reason: `voucher: ${payload.category}`,
        diff: {
          balance: { before: float.balance ?? 0, after: newBalance },
          amount: { after: payload.amount },
        },
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath(`/dashboard/crm/petty-cash/${floatId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to record voucher.' };
  }
}

export async function reconcilePettyCash(
  floatId: string,
  countedAmount: number,
  notes?: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) {
    return { success: false, error: 'Unauthorized.' };
  }
  if (!ObjectId.isValid(floatId)) {
    return { success: false, error: 'Invalid float ID.' };
  }
  if (!Number.isFinite(countedAmount)) {
    return { success: false, error: 'Counted amount is required.' };
  }

  try {
    const { db } = await connectToDatabase();
    const float = (await db.collection('crm_petty_cash_floats').findOne({
      _id: new ObjectId(floatId),
      userId: new ObjectId(session.user._id as string),
    })) as { balance?: number } | null;
    if (!float) {
      return { success: false, error: 'Float not found.' };
    }
    const expected = float.balance ?? 0;
    const variance = countedAmount - expected;

    await db.collection('crm_petty_cash_floats').updateOne(
      {
        _id: new ObjectId(floatId),
        userId: new ObjectId(session.user._id as string),
      },
      {
        $set: {
          balance: countedAmount,
          lastReconciledAt: new Date(),
          lastReconcileNotes: notes || '',
          lastReconcileVariance: variance,
          updatedAt: new Date(),
        },
        $push: {
          reconciliations: {
            _id: new ObjectId(),
            countedAmount,
            expectedAmount: expected,
            variance,
            notes: notes || '',
            postedAt: new Date(),
          },
        } as any,
      } as any,
    );
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'update',
        entityKind: 'petty_cash',
        entityId: floatId,
        reason: notes || 'reconciled',
        diff: {
          balance: { before: expected, after: countedAmount },
          variance: { after: variance },
        },
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath(`/dashboard/crm/petty-cash/${floatId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Reconcile failed.' };
  }
}

export async function deletePettyCash(
  floatId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) {
    return { success: false, error: 'Unauthorized.' };
  }
  if (!ObjectId.isValid(floatId)) {
    return { success: false, error: 'Invalid float ID.' };
  }
  try {
    const { db } = await connectToDatabase();
    const res = await db.collection('crm_petty_cash_floats').deleteOne({
      _id: new ObjectId(floatId),
      userId: new ObjectId(session.user._id as string),
    });
    if (res.deletedCount === 0) {
      return { success: false, error: 'Float not found.' };
    }
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'delete',
        entityKind: 'petty_cash',
        entityId: floatId,
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath('/dashboard/crm/petty-cash');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to delete float.' };
  }
}
