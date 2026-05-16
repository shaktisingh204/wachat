'use server';

/**
 * CRM Loan server actions.
 *
 * **Dual implementation:** when `USE_RUST_CRM === 'true'` the read paths
 * delegate to `/v1/crm/loans` on the Rust BFF; otherwise legacy direct-
 * Mongo runs. Failures record via `recordRustFallback` and fall through
 * to the legacy path.
 */

import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { requirePermission } from '@/lib/rbac-server';
import { revalidatePath } from 'next/cache';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { crmLoansApi } from '@/lib/rust-client/crm-loans';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
  return process.env.USE_RUST_CRM === 'true';
}

export async function getLoanById(id: string): Promise<any | null> {
  const session = await getSession();
  if (!session?.user?._id) return null;
  if (!ObjectId.isValid(id)) return null;

  if (useRustCrm()) {
    try {
      const doc = await crmLoansApi.getById(id);
      return JSON.parse(JSON.stringify(doc));
    } catch (e) {
      console.error('[getLoanById] rust path failed; falling back:', e);
      recordRustFallback({
        entity: 'loan',
        op: 'get',
        errorCode: e instanceof RustApiError ? e.code : undefined,
        status: e instanceof RustApiError ? e.status : undefined,
      });
    }
  }

  try {
    const { db } = await connectToDatabase();
    const doc = await db.collection('crm_loans').findOne({
      _id: new ObjectId(id),
      userId: new ObjectId(session.user._id as string),
    });
    if (!doc) return null;
    return JSON.parse(JSON.stringify(doc));
  } catch (e) {
    console.error('Failed to fetch loan by id:', e);
    return null;
  }
}

export async function updateLoan(
  _prev: any,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user?._id) {
    return { error: 'Unauthorized.' };
  }
  const guard = await requirePermission('crm_loan', 'edit');
  if (!guard.ok) return { error: guard.error };

  const id = (formData.get('id') as string) || '';
  if (!id || !ObjectId.isValid(id)) {
    return { error: 'Invalid loan ID.' };
  }

  try {
    const type = (formData.get('type') as string) || 'customer_loan';
    const borrowerName = (formData.get('borrowerName') as string) || '';
    const principal = parseFloat((formData.get('principal') as string) || '0');
    const interestRate = parseFloat((formData.get('interestRate') as string) || '0');
    const tenureMonths = parseInt((formData.get('tenureMonths') as string) || '1', 10);
    const startDate = (formData.get('startDate') as string) || '';
    const notes = (formData.get('notes') as string) || '';
    const status = (formData.get('status') as string) || 'active';

    if (!borrowerName.trim()) {
      return { error: 'Borrower name is required.' };
    }
    if (!principal || principal <= 0) {
      return { error: 'Principal amount must be greater than 0.' };
    }

    let emi: number;
    if (interestRate > 0) {
      const r = interestRate / 1200;
      const n = tenureMonths;
      emi = (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    } else {
      emi = principal / tenureMonths;
    }
    emi = Math.round(emi * 100) / 100;

    const { db } = await connectToDatabase();
    const result = await db.collection('crm_loans').updateOne(
      {
        _id: new ObjectId(id),
        userId: new ObjectId(session.user._id as string),
      },
      {
        $set: {
          type,
          borrowerName,
          principal,
          interestRate,
          tenureMonths,
          emi,
          startDate: startDate ? new Date(startDate) : new Date(),
          status,
          notes,
          updatedAt: new Date(),
        },
      },
    );

    if (result.matchedCount === 0) {
      return { error: 'Loan not found or permission denied.' };
    }

    revalidatePath('/dashboard/crm/loans');
    revalidatePath(`/dashboard/crm/loans/${id}`);
    return { message: 'Loan updated.', id };
  } catch (e: any) {
    console.error('updateLoan error:', e);
    return { error: e?.message || 'Failed to update loan.' };
  }
}

export async function saveLoan(
  _prev: any,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user?._id) {
    return { error: 'Unauthorized.' };
  }
  const guard = await requirePermission('crm_loan', 'create');
  if (!guard.ok) return { error: guard.error };

  try {
    const type = (formData.get('type') as string) || 'customer_loan';
    const borrowerName = (formData.get('borrowerName') as string) || '';
    const borrowerId = (formData.get('borrowerId') as string) || '';
    const principal = parseFloat((formData.get('principal') as string) || '0');
    const interestRate = parseFloat((formData.get('interestRate') as string) || '0');
    const tenureMonths = parseInt((formData.get('tenureMonths') as string) || '1', 10);
    const startDate = (formData.get('startDate') as string) || '';
    const notes = (formData.get('notes') as string) || '';

    if (!borrowerName.trim()) {
      return { error: 'Borrower name is required.' };
    }
    if (!principal || principal <= 0) {
      return { error: 'Principal amount must be greater than 0.' };
    }

    let emi: number;
    if (interestRate > 0) {
      const r = interestRate / 1200;
      const n = tenureMonths;
      emi = (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    } else {
      emi = principal / tenureMonths;
    }
    emi = Math.round(emi * 100) / 100;

    const { db } = await connectToDatabase();

    const doc: Record<string, any> = {
      userId: new ObjectId(session.user._id as string),
      type,
      borrowerName,
      principal,
      interestRate,
      tenureMonths,
      emi,
      outstanding: principal,
      npa: false,
      startDate: startDate ? new Date(startDate) : new Date(),
      status: 'active',
      notes,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (borrowerId && ObjectId.isValid(borrowerId)) {
      doc.borrowerId = new ObjectId(borrowerId);
    }

    const result = await db.collection('crm_loans').insertOne(doc);

    revalidatePath('/dashboard/crm/loans');

    return { message: 'Loan created.', id: result.insertedId.toString() };
  } catch (e: any) {
    console.error('saveLoan error:', e);
    return { error: e?.message || 'Failed to create loan.' };
  }
}

/* ─── Lifecycle ───────────────────────────────────────────────── */

export async function recordLoanPayment(
  loanId: string,
  payload: { amount: number; date: string; mode: string; txnId?: string },
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) {
    return { success: false, error: 'Unauthorized.' };
  }
  const guard = await requirePermission('crm_loan', 'edit');
  if (!guard.ok) return { success: false, error: guard.error };
  if (!ObjectId.isValid(loanId)) {
    return { success: false, error: 'Invalid loan ID.' };
  }
  if (!payload.amount || payload.amount <= 0) {
    return { success: false, error: 'Amount must be greater than 0.' };
  }

  try {
    const { db } = await connectToDatabase();
    const loan = await db.collection('crm_loans').findOne({
      _id: new ObjectId(loanId),
      userId: new ObjectId(session.user._id as string),
    });
    if (!loan) {
      return { success: false, error: 'Loan not found.' };
    }
    const prevOutstanding = (loan as { outstanding?: number }).outstanding ?? 0;
    const newOutstanding = Math.max(0, prevOutstanding - payload.amount);

    const payment = {
      _id: new ObjectId(),
      amount: payload.amount,
      date: payload.date ? new Date(payload.date) : new Date(),
      mode: payload.mode || 'cash',
      txnId: payload.txnId || '',
      createdAt: new Date(),
    };

    await db.collection('crm_loans').updateOne(
      {
        _id: new ObjectId(loanId),
        userId: new ObjectId(session.user._id as string),
      },
      {
        $push: { payments: payment } as any,
        $set: {
          outstanding: newOutstanding,
          status: newOutstanding === 0 ? 'closed' : 'active',
          updatedAt: new Date(),
        },
      } as any,
    );
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'pay',
        entityKind: 'loan',
        entityId: loanId,
        reason: payload.mode,
        diff: {
          outstanding: { before: prevOutstanding, after: newOutstanding },
          payment: { after: payload.amount },
        },
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath(`/dashboard/crm/loans/${loanId}`);
    revalidatePath('/dashboard/crm/loans');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to record payment.' };
  }
}

export async function markLoanNpa(
  loanId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) {
    return { success: false, error: 'Unauthorized.' };
  }
  if (!ObjectId.isValid(loanId)) {
    return { success: false, error: 'Invalid loan ID.' };
  }
  try {
    const { db } = await connectToDatabase();
    const res = await db.collection('crm_loans').updateOne(
      {
        _id: new ObjectId(loanId),
        userId: new ObjectId(session.user._id as string),
      },
      {
        $set: {
          npa: true,
          status: 'npa',
          npaMarkedAt: new Date(),
          updatedAt: new Date(),
        },
      } as any,
    );
    if (res.matchedCount === 0) {
      return { success: false, error: 'Loan not found.' };
    }
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'status_change',
        entityKind: 'loan',
        entityId: loanId,
        reason: 'npa',
        diff: { status: { after: 'npa' } },
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath(`/dashboard/crm/loans/${loanId}`);
    revalidatePath('/dashboard/crm/loans');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to mark NPA.' };
  }
}

export async function disburseLoan(
  loanId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) {
    return { success: false, error: 'Unauthorized.' };
  }
  if (!ObjectId.isValid(loanId)) {
    return { success: false, error: 'Invalid loan ID.' };
  }
  try {
    const { db } = await connectToDatabase();
    const res = await db.collection('crm_loans').updateOne(
      {
        _id: new ObjectId(loanId),
        userId: new ObjectId(session.user._id as string),
      },
      {
        $set: {
          status: 'active',
          disbursedAt: new Date(),
          updatedAt: new Date(),
        },
      } as any,
    );
    if (res.matchedCount === 0) {
      return { success: false, error: 'Loan not found.' };
    }
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'send',
        entityKind: 'loan',
        entityId: loanId,
        reason: 'disbursed',
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath(`/dashboard/crm/loans/${loanId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to disburse loan.' };
  }
}

/**
 * Compute a flat EMI schedule from the loan's stored EMI, tenure and
 * start date. Returns the schedule rows so the UI can render the table
 * client-side without an extra hop.
 */
export async function generateLoanEmiSchedule(
  loanId: string,
): Promise<{
  success: boolean;
  error?: string;
  schedule?: Array<{
    no: number;
    dueDate: string;
    amount: number;
    paid: boolean;
  }>;
}> {
  const session = await getSession();
  if (!session?.user?._id) {
    return { success: false, error: 'Unauthorized.' };
  }
  if (!ObjectId.isValid(loanId)) {
    return { success: false, error: 'Invalid loan ID.' };
  }
  try {
    const { db } = await connectToDatabase();
    const loan = (await db.collection('crm_loans').findOne({
      _id: new ObjectId(loanId),
      userId: new ObjectId(session.user._id as string),
    })) as {
      tenureMonths?: number;
      emi?: number;
      startDate?: Date | string;
      principal?: number;
    } | null;
    if (!loan) {
      return { success: false, error: 'Loan not found.' };
    }
    const tenure = Math.max(1, loan.tenureMonths ?? 12);
    const emi =
      loan.emi ??
      Math.round(((loan.principal ?? 0) / tenure) * 100) / 100;
    const start =
      loan.startDate instanceof Date
        ? loan.startDate
        : new Date(loan.startDate ?? Date.now());
    const schedule = Array.from({ length: tenure }, (_v, i) => {
      const due = new Date(start);
      due.setMonth(due.getMonth() + i);
      return {
        no: i + 1,
        dueDate: due.toISOString().slice(0, 10),
        amount: emi,
        paid: false,
      };
    });
    await db.collection('crm_loans').updateOne(
      {
        _id: new ObjectId(loanId),
        userId: new ObjectId(session.user._id as string),
      },
      { $set: { schedule, scheduleGeneratedAt: new Date(), updatedAt: new Date() } } as any,
    );
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'create',
        entityKind: 'loan',
        entityId: loanId,
        reason: 'emi_schedule_generated',
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath(`/dashboard/crm/loans/${loanId}`);
    return { success: true, schedule };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to generate schedule.' };
  }
}

export async function deleteLoan(
  loanId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) {
    return { success: false, error: 'Unauthorized.' };
  }
  const guard = await requirePermission('crm_loan', 'delete');
  if (!guard.ok) return { success: false, error: guard.error };
  if (!ObjectId.isValid(loanId)) {
    return { success: false, error: 'Invalid loan ID.' };
  }
  try {
    const { db } = await connectToDatabase();
    const res = await db.collection('crm_loans').deleteOne({
      _id: new ObjectId(loanId),
      userId: new ObjectId(session.user._id as string),
    });
    if (res.deletedCount === 0) {
      return { success: false, error: 'Loan not found.' };
    }
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'delete',
        entityKind: 'loan',
        entityId: loanId,
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath('/dashboard/crm/loans');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to delete loan.' };
  }
}
