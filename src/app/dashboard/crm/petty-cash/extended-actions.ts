'use server';

import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { requirePermission } from '@/lib/rbac-server';
import { revalidatePath } from 'next/cache';

export async function recordPettyCashVoucherExt(
  floatId: string,
  payload: {
    category: string;
    amount: number;
    payee: string;
    date?: string;
    glCode?: string;
    requesterName?: string;
    receiptUrl?: string;
    status?: string;
  },
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Unauthorized.' };
  
  const guard = await requirePermission('crm_petty_cash', 'edit');
  if (!guard.ok) return { success: false, error: guard.error };
  
  if (!ObjectId.isValid(floatId)) return { success: false, error: 'Invalid float ID.' };
  if (!payload.amount || payload.amount <= 0) return { success: false, error: 'Amount must be greater than 0.' };
  if (!payload.category) return { success: false, error: 'Category is required.' };

  try {
    const { db } = await connectToDatabase();
    const float = (await db.collection('crm_petty_cash_floats').findOne({
      _id: new ObjectId(floatId),
      userId: new ObjectId(session.user._id as string),
    })) as { balance?: number; totalSpent?: number } | null;
    
    if (!float) return { success: false, error: 'Float not found.' };

    const newBalance = (float.balance ?? 0) - payload.amount;
    if (newBalance < 0) return { success: false, error: 'Insufficient balance.' };
    
    const newTotalSpent = (float.totalSpent ?? 0) + payload.amount;
    
    const voucher = {
      _id: new ObjectId(),
      category: payload.category,
      amount: payload.amount,
      payee: payload.payee || '',
      date: payload.date ? new Date(payload.date) : new Date(),
      glCode: payload.glCode || '',
      requesterName: payload.requesterName || '',
      receiptUrl: payload.receiptUrl || '',
      status: payload.status || 'pending_approval',
      createdAt: new Date(),
    };

    await db.collection('crm_petty_cash_floats').updateOne(
      { _id: new ObjectId(floatId), userId: new ObjectId(session.user._id as string) },
      {
        $set: { balance: newBalance, totalSpent: newTotalSpent, updatedAt: new Date() },
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
        diff: { balance: { before: float.balance ?? 0, after: newBalance }, amount: { after: payload.amount } },
      });
    } catch { /* non-fatal */ }
    
    revalidatePath(`/dashboard/crm/petty-cash/${floatId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to record voucher.' };
  }
}

export async function updateVoucherStatus(
  floatId: string,
  voucherId: string,
  newStatus: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Unauthorized.' };

  const guard = await requirePermission('crm_petty_cash', 'edit');
  if (!guard.ok) return { success: false, error: guard.error };

  try {
    const { db } = await connectToDatabase();
    
    await db.collection('crm_petty_cash_floats').updateOne(
      { 
        _id: new ObjectId(floatId), 
        userId: new ObjectId(session.user._id as string),
        "vouchers._id": new ObjectId(voucherId)
      },
      {
        $set: { "vouchers.$.status": newStatus, updatedAt: new Date() },
      }
    );

    revalidatePath(`/dashboard/crm/petty-cash/${floatId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to update voucher status.' };
  }
}
