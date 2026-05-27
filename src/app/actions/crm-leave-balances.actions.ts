'use server';

/**
 * CRM Leave Balances — server-action wrappers around the legacy
 * `crm_leave_balances` Mongo collection.
 *
 * No Rust crate yet — direct Mongo reads/writes.
 *
 * Document shape (camelCase, per the task spec):
 * ```
 * {
 *   _id: ObjectId,
 *   userId: ObjectId,
 *   employeeId: ObjectId,
 *   employeeName?: string,
 *   leaveType: string,
 *   allotted: number,
 *   used: number,
 *   pending: number,
 *   carryForward: number,
 *   period: string,        // e.g. "2026-2027"
 *   createdAt: Date,
 *   updatedAt: Date,
 * }
 * ```
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { requirePermission } from '@/lib/rbac-server';
import { getErrorMessage } from '@/lib/utils';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface CrmLeaveBalanceDoc {
    _id: string;
    userId: string;
    employeeId: string;
    employeeName?: string;
    leaveType: string;
    allotted: number;
    used: number;
    pending: number;
    carryForward: number;
    period: string;
    createdAt?: string;
    updatedAt?: string;
}

interface CrmLeaveBalanceListParams {
    employeeId?: string;
    leaveType?: string;
    period?: string;
    q?: string;
    limit?: number;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function asString(v: FormDataEntryValue | null): string | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
}

function asNumber(v: FormDataEntryValue | null): number {
    const s = asString(v);
    if (!s) return 0;
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
}

function toDoc(raw: WithId<Record<string, unknown>>): CrmLeaveBalanceDoc {
    const j = JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
    return {
        _id: String(j._id),
        userId: String(j.userId),
        employeeId: String(j.employeeId ?? ''),
        employeeName: (j.employeeName as string | undefined) ?? undefined,
        leaveType: String(j.leaveType ?? ''),
        allotted: Number(j.allotted ?? 0),
        used: Number(j.used ?? 0),
        pending: Number(j.pending ?? 0),
        carryForward: Number(j.carryForward ?? 0),
        period: String(j.period ?? ''),
        createdAt: (j.createdAt as string | undefined) ?? undefined,
        updatedAt: (j.updatedAt as string | undefined) ?? undefined,
    };
}

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getCrmLeaveBalances(
    filters?: CrmLeaveBalanceListParams,
): Promise<CrmLeaveBalanceDoc[]> {
    const session = await getSession();
    if (!session?.user) return [];

    const guard = await requirePermission('crm_leave', 'view');
    if (!guard.ok) return [];

    try {
        const { db } = await connectToDatabase();
        const q: Record<string, unknown> = {
            userId: new ObjectId(session.user._id),
        };
        if (filters?.employeeId && ObjectId.isValid(filters.employeeId)) {
            q.employeeId = new ObjectId(filters.employeeId);
        }
        if (filters?.leaveType) q.leaveType = filters.leaveType;
        if (filters?.period) q.period = filters.period;
        if (filters?.q) {
            q.$or = [
                { employeeName: { $regex: filters.q, $options: 'i' } },
                { leaveType: { $regex: filters.q, $options: 'i' } },
            ];
        }
        const docs = await db
            .collection('crm_leave_balances')
            .find(q)
            .sort({ employeeName: 1, leaveType: 1 })
            .limit(Math.min(Math.max(1, filters?.limit ?? 200), 1000))
            .toArray();
        return docs.map(toDoc);
    } catch (e) {
        console.error('[getCrmLeaveBalances] failed:', getErrorMessage(e));
        return [];
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

export async function saveCrmLeaveBalance(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const balanceId = asString(formData.get('balanceId'));
    const isEditing = !!balanceId;

    const guard = await requirePermission(
        'crm_leave',
        isEditing ? 'edit' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const employeeId = asString(formData.get('employeeId'));
    const leaveType = asString(formData.get('leaveType'));
    const period = asString(formData.get('period'));
    if (!employeeId || !ObjectId.isValid(employeeId)) {
        return { error: 'Employee is required.' };
    }
    if (!leaveType) return { error: 'Leave type is required.' };
    if (!period) return { error: 'Period is required.' };

    const payload: Record<string, unknown> = {
        userId: new ObjectId(session.user._id),
        employeeId: new ObjectId(employeeId),
        employeeName: asString(formData.get('employeeName')),
        leaveType,
        allotted: asNumber(formData.get('allotted')),
        used: asNumber(formData.get('used')),
        pending: asNumber(formData.get('pending')),
        carryForward: asNumber(formData.get('carryForward')),
        period,
        updatedAt: new Date(),
    };

    try {
        const { db } = await connectToDatabase();
        if (isEditing && ObjectId.isValid(balanceId!)) {
            await db.collection('crm_leave_balances').updateOne(
                {
                    _id: new ObjectId(balanceId!),
                    userId: new ObjectId(session.user._id),
                },
                { $set: payload },
            );
            revalidatePath('/dashboard/hrm/payroll/leave/balance');
            return { message: 'Leave balance updated.', id: balanceId };
        }
        payload.createdAt = new Date();
        const result = await db.collection('crm_leave_balances').insertOne(payload);
        revalidatePath('/dashboard/hrm/payroll/leave/balance');
        return { message: 'Leave balance created.', id: result.insertedId.toString() };
    } catch (e) {
        return { error: `Failed to save leave balance: ${getErrorMessage(e)}` };
    }
}

export async function deleteCrmLeaveBalance(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid id.' };

    const guard = await requirePermission('crm_leave', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        await db.collection('crm_leave_balances').deleteOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id),
        });
        revalidatePath('/dashboard/hrm/payroll/leave/balance');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
