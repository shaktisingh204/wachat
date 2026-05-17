/**
 * Bulk-import adapter — CRM Items / Products (§5.9).
 *
 * Dedup defaults to SKU (case-insensitive).
 */

import 'server-only';

import { ObjectId } from 'mongodb';

import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { connectToDatabase } from '@/lib/mongodb';
import { requirePermission } from '@/lib/rbac-server';
import type {
    BulkImportAdapterSpec,
    BulkImportField,
    DedupeBuckets,
    ExecuteOptions,
    ExecuteResult,
    NormalizeResult,
} from './types';

export interface ItemImportRow {
    name: string;
    sku: string;
    description?: string;
    costPrice: number;
    sellingPrice: number;
    taxRate?: number;
    currency: string;
    hsnSac?: string;
    itemType?: 'goods' | 'service';
    totalStock?: number;
}

const SCHEMA: BulkImportField[] = [
    { field: 'name', label: 'Item name', required: true },
    { field: 'sku', label: 'SKU', required: true },
    { field: 'description', label: 'Description', required: false },
    {
        field: 'costPrice',
        label: 'Cost price',
        required: true,
        validator: (v) =>
            v && !Number.isFinite(Number(v)) ? 'Not a number' : null,
    },
    {
        field: 'sellingPrice',
        label: 'Selling price',
        required: true,
        validator: (v) =>
            v && !Number.isFinite(Number(v)) ? 'Not a number' : null,
    },
    {
        field: 'taxRate',
        label: 'Tax %',
        required: false,
        validator: (v) =>
            v && !Number.isFinite(Number(v)) ? 'Not a number' : null,
    },
    { field: 'currency', label: 'Currency (ISO)', required: false },
    { field: 'hsnSac', label: 'HSN/SAC', required: false },
    { field: 'itemType', label: 'Type (goods/service)', required: false },
    {
        field: 'totalStock',
        label: 'Opening stock',
        required: false,
        validator: (v) =>
            v && !Number.isFinite(Number(v)) ? 'Not a number' : null,
    },
];

function trimOrUndef(v: string | undefined): string | undefined {
    if (typeof v !== 'string') return undefined;
    const t = v.trim();
    return t.length === 0 ? undefined : t;
}

function asNumber(v: string | undefined, fallback?: number): number | undefined {
    const t = trimOrUndef(v);
    if (!t) return fallback;
    const n = Number(t);
    return Number.isFinite(n) ? n : fallback;
}

function normalize(row: Record<string, string>): NormalizeResult<ItemImportRow> {
    const name = trimOrUndef(row.name);
    const sku = trimOrUndef(row.sku);
    if (!name) return { ok: false, error: 'Missing "name"' };
    if (!sku) return { ok: false, error: 'Missing "sku"' };
    const costPrice = asNumber(row.costPrice, 0)!;
    const sellingPrice = asNumber(row.sellingPrice, 0)!;
    const taxRate = asNumber(row.taxRate);
    const totalStock = asNumber(row.totalStock);
    const itemTypeRaw = (trimOrUndef(row.itemType) ?? '').toLowerCase();
    const itemType: 'goods' | 'service' | undefined =
        itemTypeRaw === 'service'
            ? 'service'
            : itemTypeRaw === 'goods'
              ? 'goods'
              : undefined;

    return {
        ok: true,
        value: {
            name,
            sku,
            description: trimOrUndef(row.description),
            costPrice,
            sellingPrice,
            taxRate,
            currency: (trimOrUndef(row.currency) ?? 'INR').toUpperCase(),
            hsnSac: trimOrUndef(row.hsnSac),
            itemType,
            totalStock,
        },
    };
}

function keyOf(row: ItemImportRow, field: string): string {
    if (field === 'name') return (row.name ?? '').toLowerCase();
    return (row.sku ?? '').toLowerCase();
}

function dedupe(
    rows: ItemImportRow[],
    existing: ItemImportRow[],
    dedupField: string = 'sku',
): DedupeBuckets<ItemImportRow> {
    const out: DedupeBuckets<ItemImportRow> = {
        toCreate: [],
        toUpdate: [],
        skipped: [],
    };
    const existingMap = new Map<string, ItemImportRow & { _id?: string }>();
    for (const e of existing) {
        const k = keyOf(e, dedupField);
        if (k) existingMap.set(k, e as ItemImportRow & { _id?: string });
    }
    const seenInFile = new Set<string>();
    for (const r of rows) {
        const k = keyOf(r, dedupField);
        if (k && seenInFile.has(k)) {
            out.skipped.push({ value: r, reason: 'Duplicate within file' });
            continue;
        }
        if (k) seenInFile.add(k);
        if (k && existingMap.has(k)) {
            const ex = existingMap.get(k)!;
            out.toUpdate.push({
                value: r,
                existingId: String((ex as { _id?: unknown })._id ?? ''),
            });
        } else {
            out.toCreate.push(r);
        }
    }
    return out;
}

async function execute(
    rows: ItemImportRow[],
    options?: ExecuteOptions,
): Promise<ExecuteResult> {
    const result: ExecuteResult = { created: 0, updated: 0, skipped: 0, errors: [] };
    const session = await getSession();
    if (!session?.user) {
        result.errors.push({ rowIndex: 0, error: 'Authentication required.' });
        return result;
    }
    const createGuard = await requirePermission('crm_product', 'create');
    if (!createGuard.ok) {
        result.errors.push({ rowIndex: 0, error: createGuard.error });
        return result;
    }
    const updateExisting = options?.updateExisting === true;
    if (updateExisting) {
        const editGuard = await requirePermission('crm_product', 'edit');
        if (!editGuard.ok) {
            result.errors.push({ rowIndex: 0, error: editGuard.error });
            return result;
        }
    }
    const dedupField = options?.dedupField || 'sku';

    const { db } = await connectToDatabase();
    const userOid = new ObjectId(String(session.user._id));

    const existingDocs = await db
        .collection('crm_products')
        .find({ userId: userOid }, { projection: { _id: 1, sku: 1, name: 1 } })
        .toArray();
    const existingMap = new Map<string, string>();
    for (const d of existingDocs) {
        const docTyped = d as { sku?: string; name?: string };
        const k =
            dedupField === 'name'
                ? String(docTyped.name ?? '').toLowerCase()
                : String(docTyped.sku ?? '').toLowerCase();
        if (k) existingMap.set(k, String(d._id));
    }

    for (let i = 0; i < rows.length; i += 1) {
        const r = rows[i]!;
        const k = keyOf(r, dedupField);
        const existingId = k ? existingMap.get(k) : undefined;
        try {
            if (existingId && updateExisting) {
                const $set: Record<string, unknown> = {
                    name: r.name,
                    sku: r.sku,
                    description: r.description,
                    costPrice: r.costPrice,
                    sellingPrice: r.sellingPrice,
                    taxRate: r.taxRate,
                    currency: r.currency,
                    hsnSac: r.hsnSac,
                    itemType: r.itemType,
                    totalStock: r.totalStock,
                    updatedAt: new Date(),
                };
                await db
                    .collection('crm_products')
                    .updateOne(
                        { _id: new ObjectId(existingId), userId: userOid },
                        { $set },
                    );
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'update',
                    entityKind: 'product',
                    entityId: existingId,
                    reason: 'bulk_import',
                });
                result.updated += 1;
            } else if (existingId && !updateExisting) {
                result.skipped += 1;
            } else {
                const doc = {
                    userId: userOid,
                    name: r.name,
                    sku: r.sku,
                    description: r.description,
                    costPrice: r.costPrice,
                    sellingPrice: r.sellingPrice,
                    taxRate: r.taxRate,
                    currency: r.currency,
                    hsnSac: r.hsnSac,
                    itemType: r.itemType ?? 'goods',
                    isTrackInventory: false,
                    inventory: [],
                    totalStock: r.totalStock ?? 0,
                    createdAt: new Date(),
                };
                const inserted = await db.collection('crm_products').insertOne(doc);
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'create',
                    entityKind: 'product',
                    entityId: String(inserted.insertedId),
                    reason: 'bulk_import',
                });
                result.created += 1;
            }
        } catch (e) {
            result.errors.push({
                rowIndex: i + 1,
                error: e instanceof Error ? e.message : 'insert failed',
            });
        }
    }
    return result;
}

export const itemsAdapter: BulkImportAdapterSpec<ItemImportRow> = {
    entityKind: 'item',
    label: 'Items / Products',
    targetSchema: SCHEMA,
    normalize,
    dedupe,
    execute,
};

export default itemsAdapter;
