'use server';

/**
 * Warehouse server actions — §1D rebuild.
 *
 * List filters + KPIs + bulk operations, set-default / archive /
 * restore flows, and an inventory summary lookup for the detail page.
 *
 * The save action keeps backwards-compat with the legacy form (which
 * posts `location` → `address` and only `name`/`isDefault`). All new
 * fields are optional and additive.
 *
 * **Dual implementation:**
 *  - When `USE_RUST_CRM === 'true'`, CRUD operations delegate to the
 *    Rust BFF (`/v1/crm/warehouses`) via
 *    `src/lib/rust-client/crm-warehouses.ts`.
 *  - `getCrmWarehouseKpis`, `getCrmWarehouseInventorySummary`,
 *    `getCrmWarehouseStockByItem`, `getCrmWarehousesPaginated`, and
 *    `setDefaultCrmWarehouse` remain Mongo-only — no matching Rust
 *    endpoints exist yet.
 *    TODO: add Rust path when crm-warehouses router exposes KPI + pagination + set-default endpoints.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type {
    CrmWarehouse,
    CrmWarehouseType,
    CrmWarehouseStatus,
} from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { writeAuditEntry } from '@/lib/audit-log';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { requirePermission } from '@/lib/rbac-server';
import { crmWarehousesApi } from '@/lib/rust-client/crm-warehouses';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

/* ─── Types ────────────────────────────────────────────────────────── */

interface CrmWarehouseFilters {
    type?: CrmWarehouseType | '';
    status?: CrmWarehouseStatus | '';
    managerId?: string;
    country?: string;
    state?: string;
    city?: string;
    isDefault?: 'yes' | 'no' | '';
    includeArchived?: boolean;
}

interface CrmWarehouseKpis {
    total: number;
    active: number;
    climateControlled: number;
    byType: Array<{ type: string; count: number }>;
}

interface CrmWarehouseInventorySummary {
    itemsCount: number;
    totalStock: number;
    totalValue: number;
}

/** Single row for the "Stock by item" sub-table on warehouse detail. */
interface CrmWarehouseStockRow {
    productId: string;
    sku?: string;
    name: string;
    stock: number;
    reorderPoint?: number;
    costPrice?: number;
    value: number;
}

const EMPTY_KPIS: CrmWarehouseKpis = {
    total: 0,
    active: 0,
    climateControlled: 0,
    byType: [],
};

/* ─── Reads ────────────────────────────────────────────────────────── */

export async function getCrmWarehouseById(
    warehouseId: string,
): Promise<WithId<CrmWarehouse> | null> {
    if (!warehouseId) return null;
    const session = await getSession();
    if (!session?.user) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmWarehousesApi.getById(warehouseId);
            return doc ? (JSON.parse(JSON.stringify(doc)) as WithId<CrmWarehouse>) : null;
        } catch (e) {
            console.error('[getCrmWarehouseById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'warehouse',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }

    if (!ObjectId.isValid(warehouseId)) return null;
    try {
        const { db } = await connectToDatabase();
        const warehouse = await db
            .collection<CrmWarehouse>('crm_warehouses')
            .findOne({
                _id: new ObjectId(warehouseId),
                userId: new ObjectId(session.user._id),
            });
        return warehouse ? JSON.parse(JSON.stringify(warehouse)) : null;
    } catch (e) {
        console.error('Failed to fetch CRM warehouse:', e);
        recordRustFallback({ entity: 'warehouse', op: 'get' });
        return null;
    }
}

export async function getCrmWarehouses(): Promise<WithId<CrmWarehouse>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    if (useRustCrm()) {
        try {
            const res = await crmWarehousesApi.list({ limit: 200 });
            return JSON.parse(JSON.stringify(res.items)) as WithId<CrmWarehouse>[];
        } catch (e) {
            console.error('[getCrmWarehouses] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'warehouse',
                op: 'list',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }

    try {
        const { db } = await connectToDatabase();
        const warehouses = await db
            .collection<CrmWarehouse>('crm_warehouses')
            .find({
                userId: new ObjectId(session.user._id),
                archived: { $ne: true },
            })
            .sort({ isDefault: -1, name: 1 })
            .toArray();
        return JSON.parse(JSON.stringify(warehouses));
    } catch (e) {
        console.error('Failed to fetch CRM warehouses:', e);
        recordRustFallback({ entity: 'warehouse', op: 'list' });
        return [];
    }
}

export async function getCrmWarehousesPaginated(
    page = 1,
    limit = 20,
    search = '',
    filters: CrmWarehouseFilters = {},
): Promise<{ warehouses: WithId<CrmWarehouse>[]; total: number }> {
    const session = await getSession();
    if (!session?.user) return { warehouses: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const query: Record<string, unknown> = {
            userId: new ObjectId(session.user._id),
        };

        if (!filters.includeArchived) query.archived = { $ne: true };
        if (filters.type) query.type = filters.type;
        if (filters.status) query.status = filters.status;
        if (filters.managerId && ObjectId.isValid(filters.managerId)) {
            query.managerId = new ObjectId(filters.managerId);
        }
        if (filters.country) query.country = filters.country;
        if (filters.state) query.state = filters.state;
        if (filters.city) query.city = filters.city;
        if (filters.isDefault === 'yes') query.isDefault = true;
        else if (filters.isDefault === 'no') query.isDefault = { $ne: true };

        if (search.trim()) {
            const rx = new RegExp(
                search.trim().replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'),
                'i',
            );
            (query as any).$or = [{ name: rx }, { code: rx }, { city: rx }];
        }

        const cursor = db.collection<CrmWarehouse>('crm_warehouses').find(query);
        const total = await cursor.clone().count();
        const warehouses = await cursor
            .sort({ isDefault: -1, name: 1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .toArray();

        return {
            warehouses: JSON.parse(JSON.stringify(warehouses)),
            total,
        };
    } catch (e) {
        console.error('Failed to fetch paginated CRM warehouses:', e);
        recordRustFallback({ entity: 'warehouse', op: 'list' });
        return { warehouses: [], total: 0 };
    }
}

export async function getCrmWarehouseKpis(): Promise<CrmWarehouseKpis> {
    const session = await getSession();
    if (!session?.user) return EMPTY_KPIS;

    try {
        const { db } = await connectToDatabase();
        const base = {
            userId: new ObjectId(session.user._id),
            archived: { $ne: true },
        };

        const [total, active, climateControlled, byType] = await Promise.all([
            db.collection('crm_warehouses').countDocuments(base),
            db.collection('crm_warehouses').countDocuments({
                ...base,
                $or: [{ status: 'active' }, { status: { $exists: false } }],
            }),
            db.collection('crm_warehouses').countDocuments({
                ...base,
                climateControlled: true,
            }),
            db
                .collection('crm_warehouses')
                .aggregate([
                    { $match: base },
                    {
                        $group: {
                            _id: { $ifNull: ['$type', 'main'] },
                            count: { $sum: 1 },
                        },
                    },
                    { $sort: { count: -1 } },
                ])
                .toArray(),
        ]);

        return {
            total,
            active,
            climateControlled,
            byType: byType.map((b) => ({ type: String(b._id), count: b.count })),
        };
    } catch (e) {
        console.error('Failed to compute warehouse KPIs:', e);
        recordRustFallback({ entity: 'warehouse', op: 'other' });
        return EMPTY_KPIS;
    }
}

export async function getCrmWarehouseInventorySummary(
    warehouseId: string,
): Promise<CrmWarehouseInventorySummary> {
    const empty: CrmWarehouseInventorySummary = {
        itemsCount: 0,
        totalStock: 0,
        totalValue: 0,
    };
    if (!warehouseId || !ObjectId.isValid(warehouseId)) return empty;
    const session = await getSession();
    if (!session?.user) return empty;

    try {
        const { db } = await connectToDatabase();
        const result = await db
            .collection('crm_products')
            .aggregate([
                {
                    $match: {
                        userId: new ObjectId(session.user._id),
                        'inventory.warehouseId': new ObjectId(warehouseId),
                    },
                },
                { $unwind: '$inventory' },
                {
                    $match: {
                        'inventory.warehouseId': new ObjectId(warehouseId),
                    },
                },
                {
                    $group: {
                        _id: null,
                        itemsCount: { $sum: 1 },
                        totalStock: { $sum: { $ifNull: ['$inventory.stock', 0] } },
                        totalValue: {
                            $sum: {
                                $multiply: [
                                    { $ifNull: ['$inventory.stock', 0] },
                                    { $ifNull: ['$costPrice', 0] },
                                ],
                            },
                        },
                    },
                },
            ])
            .toArray();

        if (result.length === 0) return empty;
        return {
            itemsCount: result[0].itemsCount || 0,
            totalStock: result[0].totalStock || 0,
            totalValue: result[0].totalValue || 0,
        };
    } catch (e) {
        console.error('Failed to compute warehouse inventory summary:', e);
        recordRustFallback({ entity: 'warehouse', op: 'other' });
        return empty;
    }
}

/**
 * Per-item stock rows for a warehouse — drives the "Stock by item"
 * sub-table on the warehouse detail page (§1D bar).
 *
 * Mongo-only path; mirrors the aggregation used by
 * `getCrmWarehouseInventorySummary` but emits a row per product instead
 * of a single rollup. `limit` caps the table at 50 rows by default.
 */
export async function getCrmWarehouseStockByItem(
    warehouseId: string,
    limit = 50,
): Promise<CrmWarehouseStockRow[]> {
    if (!warehouseId || !ObjectId.isValid(warehouseId)) return [];
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const cap = Math.min(Math.max(1, limit), 200);
        const rows = await db
            .collection('crm_products')
            .aggregate([
                {
                    $match: {
                        userId: new ObjectId(session.user._id),
                        'inventory.warehouseId': new ObjectId(warehouseId),
                    },
                },
                { $unwind: '$inventory' },
                {
                    $match: {
                        'inventory.warehouseId': new ObjectId(warehouseId),
                    },
                },
                {
                    $project: {
                        _id: 1,
                        sku: 1,
                        name: 1,
                        costPrice: 1,
                        stock: { $ifNull: ['$inventory.stock', 0] },
                        reorderPoint: '$inventory.reorderPoint',
                    },
                },
                { $sort: { stock: -1, name: 1 } },
                { $limit: cap },
            ])
            .toArray();

        return rows.map((r) => {
            const stock = Number(r.stock ?? 0);
            const cost = Number(r.costPrice ?? 0);
            return {
                productId: String(r._id),
                sku: r.sku ? String(r.sku) : undefined,
                name: String(r.name ?? '—'),
                stock,
                reorderPoint:
                    typeof r.reorderPoint === 'number'
                        ? r.reorderPoint
                        : undefined,
                costPrice: cost || undefined,
                value: stock * cost,
            };
        });
    } catch (e) {
        console.error('Failed to compute warehouse stock-by-item:', e);
        recordRustFallback({ entity: 'warehouse', op: 'other' });
        return [];
    }
}

/* ─── Writes ───────────────────────────────────────────────────────── */

export async function saveCrmWarehouse(
    _prevState: unknown,
    formData: FormData,
): Promise<{ message?: string; error?: string; warehouse?: CrmWarehouse }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const warehouseId = formData.get('warehouseId') as string | null;
    const isEditing = !!warehouseId;

    const guard = await requirePermission('crm_warehouse', isEditing ? 'edit' : 'create');
    if (!guard.ok) return { error: guard.error };

    if (useRustCrm()) {
        try {
            const name = ((formData.get('name') as string | null) || '').trim();
            if (!name) return { error: 'Warehouse name is required.' };

            const strOrUndef = (k: string, alt?: string): string | undefined => {
                const v =
                    (formData.get(k) as string | null) ??
                    (alt ? (formData.get(alt) as string | null) : null);
                return v || undefined;
            };
            const numberOrUndef = (k: string): number | undefined => {
                const raw = formData.get(k);
                if (raw == null || String(raw).trim() === '') return undefined;
                const n = Number(raw);
                return Number.isFinite(n) ? n : undefined;
            };

            const payload = {
                name,
                code: (formData.get('code') as string | null)?.trim() || undefined,
                type: strOrUndef('type') as any,
                status: strOrUndef('status') as any,
                address: strOrUndef('address', 'location'),
                city: strOrUndef('city'),
                state: strOrUndef('state'),
                country: strOrUndef('country'),
                pincode: strOrUndef('pincode'),
                phone: strOrUndef('phone'),
                managerId: strOrUndef('managerId'),
                managerName: strOrUndef('managerName'),
                gstin: strOrUndef('gstin'),
                capacityUnits: numberOrUndef('capacityUnits'),
                capacitySqft: numberOrUndef('capacitySqft'),
                climateControlled: formData.get('climateControlled') === 'on',
                isDefault: formData.get('isDefault') === 'on',
            };

            if (isEditing && warehouseId) {
                const doc = await crmWarehousesApi.update(warehouseId, payload);
                revalidatePath('/dashboard/crm/inventory/warehouses');
                return {
                    message: `Warehouse "${name}" saved successfully!`,
                    warehouse: JSON.parse(JSON.stringify(doc)) as CrmWarehouse,
                };
            }

            const res = await crmWarehousesApi.create(payload);
            revalidatePath('/dashboard/crm/inventory/warehouses');
            return {
                message: `Warehouse "${name}" saved successfully!`,
                warehouse: res.entity
                    ? (JSON.parse(JSON.stringify(res.entity)) as CrmWarehouse)
                    : undefined,
            };
        } catch (e) {
            console.error('[saveCrmWarehouse] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'warehouse',
                op: isEditing ? 'update' : 'create',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }

    try {
        const userId = new ObjectId(session.user._id);
        const name = (formData.get('name') as string)?.trim();
        if (!name) return { error: 'Warehouse name is required.' };

        const managerIdRaw = formData.get('managerId') as string | null;
        const managerObjectId =
            managerIdRaw && ObjectId.isValid(managerIdRaw)
                ? new ObjectId(managerIdRaw)
                : undefined;

        const numberOrUndef = (k: string): number | undefined => {
            const raw = formData.get(k);
            if (raw == null || String(raw).trim() === '') return undefined;
            const n = Number(raw);
            return Number.isFinite(n) ? n : undefined;
        };
        const strOrUndef = (k: string, alt?: string): string | undefined => {
            const v =
                (formData.get(k) as string | null) ??
                (alt ? (formData.get(alt) as string | null) : null);
            return v || undefined;
        };

        const warehouseData: Partial<CrmWarehouse> = {
            userId,
            name,
            code: (formData.get('code') as string | null)?.trim() || undefined,
            type: (strOrUndef('type') as CrmWarehouseType) || undefined,
            status: (strOrUndef('status') as CrmWarehouseStatus) || undefined,
            // Accept either legacy `location` or new `address`.
            address: strOrUndef('address', 'location'),
            city: strOrUndef('city'),
            state: strOrUndef('state'),
            country: strOrUndef('country'),
            pincode: strOrUndef('pincode'),
            phone: strOrUndef('phone'),
            managerId: managerObjectId,
            managerName: strOrUndef('managerName'),
            gstin: strOrUndef('gstin'),
            capacityUnits: numberOrUndef('capacityUnits'),
            capacitySqft: numberOrUndef('capacitySqft'),
            climateControlled: formData.get('climateControlled') === 'on',
            isDefault: formData.get('isDefault') === 'on',
            updatedAt: new Date(),
        };

        const { db } = await connectToDatabase();
        if (warehouseData.isDefault) {
            await db
                .collection('crm_warehouses')
                .updateMany({ userId }, { $set: { isDefault: false } });
        }

        let resultWarehouse: CrmWarehouse;

        if (isEditing && ObjectId.isValid(warehouseId)) {
            await db.collection('crm_warehouses').updateOne(
                { _id: new ObjectId(warehouseId), userId },
                { $set: warehouseData },
            );
            resultWarehouse = {
                ...warehouseData,
                _id: new ObjectId(warehouseId),
            } as CrmWarehouse;

            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'update',
                entityKind: 'warehouse',
                entityId: warehouseId,
                reason: `Updated warehouse "${name}"`,
            });
        } else {
            warehouseData.createdAt = new Date();
            warehouseData.status = warehouseData.status ?? 'active';
            const res = await db
                .collection('crm_warehouses')
                .insertOne(warehouseData as CrmWarehouse);
            resultWarehouse = {
                ...warehouseData,
                _id: res.insertedId,
            } as CrmWarehouse;

            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'create',
                entityKind: 'warehouse',
                entityId: String(res.insertedId),
                reason: `Created warehouse "${name}"`,
            });
        }

        revalidatePath('/dashboard/crm/inventory/warehouses');
        return {
            message: `Warehouse "${name}" saved successfully!`,
            warehouse: JSON.parse(JSON.stringify(resultWarehouse)),
        };
    } catch (e) {
        recordRustFallback({
            entity: 'warehouse',
            op: isEditing ? 'update' : 'create',
        });
        return { error: getErrorMessage(e) };
    }
}

async function setArchiveState(
    warehouseId: string,
    archived: boolean,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    const guard = await requirePermission('crm_warehouse', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    if (!warehouseId) return { success: false, error: 'Invalid warehouse id.' };

    if (useRustCrm()) {
        try {
            await crmWarehousesApi.update(warehouseId, { archived });
            revalidatePath('/dashboard/crm/inventory/warehouses');
            return { success: true };
        } catch (e) {
            console.error('[setArchiveState] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'warehouse',
                op: 'update',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }

    if (!ObjectId.isValid(warehouseId))
        return { success: false, error: 'Invalid warehouse id.' };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        if (archived) {
            const w = await db.collection('crm_warehouses').findOne({
                _id: new ObjectId(warehouseId),
                userId,
            });
            if (!w) return { success: false, error: 'Warehouse not found.' };
            if (w.isDefault)
                return {
                    success: false,
                    error: 'Cannot archive the default warehouse. Set another default first.',
                };
        }

        await db.collection('crm_warehouses').updateOne(
            { _id: new ObjectId(warehouseId), userId },
            {
                $set: {
                    archived,
                    status: archived ? 'archived' : 'active',
                    updatedAt: new Date(),
                },
            },
        );

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: archived ? 'archive' : 'restore',
            entityKind: 'warehouse',
            entityId: warehouseId,
        });

        revalidatePath('/dashboard/crm/inventory/warehouses');
        return { success: true };
    } catch (e) {
        recordRustFallback({ entity: 'warehouse', op: 'update' });
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function archiveCrmWarehouse(warehouseId: string) {
    return setArchiveState(warehouseId, true);
}

export async function unarchiveCrmWarehouse(warehouseId: string) {
    return setArchiveState(warehouseId, false);
}

export async function setDefaultCrmWarehouse(
    warehouseId: string,
): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(warehouseId))
        return { success: false, error: 'Invalid warehouse id.' };
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    const guard = await requirePermission('crm_warehouse', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        await db.collection('crm_warehouses').updateMany(
            { userId },
            { $set: { isDefault: false } },
        );
        const r = await db.collection('crm_warehouses').updateOne(
            { _id: new ObjectId(warehouseId), userId },
            { $set: { isDefault: true, updatedAt: new Date() } },
        );
        if (r.matchedCount === 0)
            return { success: false, error: 'Warehouse not found.' };

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'status_change',
            entityKind: 'warehouse',
            entityId: warehouseId,
            reason: 'Marked as default warehouse',
        });

        revalidatePath('/dashboard/crm/inventory/warehouses');
        return { success: true };
    } catch (e) {
        recordRustFallback({ entity: 'warehouse', op: 'update' });
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function deleteCrmWarehouse(
    warehouseId: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    const guard = await requirePermission('crm_warehouse', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    if (!warehouseId) return { success: false, error: 'Invalid Warehouse ID.' };

    if (useRustCrm()) {
        try {
            await crmWarehousesApi.delete(warehouseId);
            revalidatePath('/dashboard/crm/inventory/warehouses');
            revalidatePath('/dashboard/crm/products');
            return { success: true };
        } catch (e) {
            console.error('[deleteCrmWarehouse] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'warehouse',
                op: 'delete',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }

    if (!ObjectId.isValid(warehouseId))
        return { success: false, error: 'Invalid Warehouse ID.' };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const warehouse = await db.collection('crm_warehouses').findOne({
            _id: new ObjectId(warehouseId),
            userId,
        });
        if (!warehouse)
            return {
                success: false,
                error: 'Warehouse not found or you do not have permission.',
            };
        if (warehouse.isDefault)
            return {
                success: false,
                error: 'Cannot delete the default warehouse.',
            };

        const stockCheck = await db.collection('crm_products').findOne({
            userId,
            'inventory.warehouseId': warehouse._id,
            'inventory.stock': { $gt: 0 },
        });
        if (stockCheck) {
            return {
                success: false,
                error: 'Cannot delete warehouse with stock. Please adjust inventory first.',
            };
        }

        await db
            .collection('crm_warehouses')
            .deleteOne({ _id: new ObjectId(warehouseId) });
        await db.collection('crm_products').updateMany(
            { userId },
            {
                $pull: {
                    inventory: { warehouseId: new ObjectId(warehouseId) },
                },
            } as any,
        );

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'delete',
            entityKind: 'warehouse',
            entityId: warehouseId,
        });

        revalidatePath('/dashboard/crm/inventory/warehouses');
        revalidatePath('/dashboard/crm/products');
        return { success: true };
    } catch (e) {
        recordRustFallback({ entity: 'warehouse', op: 'delete' });
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function bulkWarehouseAction(
    ids: string[],
    op: 'archive' | 'restore' | 'delete',
): Promise<{ success: boolean; processed: number; error?: string }> {
    if (!Array.isArray(ids) || ids.length === 0)
        return {
            success: false,
            processed: 0,
            error: 'No warehouses selected.',
        };
    const session = await getSession();
    if (!session?.user)
        return { success: false, processed: 0, error: 'Access denied.' };
    const guard = await requirePermission(
        'crm_warehouse',
        op === 'delete' ? 'delete' : 'edit',
    );
    if (!guard.ok)
        return { success: false, processed: 0, error: guard.error };

    let processed = 0;
    for (const id of ids) {
        if (!ObjectId.isValid(id)) continue;
        let res: { success: boolean; error?: string };
        if (op === 'archive') res = await archiveCrmWarehouse(id);
        else if (op === 'restore') res = await unarchiveCrmWarehouse(id);
        else res = await deleteCrmWarehouse(id);
        if (res.success) processed += 1;
    }

    return { success: processed > 0, processed };
}
