'use server';

/**
 * CRM Visa Details — server-action wrappers around the legacy
 * `crm_visa_details` Mongo collection.
 *
 * No Rust crate yet — direct Mongo reads/writes.
 *
 * Document shape (camelCase, per the task spec):
 * ```
 * {
 *   _id: ObjectId,
 *   userId: ObjectId,
 *   employeeId: ObjectId,
 *   country: string,
 *   visaType: string,
 *   visaNumber?: string,
 *   issueDate?: Date,
 *   expiryDate?: Date,
 *   sponsor?: string,
 *   status: 'active' | 'expired' | 'cancelled' | 'archived',
 *   notes?: string,
 *   documentUrl?: string,   // SabFile URL — never free-text paste
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

type CrmVisaStatus = 'active' | 'expired' | 'cancelled' | 'archived';

interface CrmVisaDetailDoc {
    _id: string;
    userId: string;
    employeeId: string;
    country: string;
    visaType: string;
    visaNumber?: string;
    issueDate?: string;
    expiryDate?: string;
    sponsor?: string;
    status: CrmVisaStatus;
    notes?: string;
    documentUrl?: string;
    createdAt?: string;
    updatedAt?: string;
}

interface CrmVisaDetailListParams {
    employeeId?: string;
    status?: CrmVisaStatus | 'all';
    q?: string;
    limit?: number;
}

const VALID_STATUSES: ReadonlySet<CrmVisaStatus> = new Set<CrmVisaStatus>([
    'active',
    'expired',
    'cancelled',
    'archived',
]);

/* ─── Helpers ────────────────────────────────────────────────────────── */

function asString(v: FormDataEntryValue | null): string | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
}

function asDate(v: FormDataEntryValue | null): Date | undefined {
    const s = asString(v);
    if (!s) return undefined;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? undefined : d;
}

function asStatus(v: FormDataEntryValue | null): CrmVisaStatus {
    const s = asString(v);
    if (s && VALID_STATUSES.has(s as CrmVisaStatus)) return s as CrmVisaStatus;
    return 'active';
}

function toDoc(raw: WithId<Record<string, unknown>>): CrmVisaDetailDoc {
    const j = JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
    return {
        _id: String(j._id),
        userId: String(j.userId),
        employeeId: String(j.employeeId ?? ''),
        country: String(j.country ?? ''),
        visaType: String(j.visaType ?? ''),
        visaNumber: (j.visaNumber as string | undefined) ?? undefined,
        issueDate: (j.issueDate as string | undefined) ?? undefined,
        expiryDate: (j.expiryDate as string | undefined) ?? undefined,
        sponsor: (j.sponsor as string | undefined) ?? undefined,
        status: (j.status as CrmVisaStatus | undefined) ?? 'active',
        notes: (j.notes as string | undefined) ?? undefined,
        documentUrl: (j.documentUrl as string | undefined) ?? undefined,
        createdAt: (j.createdAt as string | undefined) ?? undefined,
        updatedAt: (j.updatedAt as string | undefined) ?? undefined,
    };
}

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getCrmVisaDetails(
    filters?: CrmVisaDetailListParams,
): Promise<CrmVisaDetailDoc[]> {
    const session = await getSession();
    if (!session?.user) return [];

    const guard = await requirePermission('crm_visa_detail', 'view');
    if (!guard.ok) return [];

    try {
        const { db } = await connectToDatabase();
        const q: Record<string, unknown> = {
            userId: new ObjectId(session.user._id),
        };
        if (filters?.employeeId && ObjectId.isValid(filters.employeeId)) {
            q.employeeId = new ObjectId(filters.employeeId);
        }
        if (filters?.status && filters.status !== 'all') {
            q.status = filters.status;
        }
        if (filters?.q) {
            q.$or = [
                { country: { $regex: filters.q, $options: 'i' } },
                { visaType: { $regex: filters.q, $options: 'i' } },
                { visaNumber: { $regex: filters.q, $options: 'i' } },
                { sponsor: { $regex: filters.q, $options: 'i' } },
            ];
        }
        const docs = await db
            .collection('crm_visa_details')
            .find(q)
            .sort({ expiryDate: 1 })
            .limit(Math.min(Math.max(1, filters?.limit ?? 200), 1000))
            .toArray();
        return docs.map(toDoc);
    } catch (e) {
        console.error('[getCrmVisaDetails] failed:', getErrorMessage(e));
        return [];
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

export async function saveCrmVisaDetail(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const visaId = asString(formData.get('visaId'));
    const isEditing = !!visaId;

    const guard = await requirePermission(
        'crm_visa_detail',
        isEditing ? 'edit' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const employeeId = asString(formData.get('employeeId'));
    const country = asString(formData.get('country'));
    const visaType = asString(formData.get('visaType'));
    if (!employeeId || !ObjectId.isValid(employeeId)) {
        return { error: 'Employee is required.' };
    }
    if (!country) return { error: 'Country is required.' };
    if (!visaType) return { error: 'Visa type is required.' };

    const payload: Record<string, unknown> = {
        userId: new ObjectId(session.user._id),
        employeeId: new ObjectId(employeeId),
        country,
        visaType,
        visaNumber: asString(formData.get('visaNumber')),
        issueDate: asDate(formData.get('issueDate')),
        expiryDate: asDate(formData.get('expiryDate')),
        sponsor: asString(formData.get('sponsor')),
        status: asStatus(formData.get('status')),
        notes: asString(formData.get('notes')),
        documentUrl: asString(formData.get('documentUrl')),
        updatedAt: new Date(),
    };

    try {
        const { db } = await connectToDatabase();
        if (isEditing && ObjectId.isValid(visaId!)) {
            await db.collection('crm_visa_details').updateOne(
                {
                    _id: new ObjectId(visaId!),
                    userId: new ObjectId(session.user._id),
                },
                { $set: payload },
            );
            revalidatePath(`/dashboard/hrm/payroll/employees/${employeeId}/visa-details`);
            return { message: 'Visa detail updated.', id: visaId };
        }
        payload.createdAt = new Date();
        const result = await db.collection('crm_visa_details').insertOne(payload);
        revalidatePath(`/dashboard/hrm/payroll/employees/${employeeId}/visa-details`);
        return {
            message: 'Visa detail created.',
            id: result.insertedId.toString(),
        };
    } catch (e) {
        return { error: `Failed to save visa detail: ${getErrorMessage(e)}` };
    }
}

export async function deleteCrmVisaDetail(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid id.' };

    const guard = await requirePermission('crm_visa_detail', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        await db.collection('crm_visa_details').deleteOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id),
        });
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
