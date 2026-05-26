/**
 * Multi-warehouse inventory.
 *
 * Stock mutations are atomic via Mongo `findOneAndUpdate` with `$inc`.
 * Decrement guards against negative stock unless backorder is enabled on
 * the inventory row.
 */

import 'server-only';
import { connectToDatabase } from '@/lib/mongodb';
import type { Inventory } from './types';

const COLLECTION = 'commerce_inventory';

function nowIso(): string {
    return new Date().toISOString();
}

function inventoryFilter(productId: string, warehouseId: string, variantId?: string): Record<string, unknown> {
    return {
        productId,
        warehouseId,
        variantId: variantId ?? { $exists: false },
    };
}

export async function getInventory(
    tenantId: string,
    productId: string,
    warehouseId: string,
    variantId?: string,
): Promise<Inventory | null> {
    const { db } = await connectToDatabase();
    const doc = await db.collection(COLLECTION).findOne({
        tenantId,
        ...inventoryFilter(productId, warehouseId, variantId),
    });
    return (doc as unknown as Inventory) ?? null;
}

export async function listProductInventory(
    tenantId: string,
    productId: string,
): Promise<Inventory[]> {
    const { db } = await connectToDatabase();
    const docs = await db
        .collection(COLLECTION)
        .find({ tenantId, productId })
        .toArray();
    return docs as unknown as Inventory[];
}

export interface UpsertInventoryInput {
    tenantId: string;
    productId: string;
    variantId?: string;
    warehouseId: string;
    stock: number;
    reorderLevel?: number;
    backorderAllowed?: boolean;
}

export async function upsertInventory(input: UpsertInventoryInput): Promise<Inventory> {
    const { db } = await connectToDatabase();
    const filter = {
        tenantId: input.tenantId,
        ...inventoryFilter(input.productId, input.warehouseId, input.variantId),
    };
    const setOnInsert: Partial<Inventory> = {
        tenantId: input.tenantId,
        productId: input.productId,
        warehouseId: input.warehouseId,
        reserved: 0,
    };
    if (input.variantId !== undefined) setOnInsert.variantId = input.variantId;

    const res = await db.collection(COLLECTION).findOneAndUpdate(
        filter,
        {
            $set: {
                stock: input.stock,
                reorderLevel: input.reorderLevel,
                backorderAllowed: input.backorderAllowed ?? false,
                updatedAt: nowIso(),
            },
            $setOnInsert: setOnInsert,
        },
        { upsert: true, returnDocument: 'after' },
    );
    return res as unknown as Inventory;
}

/**
 * Atomically decrement stock for a product/warehouse. Returns the new
 * inventory doc on success, or `null` if insufficient stock (and backorder
 * not allowed). The conditional `stock >= qty` clause inside the filter is
 * what makes this race-safe.
 */
export async function decrement(
    tenantId: string,
    productId: string,
    warehouseId: string,
    qty: number,
    variantId?: string,
): Promise<Inventory | null> {
    if (qty <= 0) throw new Error('decrement qty must be > 0');
    const { db } = await connectToDatabase();

    // First attempt: enforce stock >= qty.
    const guarded = await db.collection(COLLECTION).findOneAndUpdate(
        {
            tenantId,
            ...inventoryFilter(productId, warehouseId, variantId),
            stock: { $gte: qty },
        },
        {
            $inc: { stock: -qty },
            $set: { updatedAt: nowIso() },
        },
        { returnDocument: 'after' },
    );
    if (guarded) return guarded as unknown as Inventory;

    // Fallback: if row exists and backorder allowed, allow negative stock.
    const fallback = await db.collection(COLLECTION).findOneAndUpdate(
        {
            tenantId,
            ...inventoryFilter(productId, warehouseId, variantId),
            backorderAllowed: true,
        },
        {
            $inc: { stock: -qty },
            $set: { updatedAt: nowIso() },
        },
        { returnDocument: 'after' },
    );
    return (fallback as unknown as Inventory) ?? null;
}

export async function increment(
    tenantId: string,
    productId: string,
    warehouseId: string,
    qty: number,
    variantId?: string,
): Promise<Inventory | null> {
    if (qty <= 0) throw new Error('increment qty must be > 0');
    const { db } = await connectToDatabase();
    const res = await db.collection(COLLECTION).findOneAndUpdate(
        {
            tenantId,
            ...inventoryFilter(productId, warehouseId, variantId),
        },
        {
            $inc: { stock: qty },
            $set: { updatedAt: nowIso() },
        },
        { returnDocument: 'after' },
    );
    return (res as unknown as Inventory) ?? null;
}

/** Reserve stock without committing the sale (cart hold). */
export async function reserve(
    tenantId: string,
    productId: string,
    warehouseId: string,
    qty: number,
    variantId?: string,
): Promise<Inventory | null> {
    if (qty <= 0) throw new Error('reserve qty must be > 0');
    const { db } = await connectToDatabase();
    const res = await db.collection(COLLECTION).findOneAndUpdate(
        {
            tenantId,
            ...inventoryFilter(productId, warehouseId, variantId),
            $expr: { $gte: [{ $subtract: ['$stock', '$reserved'] }, qty] },
        },
        {
            $inc: { reserved: qty },
            $set: { updatedAt: nowIso() },
        },
        { returnDocument: 'after' },
    );
    return (res as unknown as Inventory) ?? null;
}

export async function releaseReservation(
    tenantId: string,
    productId: string,
    warehouseId: string,
    qty: number,
    variantId?: string,
): Promise<Inventory | null> {
    if (qty <= 0) throw new Error('release qty must be > 0');
    const { db } = await connectToDatabase();
    const res = await db.collection(COLLECTION).findOneAndUpdate(
        {
            tenantId,
            ...inventoryFilter(productId, warehouseId, variantId),
            reserved: { $gte: qty },
        },
        {
            $inc: { reserved: -qty },
            $set: { updatedAt: nowIso() },
        },
        { returnDocument: 'after' },
    );
    return (res as unknown as Inventory) ?? null;
}

/** Total available units across all warehouses for a product/variant. */
export async function totalAvailable(
    tenantId: string,
    productId: string,
    variantId?: string,
): Promise<number> {
    const { db } = await connectToDatabase();
    const match: Record<string, unknown> = { tenantId, productId };
    if (variantId !== undefined) match.variantId = variantId;
    const result = await db
        .collection(COLLECTION)
        .aggregate([
            { $match: match },
            {
                $group: {
                    _id: null,
                    available: { $sum: { $subtract: ['$stock', '$reserved'] } },
                },
            },
        ])
        .toArray();
    return (result[0]?.available as number | undefined) ?? 0;
}
