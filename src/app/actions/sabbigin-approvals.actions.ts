'use server';

/**
 * SabBigin approval chains — a Bigin-beating differentiator (Bigin has no
 * approval routing). When a deal tries to enter a stage marked
 * `approvalRequired`, `moveSabbiginDealStage` freezes the move and inserts a
 * `crm_approvals` request. An approver clears it here; on approval the
 * deferred stage move runs through the same rule-checked path.
 */

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { applySabbiginStageMove } from '@/app/actions/sabbigin-deals.actions';
import { notifyDealApprovalDecided } from '@/lib/sabbigin/notify';

const COLL = 'crm_approvals';

export interface SabbiginApproval {
  _id: string;
  dealId: string;
  dealName: string;
  pipelineId: string;
  fromStage: string;
  toStage: string;
  requestedBy: string;
  approverIds: string[];
  status: 'pending' | 'approved' | 'rejected';
  comment?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export async function listSabbiginApprovals(
  status: 'pending' | 'approved' | 'rejected' | 'all' = 'pending',
): Promise<SabbiginApproval[]> {
  const session = await getSession();
  if (!session?.user?._id) return [];
  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id);
    const filter: Record<string, unknown> = { userId };
    if (status !== 'all') filter.status = status;
    const rows = await db
      .collection(COLL)
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();
    return JSON.parse(JSON.stringify(rows)) as SabbiginApproval[];
  } catch (e) {
    console.error('[listSabbiginApprovals] failed:', e);
    return [];
  }
}

export async function countPendingSabbiginApprovals(): Promise<number> {
  const session = await getSession();
  if (!session?.user?._id) return 0;
  try {
    const { db } = await connectToDatabase();
    return await db
      .collection(COLL)
      .countDocuments({ userId: new ObjectId(session.user._id), status: 'pending' });
  } catch {
    return 0;
  }
}

export async function decideSabbiginApproval(
  approvalId: string,
  decision: 'approve' | 'reject',
  comment?: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Access denied' };
  if (!approvalId || !ObjectId.isValid(approvalId))
    return { success: false, error: 'Invalid approval id' };

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id);
    const approval = await db
      .collection(COLL)
      .findOne({ _id: new ObjectId(approvalId), userId });
    if (!approval) return { success: false, error: 'Approval not found' };
    if (approval.status !== 'pending')
      return { success: false, error: 'Already decided' };

    const status = decision === 'approve' ? 'approved' : 'rejected';
    await db.collection(COLL).updateOne(
      { _id: new ObjectId(approvalId), userId },
      { $set: { status, comment: comment ?? null, updatedAt: new Date() } },
    );

    if (decision === 'approve') {
      await applySabbiginStageMove(
        String(approval.dealId),
        String(approval.toStage),
        (approval.patch as Record<string, string | number | null>) ?? undefined,
      );
    }

    try {
      await notifyDealApprovalDecided({
        recipientUserId: String(approval.requestedBy),
        dealName: String(approval.dealName ?? 'Deal'),
        toStage: String(approval.toStage),
        approved: decision === 'approve',
        dealId: String(approval.dealId),
      });
    } catch {
      /* best-effort */
    }

    revalidatePath('/dashboard/sabbigin/approvals');
    revalidatePath('/dashboard/sabbigin/deals');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Failed to decide approval' };
  }
}
