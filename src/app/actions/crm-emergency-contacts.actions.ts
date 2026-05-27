'use server';

/**
 * CRM Emergency Contacts — server-action wrappers around the legacy
 * `crm_emergency_contacts` Mongo collection.
 *
 * No Rust crate yet — direct Mongo reads/writes. Follows the same
 * shape as `crm-leave-balances.actions.ts`.
 *
 * Document shape (camelCase, per the task spec):
 * ```
 * {
 *   _id: ObjectId,
 *   userId: ObjectId,
 *   employeeId: ObjectId,
 *   name: string,
 *   relationship?: string,
 *   phone?: string,
 *   email?: string,
 *   address?: string,
 *   isPrimary?: boolean,
 *   notes?: string,
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

interface CrmEmergencyContactDoc {
    _id: string;
    userId: string;
    employeeId: string;
    name: string;
    relationship?: string;
    phone?: string;
    email?: string;
    address?: string;
    isPrimary?: boolean;
    notes?: string;
    createdAt?: string;
    updatedAt?: string;
}

interface CrmEmergencyContactListParams {
    employeeId?: string;
    q?: string;
    limit?: number;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function asString(v: FormDataEntryValue | null): string | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
}

function asBool(v: FormDataEntryValue | null): boolean {
    if (v == null) return false;
    const s = String(v).toLowerCase();
    return s === 'on' || s === 'true' || s === '1' || s === 'yes';
}

function toDoc(raw: WithId<Record<string, unknown>>): CrmEmergencyContactDoc {
    const j = JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
    return {
        _id: String(j._id),
        userId: String(j.userId),
        employeeId: String(j.employeeId ?? ''),
        name: String(j.name ?? ''),
        relationship: (j.relationship as string | undefined) ?? undefined,
        phone: (j.phone as string | undefined) ?? undefined,
        email: (j.email as string | undefined) ?? undefined,
        address: (j.address as string | undefined) ?? undefined,
        isPrimary: Boolean(j.isPrimary ?? false),
        notes: (j.notes as string | undefined) ?? undefined,
        createdAt: (j.createdAt as string | undefined) ?? undefined,
        updatedAt: (j.updatedAt as string | undefined) ?? undefined,
    };
}

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getCrmEmergencyContacts(
    filters?: CrmEmergencyContactListParams,
): Promise<CrmEmergencyContactDoc[]> {
    const session = await getSession();
    if (!session?.user) return [];

    const guard = await requirePermission('crm_emergency_contact', 'view');
    if (!guard.ok) return [];

    try {
        const { db } = await connectToDatabase();
        const q: Record<string, unknown> = {
            userId: new ObjectId(session.user._id),
        };
        if (filters?.employeeId && ObjectId.isValid(filters.employeeId)) {
            q.employeeId = new ObjectId(filters.employeeId);
        }
        if (filters?.q) {
            q.$or = [
                { name: { $regex: filters.q, $options: 'i' } },
                { relationship: { $regex: filters.q, $options: 'i' } },
                { phone: { $regex: filters.q, $options: 'i' } },
            ];
        }
        const docs = await db
            .collection('crm_emergency_contacts')
            .find(q)
            .sort({ isPrimary: -1, name: 1 })
            .limit(Math.min(Math.max(1, filters?.limit ?? 200), 1000))
            .toArray();
        return docs.map(toDoc);
    } catch (e) {
        console.error('[getCrmEmergencyContacts] failed:', getErrorMessage(e));
        return [];
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

export async function saveCrmEmergencyContact(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const contactId = asString(formData.get('contactId'));
    const isEditing = !!contactId;

    const guard = await requirePermission(
        'crm_emergency_contact',
        isEditing ? 'edit' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const employeeId = asString(formData.get('employeeId'));
    const name = asString(formData.get('name'));
    if (!employeeId || !ObjectId.isValid(employeeId)) {
        return { error: 'Employee is required.' };
    }
    if (!name) return { error: 'Contact name is required.' };

    const payload: Record<string, unknown> = {
        userId: new ObjectId(session.user._id),
        employeeId: new ObjectId(employeeId),
        name,
        relationship: asString(formData.get('relationship')),
        phone: asString(formData.get('phone')),
        email: asString(formData.get('email')),
        address: asString(formData.get('address')),
        isPrimary: asBool(formData.get('isPrimary')),
        notes: asString(formData.get('notes')),
        updatedAt: new Date(),
    };

    try {
        const { db } = await connectToDatabase();
        if (isEditing && ObjectId.isValid(contactId!)) {
            await db.collection('crm_emergency_contacts').updateOne(
                {
                    _id: new ObjectId(contactId!),
                    userId: new ObjectId(session.user._id),
                },
                { $set: payload },
            );
            revalidatePath(`/dashboard/hrm/payroll/employees/${employeeId}/emergency-contacts`);
            return { message: 'Emergency contact updated.', id: contactId };
        }
        payload.createdAt = new Date();
        const result = await db
            .collection('crm_emergency_contacts')
            .insertOne(payload);
        revalidatePath(`/dashboard/hrm/payroll/employees/${employeeId}/emergency-contacts`);
        return {
            message: 'Emergency contact created.',
            id: result.insertedId.toString(),
        };
    } catch (e) {
        return { error: `Failed to save emergency contact: ${getErrorMessage(e)}` };
    }
}

export async function deleteCrmEmergencyContact(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid id.' };

    const guard = await requirePermission('crm_emergency_contact', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        await db.collection('crm_emergency_contacts').deleteOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id),
        });
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
