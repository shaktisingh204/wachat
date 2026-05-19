'use server';

/**
 * CRM Budget server actions.
 *
 * **Dual implementation:** when `USE_RUST_CRM === 'true'` the read paths
 * delegate to `/v1/crm/budgets` on the Rust BFF; otherwise legacy direct-
 * Mongo runs. Failures record via `recordRustFallback` and fall through
 * to the legacy path.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/index.ts';
import { writeAuditEntry } from '@/lib/audit-log';
import { getErrorMessage } from '@/lib/utils';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { crmBudgetsApi } from '@/lib/rust-client/crm-budgets';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
  return process.env.USE_RUST_CRM === 'true';
}

export async function getBudgets(): Promise<{ budgets: any[]; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { budgets: [], error: 'Access denied.' };

  if (useRustCrm()) {
    try {
      const resp = await crmBudgetsApi.list({ page: 0, limit: 50 });
      return { budgets: JSON.parse(JSON.stringify(resp.items)) };
    } catch (e) {
      console.error('[getBudgets] rust path failed; falling back:', e);
      recordRustFallback({
        entity: 'budget',
        op: 'list',
        errorCode: e instanceof RustApiError ? e.code : undefined,
        status: e instanceof RustApiError ? e.status : undefined,
      });
    }
  }

  try {
    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(session.user._id as string);
    const docs = await db
      .collection('crm_budgets')
      .find({ userId: userObjectId } as any)
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
    return { budgets: JSON.parse(JSON.stringify(docs)) };
  } catch (e) {
    console.error('Failed to fetch crm_budgets:', e);
    return { budgets: [], error: getErrorMessage(e) };
  }
}

export async function getBudgetById(id: string): Promise<any | null> {
  const session = await getSession();
  if (!session?.user) return null;
  if (!ObjectId.isValid(id)) return null;

  if (useRustCrm()) {
    try {
      const doc = await crmBudgetsApi.getById(id);
      return JSON.parse(JSON.stringify(doc));
    } catch (e) {
      console.error('[getBudgetById] rust path failed; falling back:', e);
      recordRustFallback({
        entity: 'budget',
        op: 'get',
        errorCode: e instanceof RustApiError ? e.code : undefined,
        status: e instanceof RustApiError ? e.status : undefined,
      });
    }
  }

  try {
    const { db } = await connectToDatabase();
    const doc = await db.collection('crm_budgets').findOne({
      _id: new ObjectId(id),
      userId: new ObjectId(session.user._id as string),
    });
    if (!doc) return null;
    return JSON.parse(JSON.stringify(doc));
  } catch (e) {
    console.error('Failed to fetch budget by id:', e);
    return null;
  }
}

export async function updateBudget(
  _prev: any,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Access denied.' };

  const guard = await requirePermission('crm_budget', 'edit');
  if (!guard.ok) return { error: guard.error };

  const id = (formData.get('id') as string) || '';
  if (!id || !ObjectId.isValid(id)) {
    return { error: 'Invalid budget ID.' };
  }

  try {
    const { db } = await connectToDatabase();

    const budgetHead = (formData.get('budgetHead') as string | null) || '';
    const budgetHeadId = (formData.get('budgetHeadId') as string | null) || '';
    const budgetHeadType = (formData.get('budgetHeadType') as string | null) || '';
    const period = (formData.get('period') as string | null) || '';
    const scenario = (formData.get('scenario') as string | null) || 'base';
    const planAmountRaw = formData.get('planAmount') as string | null;
    const planAmount = planAmountRaw ? parseFloat(planAmountRaw) : 0;
    const alertAtRaw = formData.get('alertAt') as string | null;
    const alertAt = alertAtRaw ? parseInt(alertAtRaw, 10) : 0;
    const ownerId = (formData.get('ownerId') as string | null) || '';
    const ownerName = (formData.get('ownerName') as string | null) || '';
    const approverId = (formData.get('approverId') as string | null) || '';
    const approverName = (formData.get('approverName') as string | null) || '';
    const notes = (formData.get('notes') as string | null) || '';
    const status = (formData.get('status') as string | null) || 'draft';
    const lockedRaw = (formData.get('locked') as string | null) || '';
    const locked = lockedRaw === 'true' || lockedRaw === 'on';
    const allocationsRaw = (formData.get('allocations') as string | null) || '';
    const documentFileId = (formData.get('documentFileId') as string | null) || '';
    const documentFileUrl = (formData.get('documentFileUrl') as string | null) || '';
    const documentFileName = (formData.get('documentFileName') as string | null) || '';

    if (!budgetHead) return { error: 'Budget Head is required.' };
    if (planAmount < 0) return { error: 'Plan amount cannot be negative.' };
    if (alertAt < 0 || alertAt > 100) {
      return { error: 'Alert threshold must be between 0 and 100.' };
    }

    type AllocationLine = {
      id?: string;
      departmentId?: string | null;
      departmentLabel?: string;
      period?: string;
      amount?: number;
      note?: string;
    };

    let allocations: AllocationLine[] = [];
    if (allocationsRaw) {
      try {
        const parsed = JSON.parse(allocationsRaw);
        if (Array.isArray(parsed)) {
          allocations = parsed
            .filter((row: unknown): row is Record<string, unknown> => !!row && typeof row === 'object')
            .map((row: Record<string, unknown>) => ({
              id: typeof row.id === 'string' ? row.id : undefined,
              departmentId:
                typeof row.departmentId === 'string' && row.departmentId.length > 0
                  ? row.departmentId
                  : null,
              departmentLabel:
                typeof row.departmentLabel === 'string' ? row.departmentLabel : '',
              period: typeof row.period === 'string' ? row.period : '',
              amount:
                typeof row.amount === 'number' && Number.isFinite(row.amount)
                  ? row.amount
                  : 0,
              note: typeof row.note === 'string' ? row.note : '',
            }));
        }
      } catch {
        /* ignore malformed allocations payload */
      }
    }

    const setDoc: Record<string, unknown> = {
      budgetHead,
      period,
      scenario,
      planAmount,
      alertAt,
      ownerName,
      notes,
      status,
      locked,
      allocations,
      updatedAt: new Date(),
    };
    if (budgetHeadType) setDoc.budgetHeadType = budgetHeadType;
    if (budgetHeadId && ObjectId.isValid(budgetHeadId)) {
      setDoc.budgetHeadId = new ObjectId(budgetHeadId);
    }
    if (ownerId && ObjectId.isValid(ownerId)) {
      setDoc.ownerId = new ObjectId(ownerId);
    }
    if (approverId && ObjectId.isValid(approverId)) {
      setDoc.approverId = new ObjectId(approverId);
    }
    if (approverName) setDoc.approverName = approverName;
    if (documentFileId) {
      setDoc.documentFileId = documentFileId;
      setDoc.documentFileUrl = documentFileUrl;
      setDoc.documentFileName = documentFileName;
    } else {
      setDoc.documentFileId = null;
      setDoc.documentFileUrl = null;
      setDoc.documentFileName = null;
    }

    const result = await db.collection('crm_budgets').updateOne(
      {
        _id: new ObjectId(id),
        userId: new ObjectId(session.user._id as string),
      },
      { $set: setDoc } as any,
    );

    if (result.matchedCount === 0) {
      return { error: 'Budget not found or permission denied.' };
    }

    revalidatePath('/dashboard/crm/budgets');
    revalidatePath(`/dashboard/crm/budgets/${id}`);
    return { message: 'Budget updated.', id };
  } catch (e) {
    return { error: getErrorMessage(e) };
  }
}

export async function saveBudget(
  _prev: any,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Access denied.' };

  const guard = await requirePermission('crm_budget', 'create');
  if (!guard.ok) return { error: guard.error };

  try {
    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(session.user._id as string);

    const budgetHead = (formData.get('budgetHead') as string | null) || '';
    const period = (formData.get('period') as string | null) || '';
    const scenario = (formData.get('scenario') as string | null) || 'base';
    const planAmountRaw = formData.get('planAmount') as string | null;
    const planAmount = planAmountRaw ? parseFloat(planAmountRaw) : 0;
    const alertAtRaw = formData.get('alertAt') as string | null;
    const alertAt = alertAtRaw ? parseInt(alertAtRaw, 10) : 0;
    const ownerName = (formData.get('ownerName') as string | null) || '';
    const notes = (formData.get('notes') as string | null) || '';

    if (!budgetHead) return { error: 'Budget Head is required.' };

    const result = await db.collection('crm_budgets').insertOne({
      userId: userObjectId,
      budgetHead,
      period,
      scenario,
      planAmount,
      actual: 0,
      variance: 0 - planAmount,
      alertAt,
      ownerName,
      notes,
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    revalidatePath('/dashboard/crm/budgets');
    return { message: 'Budget saved.', id: result.insertedId.toString() };
  } catch (e) {
    return { error: getErrorMessage(e) };
  }
}

export async function deleteBudget(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid ID.' };

  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Access denied.' };

  const guard = await requirePermission('crm_budget', 'delete');
  if (!guard.ok) return { success: false, error: guard.error };

  try {
    const { db } = await connectToDatabase();
    const result = await db.collection('crm_budgets').deleteOne({
      _id: new ObjectId(id),
      userId: new ObjectId(session.user._id as string),
    } as any);

    if (result.deletedCount === 0) {
      return { success: false, error: 'Budget not found or permission denied.' };
    }

    revalidatePath('/dashboard/crm/budgets');
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

/* ─── Lifecycle ───────────────────────────────────────────────── */

async function setBudgetField(
  id: string,
  set: Record<string, unknown>,
  audit: { action: string; reason?: string; diff?: Record<string, { before?: unknown; after?: unknown }> },
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Access denied.' };
  if (!ObjectId.isValid(id)) {
    return { success: false, error: 'Invalid budget ID.' };
  }
  try {
    const { db } = await connectToDatabase();
    const res = await db.collection('crm_budgets').updateOne(
      {
        _id: new ObjectId(id),
        userId: new ObjectId(session.user._id as string),
      },
      { $set: { ...set, updatedAt: new Date() } } as any,
    );
    if (res.matchedCount === 0) {
      return { success: false, error: 'Budget not found.' };
    }
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: audit.action,
        entityKind: 'budget',
        entityId: id,
        reason: audit.reason,
        diff: audit.diff,
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath(`/dashboard/crm/budgets/${id}`);
    revalidatePath('/dashboard/crm/budgets');
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function approveBudget(budgetId: string) {
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Access denied.' };
  const guard = await requirePermission('crm_budget', 'edit');
  if (!guard.ok) return { success: false, error: guard.error };
  return setBudgetField(
    budgetId,
    { status: 'approved', approvedAt: new Date() },
    { action: 'status_change', reason: 'approved', diff: { status: { after: 'approved' } } },
  );
}

export async function rejectBudget(budgetId: string, reason?: string) {
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Access denied.' };
  const guard = await requirePermission('crm_budget', 'edit');
  if (!guard.ok) return { success: false, error: guard.error };
  return setBudgetField(
    budgetId,
    { status: 'rejected', rejectedAt: new Date(), rejectReason: reason || '' },
    { action: 'status_change', reason: reason || 'rejected', diff: { status: { after: 'rejected' } } },
  );
}

export async function lockBudget(budgetId: string) {
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Access denied.' };
  const guard = await requirePermission('crm_budget', 'edit');
  if (!guard.ok) return { success: false, error: guard.error };
  return setBudgetField(
    budgetId,
    { locked: true, lockedAt: new Date() },
    { action: 'archive', reason: 'locked', diff: { locked: { after: true } } },
  );
}

export async function recordBudgetActual(
  budgetId: string,
  amount: number,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Access denied.' };
  const guard = await requirePermission('crm_budget', 'edit');
  if (!guard.ok) return { success: false, error: guard.error };
  if (!ObjectId.isValid(budgetId)) {
    return { success: false, error: 'Invalid budget ID.' };
  }
  if (!Number.isFinite(amount)) {
    return { success: false, error: 'Invalid amount.' };
  }
  try {
    const { db } = await connectToDatabase();
    const budget = (await db.collection('crm_budgets').findOne({
      _id: new ObjectId(budgetId),
      userId: new ObjectId(session.user._id as string),
    })) as { actual?: number; planAmount?: number } | null;
    if (!budget) {
      return { success: false, error: 'Budget not found.' };
    }
    const newActual = (budget.actual ?? 0) + amount;
    const variance = (budget.planAmount ?? 0) - newActual;
    await db.collection('crm_budgets').updateOne(
      {
        _id: new ObjectId(budgetId),
        userId: new ObjectId(session.user._id as string),
      },
      {
        $set: {
          actual: newActual,
          variance,
          updatedAt: new Date(),
        },
        $push: {
          actualLog: {
            _id: new ObjectId(),
            amount,
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
        entityKind: 'budget',
        entityId: budgetId,
        reason: 'actual_posted',
        diff: {
          actual: { before: budget.actual ?? 0, after: newActual },
        },
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath(`/dashboard/crm/budgets/${budgetId}`);
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}
