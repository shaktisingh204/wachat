/**
 * Product CRUD against `commerce_products`.
 *
 * - SKU uniqueness is enforced PER TENANT (top-level + variant SKUs, soft-deleted
 *   products still occupy their SKU to prevent zombie reuse).
 * - Soft delete via `deletedAt`; `listProducts()` filters by default.
 */

import 'server-only';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import type { Product, Variant } from './types';

const COLLECTION = 'commerce_products';

function nowIso(): string {
    return new Date().toISOString();
}

function collectSkus(p: Pick<Product, 'sku' | 'variants'>): string[] {
    const out: string[] = [];
    if (p.sku) out.push(p.sku);
    for (const v of p.variants ?? []) {
        if (v.sku) out.push(v.sku);
    }
    return out;
}

async function assertSkusFree(
    tenantId: string,
    skus: string[],
    excludeId?: string,
): Promise<void> {
    if (skus.length === 0) return;
    const { db } = await connectToDatabase();
    const filter: Record<string, unknown> = {
        tenantId,
        $or: [
            { sku: { $in: skus } },
            { 'variants.sku': { $in: skus } },
        ],
    };
    if (excludeId) {
        filter._id = { $ne: new ObjectId(excludeId) };
    }
    const conflict = await db.collection(COLLECTION).findOne(filter, {
        projection: { _id: 1, sku: 1, 'variants.sku': 1 },
    });
    if (conflict) {
        throw new Error(`SKU conflict for tenant ${tenantId}`);
    }
}

export interface CreateProductInput
    extends Omit<Product, '_id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'status'> {
    status?: Product['status'];
}

export async function createProduct(input: CreateProductInput): Promise<Product> {
    if (!input.tenantId) throw new Error('tenantId required');
    if (!input.slug) throw new Error('slug required');

    const skus = collectSkus(input);
    await assertSkusFree(input.tenantId, skus);

    const now = nowIso();
    const doc: Omit<Product, '_id'> = {
        ...input,
        status: input.status ?? 'draft',
        variants: input.variants ?? [],
        createdAt: now,
        updatedAt: now,
    };

    const { db } = await connectToDatabase();
    const res = await db.collection(COLLECTION).insertOne(doc as unknown as Record<string, unknown>);
    return { ...doc, _id: res.insertedId.toString() };
}

export async function getProduct(tenantId: string, id: string): Promise<Product | null> {
    const { db } = await connectToDatabase();
    const _id = ObjectId.isValid(id) ? new ObjectId(id) : null;
    if (!_id) return null;
    const doc = await db.collection(COLLECTION).findOne({ _id, tenantId });
    if (!doc) return null;
    const { _id: oid, ...rest } = doc as unknown as Product & { _id: ObjectId };
    return { ...(rest as Product), _id: oid.toString() };
}

export async function getProductBySlug(
    tenantId: string,
    slug: string,
): Promise<Product | null> {
    const { db } = await connectToDatabase();
    const doc = await db.collection(COLLECTION).findOne({ tenantId, slug, deletedAt: { $exists: false } });
    if (!doc) return null;
    const { _id, ...rest } = doc as unknown as Product & { _id: ObjectId };
    return { ...(rest as Product), _id: _id.toString() };
}

export interface ListProductsOptions {
    /** Include soft-deleted. */
    includeDeleted?: boolean;
    status?: Product['status'];
    categoryId?: string;
    tag?: string;
    /** Cursor (ObjectId hex). */
    cursor?: string;
    limit?: number;
}

export async function listProducts(
    tenantId: string,
    opts: ListProductsOptions = {},
): Promise<Product[]> {
    const { db } = await connectToDatabase();
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
    const filter: Record<string, unknown> = { tenantId };
    if (!opts.includeDeleted) {
        filter.deletedAt = { $exists: false };
    }
    if (opts.status) filter.status = opts.status;
    if (opts.categoryId) filter.categoryIds = opts.categoryId;
    if (opts.tag) filter.tags = opts.tag;
    if (opts.cursor && ObjectId.isValid(opts.cursor)) {
        filter._id = { $gt: new ObjectId(opts.cursor) };
    }

    const docs = await db
        .collection(COLLECTION)
        .find(filter)
        .sort({ _id: 1 })
        .limit(limit)
        .toArray();

    return docs.map((d) => {
        const { _id, ...rest } = d as unknown as Product & { _id: ObjectId };
        return { ...(rest as Product), _id: _id.toString() };
    });
}

export type UpdateProductInput = Partial<
    Omit<Product, '_id' | 'tenantId' | 'createdAt' | 'updatedAt'>
>;

export async function updateProduct(
    tenantId: string,
    id: string,
    patch: UpdateProductInput,
): Promise<Product | null> {
    if (!ObjectId.isValid(id)) return null;
    const { db } = await connectToDatabase();

    if (patch.sku !== undefined || patch.variants !== undefined) {
        const existing = await db.collection(COLLECTION).findOne({ _id: new ObjectId(id), tenantId });
        if (!existing) return null;
        const merged: Pick<Product, 'sku' | 'variants'> = {
            sku: patch.sku ?? (existing as unknown as Product).sku,
            variants: patch.variants ?? ((existing as unknown as Product).variants ?? []),
        };
        await assertSkusFree(tenantId, collectSkus(merged), id);
    }

    const update: Record<string, unknown> = {
        ...patch,
        updatedAt: nowIso(),
    };
    const res = await db
        .collection(COLLECTION)
        .findOneAndUpdate(
            { _id: new ObjectId(id), tenantId },
            { $set: update },
            { returnDocument: 'after' },
        );
    if (!res) return null;
    const { _id, ...rest } = res as unknown as Product & { _id: ObjectId };
    return { ...(rest as Product), _id: _id.toString() };
}

export async function softDeleteProduct(tenantId: string, id: string): Promise<boolean> {
    if (!ObjectId.isValid(id)) return false;
    const { db } = await connectToDatabase();
    const res = await db.collection(COLLECTION).updateOne(
        { _id: new ObjectId(id), tenantId, deletedAt: { $exists: false } },
        { $set: { deletedAt: nowIso(), status: 'archived', updatedAt: nowIso() } },
    );
    return res.modifiedCount === 1;
}

export async function restoreProduct(tenantId: string, id: string): Promise<boolean> {
    if (!ObjectId.isValid(id)) return false;
    const { db } = await connectToDatabase();
    const res = await db.collection(COLLECTION).updateOne(
        { _id: new ObjectId(id), tenantId },
        { $unset: { deletedAt: '' }, $set: { status: 'draft', updatedAt: nowIso() } },
    );
    return res.modifiedCount === 1;
}

export async function addVariant(
    tenantId: string,
    productId: string,
    variant: Variant,
): Promise<Product | null> {
    if (!ObjectId.isValid(productId)) return null;
    await assertSkusFree(tenantId, [variant.sku], productId);
    const { db } = await connectToDatabase();
    const res = await db
        .collection(COLLECTION)
        .findOneAndUpdate(
            { _id: new ObjectId(productId), tenantId },
            { $push: { variants: variant }, $set: { updatedAt: nowIso() } } as never,
            { returnDocument: 'after' },
        );
    if (!res) return null;
    const { _id, ...rest } = res as unknown as Product & { _id: ObjectId };
    return { ...(rest as Product), _id: _id.toString() };
}

export async function removeVariant(
    tenantId: string,
    productId: string,
    variantId: string,
): Promise<Product | null> {
    if (!ObjectId.isValid(productId)) return null;
    const { db } = await connectToDatabase();
    const res = await db
        .collection(COLLECTION)
        .findOneAndUpdate(
            { _id: new ObjectId(productId), tenantId },
            { $pull: { variants: { id: variantId } }, $set: { updatedAt: nowIso() } } as never,
            { returnDocument: 'after' },
        );
    if (!res) return null;
    const { _id, ...rest } = res as unknown as Product & { _id: ObjectId };
    return { ...(rest as Product), _id: _id.toString() };
}
