'use server';

/**
 * CRM Weekly Timesheets — server-action wrappers around the legacy
 * `crm_timesheets` Mongo collection.
 *
 * This is the HRM "weekly timesheet" entity (distinct from
 * `crm-time-logs`, which is project-time tracking). No Rust crate yet —
 * every code-path reads/writes Mongo directly.
 *
 * Document shape (camelCase, per the task spec):
 * ```
 * {
 *   _id: ObjectId,
 *   userId: ObjectId,                // tenant
 *   employeeId: ObjectId,
 *   employeeName?: string,
 *   weekStartDate: Date,
 *   weekEndDate: Date,
 *   dailyHours: number[],            // 7 entries — Mon..Sun
 *   totalHours: number,
 *   projectBreakdowns?: Array<{ projectId: string; hours: number }>,
 *   notes?: string,
 *   status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'archived',
 *   approverId?: ObjectId,
 *   approvedAt?: Date,
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

type CrmTimesheetStatus =
    | 'draft'
    | 'submitted'
    | 'approved'
    | 'rejected'
    | 'archived';

interface CrmTimesheetProjectBreakdown {
    projectId: string;
    hours: number;
}

interface CrmTimesheetDoc {
    _id: string;
    userId: string;
    employeeId: string;
    employeeName?: string;
    weekStartDate: string;
    weekEndDate: string;
    dailyHours: number[];
    totalHours: number;
    projectBreakdowns?: CrmTimesheetProjectBreakdown[];
    notes?: string;
    status: CrmTimesheetStatus;
    approverId?: string;
    approvedAt?: string;
    createdAt?: string;
    updatedAt?: string;
}

interface CrmTimesheetListParams {
    q?: string;
    status?: CrmTimesheetStatus | 'all';
    employeeId?: string;
    weekStartFrom?: string;
    weekStartTo?: string;
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

function asDailyHours(v: FormDataEntryValue | null): number[] {
    const s = asString(v);
    if (!s) return [0, 0, 0, 0, 0, 0, 0];
    try {
        const arr = JSON.parse(s);
        if (Array.isArray(arr) && arr.length === 7) {
            return arr.map((n) => {
                const x = Number(n);
                return Number.isFinite(x) ? x : 0;
            });
        }
    } catch {
        // fall through
    }
    return [0, 0, 0, 0, 0, 0, 0];
}

function asProjectBreakdowns(
    v: FormDataEntryValue | null,
): CrmTimesheetProjectBreakdown[] | undefined {
    const s = asString(v);
    if (!s) return undefined;
    try {
        const arr = JSON.parse(s);
        if (!Array.isArray(arr)) return undefined;
        const out: CrmTimesheetProjectBreakdown[] = [];
        for (const r of arr) {
            const pid = String((r as { projectId?: unknown }).projectId ?? '').trim();
            const hr = Number((r as { hours?: unknown }).hours ?? 0);
            if (pid && Number.isFinite(hr)) {
                out.push({ projectId: pid, hours: hr });
            }
        }
        return out.length > 0 ? out : undefined;
    } catch {
        return undefined;
    }
}

const VALID_STATUSES: ReadonlySet<CrmTimesheetStatus> = new Set<CrmTimesheetStatus>([
    'draft',
    'submitted',
    'approved',
    'rejected',
    'archived',
]);

function toDoc(raw: WithId<Record<string, unknown>>): CrmTimesheetDoc {
    const j = JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
    const dailyHours = Array.isArray(j.dailyHours)
        ? (j.dailyHours as unknown[]).map((n) => (Number.isFinite(Number(n)) ? Number(n) : 0))
        : [0, 0, 0, 0, 0, 0, 0];
    return {
        _id: String(j._id),
        userId: String(j.userId),
        employeeId: String(j.employeeId ?? ''),
        employeeName: (j.employeeName as string | undefined) ?? undefined,
        weekStartDate: String(j.weekStartDate ?? ''),
        weekEndDate: String(j.weekEndDate ?? ''),
        dailyHours,
        totalHours: Number(j.totalHours ?? 0),
        projectBreakdowns: (j.projectBreakdowns as CrmTimesheetProjectBreakdown[] | undefined) ?? undefined,
        notes: (j.notes as string | undefined) ?? undefined,
        status: (VALID_STATUSES.has(j.status as CrmTimesheetStatus)
            ? j.status
            : 'draft') as CrmTimesheetStatus,
        approverId: j.approverId ? String(j.approverId) : undefined,
        approvedAt: (j.approvedAt as string | undefined) ?? undefined,
        createdAt: (j.createdAt as string | undefined) ?? undefined,
        updatedAt: (j.updatedAt as string | undefined) ?? undefined,
    };
}

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getCrmTimesheets(
    filters?: CrmTimesheetListParams,
): Promise<CrmTimesheetDoc[]> {
    const session = await getSession();
    if (!session?.user) return [];

    const guard = await requirePermission('crm_attendance', 'view');
    if (!guard.ok) return [];

    try {
        const { db } = await connectToDatabase();
        const q: Record<string, unknown> = {
            userId: new ObjectId(session.user._id),
        };
        if (filters?.status && filters.status !== 'all') q.status = filters.status;
        if (filters?.employeeId && ObjectId.isValid(filters.employeeId)) {
            q.employeeId = new ObjectId(filters.employeeId);
        }
        if (filters?.weekStartFrom || filters?.weekStartTo) {
            const range: Record<string, Date> = {};
            if (filters.weekStartFrom) range.$gte = new Date(filters.weekStartFrom);
            if (filters.weekStartTo) range.$lte = new Date(filters.weekStartTo);
            q.weekStartDate = range;
        }
        if (filters?.q) {
            q.$or = [
                { employeeName: { $regex: filters.q, $options: 'i' } },
                { notes: { $regex: filters.q, $options: 'i' } },
            ];
        }

        const docs = await db
            .collection('crm_timesheets')
            .find(q)
            .sort({ weekStartDate: -1 })
            .limit(Math.min(Math.max(1, filters?.limit ?? 100), 500))
            .toArray();
        return docs.map(toDoc);
    } catch (e) {
        console.error('[getCrmTimesheets] failed:', getErrorMessage(e));
        return [];
    }
}

export async function getCrmTimesheetById(id: string): Promise<CrmTimesheetDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!ObjectId.isValid(id)) return null;

    const guard = await requirePermission('crm_attendance', 'view');
    if (!guard.ok) return null;

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('crm_timesheets').findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id),
        });
        if (!doc) return null;
        return toDoc(doc);
    } catch (e) {
        console.error('[getCrmTimesheetById] failed:', getErrorMessage(e));
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

export async function saveCrmTimesheet(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const timesheetId = asString(formData.get('timesheetId'));
    const isEditing = !!timesheetId;

    const guard = await requirePermission(
        'crm_attendance',
        isEditing ? 'edit' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const employeeId = asString(formData.get('employeeId'));
    const weekStartRaw = asString(formData.get('weekStartDate'));
    const weekEndRaw = asString(formData.get('weekEndDate'));
    if (!employeeId || !ObjectId.isValid(employeeId)) {
        return { error: 'Employee is required.' };
    }
    if (!weekStartRaw || !weekEndRaw) {
        return { error: 'Week start and end dates are required.' };
    }

    const dailyHours = asDailyHours(formData.get('dailyHours'));
    const totalFromGrid = dailyHours.reduce((a, b) => a + b, 0);
    const totalRaw = asNumber(formData.get('totalHours'));
    const totalHours = totalRaw > 0 ? totalRaw : totalFromGrid;

    const statusRaw = asString(formData.get('status')) ?? 'draft';
    const status: CrmTimesheetStatus = VALID_STATUSES.has(statusRaw as CrmTimesheetStatus)
        ? (statusRaw as CrmTimesheetStatus)
        : 'draft';

    const payload: Record<string, unknown> = {
        userId: new ObjectId(session.user._id),
        employeeId: new ObjectId(employeeId),
        employeeName: asString(formData.get('employeeName')),
        weekStartDate: new Date(weekStartRaw),
        weekEndDate: new Date(weekEndRaw),
        dailyHours,
        totalHours,
        projectBreakdowns: asProjectBreakdowns(formData.get('projectBreakdowns')),
        notes: asString(formData.get('notes')),
        status,
        updatedAt: new Date(),
    };

    try {
        const { db } = await connectToDatabase();
        if (isEditing && ObjectId.isValid(timesheetId!)) {
            await db.collection('crm_timesheets').updateOne(
                {
                    _id: new ObjectId(timesheetId!),
                    userId: new ObjectId(session.user._id),
                },
                { $set: payload },
            );
            revalidatePath('/dashboard/hrm/hr/timesheets');
            revalidatePath(`/dashboard/hrm/hr/timesheets/${timesheetId}`);
            return { message: 'Timesheet updated.', id: timesheetId };
        }
        payload.createdAt = new Date();
        const result = await db.collection('crm_timesheets').insertOne(payload);
        revalidatePath('/dashboard/hrm/hr/timesheets');
        return { message: 'Timesheet created.', id: result.insertedId.toString() };
    } catch (e) {
        return { error: `Failed to save timesheet: ${getErrorMessage(e)}` };
    }
}

export async function setCrmTimesheetStatus(
    id: string,
    status: CrmTimesheetStatus,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid id.' };
    if (!VALID_STATUSES.has(status)) {
        return { success: false, error: 'Invalid status.' };
    }

    const guard = await requirePermission('crm_attendance', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const update: Record<string, unknown> = {
            status,
            updatedAt: new Date(),
        };
        if (status === 'approved' || status === 'rejected') {
            update.approverId = new ObjectId(session.user._id);
            update.approvedAt = new Date();
        }
        await db.collection('crm_timesheets').updateOne(
            {
                _id: new ObjectId(id),
                userId: new ObjectId(session.user._id),
            },
            { $set: update },
        );
        revalidatePath('/dashboard/hrm/hr/timesheets');
        revalidatePath(`/dashboard/hrm/hr/timesheets/${id}`);
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function deleteCrmTimesheet(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid id.' };

    const guard = await requirePermission('crm_attendance', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        await db.collection('crm_timesheets').deleteOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id),
        });
        revalidatePath('/dashboard/hrm/hr/timesheets');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
