'use server';

/**
 * CRM Vendor-Type master server actions.
 *
 * Settings-style master used to classify CRM vendors
 * (Supplier, Service Provider, Contractor, ...). Surface at:
 *   `/dashboard/crm/purchases/vendors/types`.
 *
 * Dual implementation:
 *   - When `USE_RUST_CRM === 'true'`, every action delegates to the Rust BFF
 *     (`/v1/crm/vendor-types`) via `src/lib/rust-client/crm-vendor-types.ts`.
 *   - Otherwise (default), the legacy direct-Mongo path runs against
 *     `crm_vendor_types`.
 *
 * Export shapes follow the `<SettingsEntityShell>` contract:
 *   - getAllAction(): Promise<T[]>
 *   - saveAction(prev, formData): Promise<{ message?, error?, id? }>
 *   - deleteAction(id): Promise<{ success, error? }>
 *
 * RBAC: `crm_vendor_type` module key.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
    crmVendorTypesApi,
    type CrmVendorTypeDoc,
    type CrmVendorTypeStatus,
} from '@/lib/rust-client/crm-vendor-types';
import { getErrorMessage } from '@/lib/utils';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

function asString(v: FormDataEntryValue | null): string | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
}

function asBool(v: FormDataEntryValue | null): boolean | undefined {
    if (v == null) return undefined;
    const s = String(v).trim().toLowerCase();
    if (s === 'true' || s === 'on' || s === '1') return true;
    if (s === 'false' || s === 'off' || s === '0' || s === '') return false;
    return undefined;
}

function revalidateSurfaces(): void {
    revalidatePath('/dashboard/crm/purchases/vendors');
    revalidatePath('/dashboard/crm/purchases/vendors/types');
    revalidatePath('/dashboard/crm/purchases/vendors/new');
}

/* ─── Shape returned to <SettingsEntityShell> ────────────────────────── */

interface CrmVendorTypeRow {
    _id: string;
    name: string;
    code?: string;
    description?: string;
    isActive: boolean;
    status: CrmVendorTypeStatus;
    createdAt?: string;
    updatedAt?: string;
}

function rustToRow(doc: CrmVendorTypeDoc): CrmVendorTypeRow {
    return {
        _id: String(doc._id),
        name: doc.name,
        code: doc.code,
        description: doc.description,
        isActive: doc.isActive ?? true,
        status: doc.status ?? 'active',
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
}

function legacyToRow(d: Record<string, unknown>): CrmVendorTypeRow {
    const status = ((d.status as string) || 'active') as CrmVendorTypeStatus;
    return {
        _id: String(d._id),
        name: String(d.name ?? ''),
        code: typeof d.code === 'string' ? d.code : undefined,
        description: typeof d.description === 'string' ? d.description : undefined,
        isActive: d.isActive === undefined ? status === 'active' : Boolean(d.isActive),
        status,
        createdAt: d.createdAt instanceof Date
            ? d.createdAt.toISOString()
            : (typeof d.createdAt === 'string' ? d.createdAt : undefined),
        updatedAt: d.updatedAt instanceof Date
            ? d.updatedAt.toISOString()
            : (typeof d.updatedAt === 'string' ? d.updatedAt : undefined),
    };
}

/* ─── List ────────────────────────────────────────────────────────────── */

export async function getCrmVendorTypeRows(): Promise<CrmVendorTypeRow[]> {
    const session = await getSession();
    if (!session?.user) return [];

    const guard = await requirePermission('crm_vendor_type', 'view');
    if (!guard.ok) return [];

    if (useRustCrm()) {
        try {
            const res = await crmVendorTypesApi.list({ limit: 200 });
            return (res.items ?? []).map(rustToRow);
        } catch (e) {
            console.error('[getCrmVendorTypeRows] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'vendor_type',
                op: 'list',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const docs = await db
            .collection('crm_vendor_types')
            .find({ userId: new ObjectId(session.user._id as string) })
            .sort({ name: 1 })
            .toArray();
        return docs.map((d) => legacyToRow(d as Record<string, unknown>));
    } catch (e) {
        console.error('Failed to fetch CRM vendor types:', e);
        return [];
    }
}

/* ─── Save (create + edit) ───────────────────────────────────────────── */

export async function saveCrmVendorTypeRow(
    _prev: any,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const idRaw = asString(formData.get('_id'));
    const isEditing = !!idRaw;

    const guard = await requirePermission(
        'crm_vendor_type',
        isEditing ? 'edit' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const name = asString(formData.get('name'));
    if (!name) return { error: 'Vendor type name is required.' };

    const code = asString(formData.get('code'));
    const description = asString(formData.get('description'));
    const parentId = asString(formData.get('parentId')) || null;
    const isActive = asBool(formData.get('isActive')) ?? true;
    const status = (asString(formData.get('status')) as CrmVendorTypeStatus | undefined)
        ?? (isActive ? 'active' : 'archived');

    if (useRustCrm()) {
        try {
            if (isEditing && idRaw) {
                const updated = await crmVendorTypesApi.update(idRaw, {
                    name,
                    code,
                    description,
                    isActive,
                    status,
                });
                revalidateSurfaces();
                return {
                    message: `Vendor type "${name}" saved.`,
                    id: String(updated._id),
                };
            }
            const { id } = await crmVendorTypesApi.create({
                name,
                code,
                description,
                isActive,
            });
            revalidateSurfaces();
            return { message: `Vendor type "${name}" created.`, id };
        } catch (e) {
            console.error('[saveCrmVendorTypeRow] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'vendor_type',
                op: isEditing ? 'update' : 'create',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const now = new Date();
        const baseDoc = {
            userId: new ObjectId(session.user._id as string),
            name,
            ...(code ? { code } : { code: '' }),
            ...(description ? { description } : { description: '' }),
            parentId,
            isActive,
            status,
            updatedAt: now,
        };

        if (isEditing && idRaw && ObjectId.isValid(idRaw)) {
            await db.collection('crm_vendor_types').updateOne(
                {
                    _id: new ObjectId(idRaw),
                    userId: new ObjectId(session.user._id as string),
                },
                { $set: baseDoc },
            );
            revalidateSurfaces();
            return { message: `Vendor type "${name}" saved.`, id: idRaw };
        }

        const res = await db
            .collection('crm_vendor_types')
            .insertOne({ ...baseDoc, createdAt: now });
        revalidateSurfaces();
        return { message: `Vendor type "${name}" created.`, id: res.insertedId.toString() };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

/* ─── Delete ─────────────────────────────────────────────────────────── */

export async function deleteCrmVendorTypeRow(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    const guard = await requirePermission('crm_vendor_type', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    if (!id) return { success: false, error: 'Invalid vendor type id.' };

    if (useRustCrm()) {
        try {
            await crmVendorTypesApi.delete(id);
            revalidateSurfaces();
            return { success: true };
        } catch (e) {
            console.error('[deleteCrmVendorTypeRow] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'vendor_type',
                op: 'delete',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid vendor type id.' };

    try {
        const { db } = await connectToDatabase();
        const res = await db.collection('crm_vendor_types').deleteOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id as string),
        });
        if (res.deletedCount === 0) {
            return { success: false, error: 'Vendor type not found.' };
        }
        revalidateSurfaces();
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/* ─── Single get (for detail / form pre-fill) ────────────────────────── */

export async function getCrmVendorTypeRowById(
    id: string,
): Promise<WithId<CrmVendorTypeRow> | null> {
    if (!id) return null;
    const session = await getSession();
    if (!session?.user) return null;

    const guard = await requirePermission('crm_vendor_type', 'view');
    if (!guard.ok) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmVendorTypesApi.getById(id);
            return rustToRow(doc) as unknown as WithId<CrmVendorTypeRow>;
        } catch (e) {
            if (e instanceof RustApiError && e.status === 404) return null;
            console.error('[getCrmVendorTypeRowById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'vendor_type',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    if (!ObjectId.isValid(id)) return null;

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('crm_vendor_types').findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id as string),
        });
        if (!doc) return null;
        return legacyToRow(doc as Record<string, unknown>) as unknown as WithId<CrmVendorTypeRow>;
    } catch (e) {
        console.error('Failed to fetch vendor type:', e);
        return null;
    }
}

export async function updateVendorTypeOrder(orders: { id: string; parentId: string | null; sortOrder: number }[]) {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    try {
        const { db } = await connectToDatabase();
        
        for (const item of orders) {
            await db.collection('crm_vendor_types').updateOne(
                { _id: new ObjectId(item.id), userId: new ObjectId(session.user._id as string) },
                { $set: { parentId: item.parentId, sortOrder: item.sortOrder } }
            );
        }
        revalidateSurfaces();
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
