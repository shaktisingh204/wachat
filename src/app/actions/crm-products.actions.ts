'use server';

/**
 * CRM Item/Product server actions.
 *
 * **Dual implementation:**
 *  - When `USE_RUST_CRM === 'true'`, every action delegates to the Rust BFF
 *    (`/v1/crm/items`) via `src/lib/rust-client/crm-items.ts`.
 *  - Otherwise (default), the legacy direct-Mongo path runs.
 *
 * Export shapes are identical across both paths so the existing pages at
 * `/dashboard/crm/inventory/items/**` keep working without changes.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';

import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import type { CrmProduct } from '@/lib/definitions';
import { connectToDatabase } from '@/lib/mongodb';
import { itemApi, type CrmItemDoc } from '@/lib/rust-client/crm-items';
import {
    crmProductsApi,
    type CrmProductDoc,
} from '@/lib/rust-client/crm-products';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { getErrorMessage } from '@/lib/utils';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

/* ─── Rust-shape → legacy TS-shape adapter ────────────────────────────── */

function rustDocToLegacy(doc: CrmItemDoc): WithId<CrmProduct> {
    return {
        ...(doc as unknown as WithId<CrmProduct>),
        _id: doc._id ? (doc._id as unknown as ObjectId) : (undefined as unknown as ObjectId),
        userId: doc.userId as unknown as ObjectId,
        categoryId: doc.categoryId ? (doc.categoryId as unknown as ObjectId) : undefined,
        brandId: doc.brandId ? (doc.brandId as unknown as ObjectId) : undefined,
        unitId: doc.unitId ? (doc.unitId as unknown as ObjectId) : undefined,
        inventory: (doc.inventory ?? []).map((row) => ({
            warehouseId: row.warehouseId as unknown as ObjectId,
            stock: row.stock,
            reorderPoint: row.reorderPoint,
        })),
        createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt) : new Date(),
    };
}

/* ─── Rust products → legacy adapter ─────────────────────────────────── */
// The new simplified `/v1/crm/products` surface returns a flatter shape than
// the legacy TS `CrmProduct`. We coerce the overlapping fields and let the
// callers treat the rest as undefined (they already do for partial docs).

function rustProductDocToLegacy(doc: CrmProductDoc): WithId<CrmProduct> {
    return {
        ...(doc as unknown as WithId<CrmProduct>),
        _id: doc._id ? (doc._id as unknown as ObjectId) : (undefined as unknown as ObjectId),
        userId: doc.userId as unknown as ObjectId,
        createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt) : new Date(),
    };
}

/* ─── getCrmProductById ──────────────────────────────────────────────── */

export async function getCrmProductById(
    productId: string,
): Promise<WithId<CrmProduct> | null> {
    if (!productId) return null;

    const session = await getSession();
    if (!session?.user) return null;

    if (useRustCrm()) {
        // Try the dedicated `/v1/crm/products` BFF first (entity: 'product').
        try {
            const doc = await crmProductsApi.getById(productId);
            return doc ? rustProductDocToLegacy(doc) : null;
        } catch (e) {
            console.error('[getCrmProductById] rust products path failed; falling back:', e);
            recordRustFallback({ entity: 'product', op: 'get', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through to the items BFF
        }

        // Existing items BFF fallback (entity: 'item').
        try {
            const doc = await itemApi.getById(productId);
            return doc ? rustDocToLegacy(doc) : null;
        } catch (e) {
            console.error('[getCrmProductById] rust items path failed; falling back:', e);
            recordRustFallback({ entity: 'item', op: 'get', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through to legacy Mongo
        }
    }

    if (!ObjectId.isValid(productId)) return null;

    try {
        const { db } = await connectToDatabase();
        const product = await db.collection<CrmProduct>('crm_products').findOne({
            _id: new ObjectId(productId),
            userId: new ObjectId(session.user._id),
        });

        return product ? JSON.parse(JSON.stringify(product)) : null;
    } catch {
        return null;
    }
}

/* ─── getCrmProducts ─────────────────────────────────────────────────── */

export async function getCrmProducts(
    page: number = 1,
    limit: number = 20,
    query?: string,
    filters?: { stock?: string; category?: string; itemType?: string }
): Promise<{ products: WithId<CrmProduct>[]; total: number }> {
    const session = await getSession();
    if (!session?.user) return { products: [], total: 0 };

    if (useRustCrm()) {
        try {
            const rustFilters: Record<string, unknown> = {};
            if (filters?.stock === 'in_stock') rustFilters.inStock = true;
            else if (filters?.stock === 'out_of_stock') rustFilters.outOfStock = true;
            if (filters?.category) rustFilters.categoryId = filters.category;
            if (filters?.itemType && filters.itemType !== 'all') rustFilters.itemType = filters.itemType;

            const result = await itemApi.list({
                q: query,
                page: Math.max(0, page - 1),
                limit,
                filter: Object.keys(rustFilters).length > 0 ? rustFilters : undefined,
            });
            return {
                products: result.items.map(rustDocToLegacy),
                total: result.total ?? result.items.length,
            };
        } catch (e) {
            console.error('[getCrmProducts] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'item', op: 'list', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const filter: any = { userId: userObjectId };
        if (query) {
            filter.$or = [
                { name: { $regex: query, $options: 'i' } },
                { sku: { $regex: query, $options: 'i' } },
            ];
        }

        if (filters?.stock === 'in_stock') {
            filter.$or = filter.$or ? [ { $and: [ ...filter.$or ] }, { $or: [{ isTrackInventory: false }, { totalStock: { $gt: 0 } }] } ] : [{ isTrackInventory: false }, { totalStock: { $gt: 0 } }];
        } else if (filters?.stock === 'out_of_stock') {
            filter.isTrackInventory = true;
            filter.$or = filter.$or ? [ { $and: [ ...filter.$or ] }, { $or: [{ totalStock: { $lte: 0 } }, { totalStock: null }] } ] : [{ totalStock: { $lte: 0 } }, { totalStock: null }];
        }

        if (filters?.category) {
            filter.categoryId = new ObjectId(filters.category);
        }

        if (filters?.itemType && filters.itemType !== 'all') {
            filter.itemType = filters.itemType;
        }

        const skip = (page - 1) * limit;

        const [products, total] = await Promise.all([
            db
                .collection<CrmProduct>('crm_products')
                .find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            db.collection<CrmProduct>('crm_products').countDocuments(filter),
        ]);

        return {
            products: JSON.parse(JSON.stringify(products)),
            total,
        };
    } catch (e: any) {
        console.error('Failed to fetch CRM products:', e);
        return { products: [], total: 0 };
    }
}

/* ─── saveCrmProduct ─────────────────────────────────────────────────── */

export async function saveCrmProduct(
    prevState: any,
    formData: FormData,
): Promise<{ message?: string; error?: string; newProduct?: any }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    const productId = formData.get('productId') as string; // hidden field on edit
    const isEditing = !!productId && productId !== '';

    // Extract basic fields
    const name = formData.get('name') as string;
    if (!name) {
        return { error: 'Product name is required.' };
    }
    const sku = (formData.get('sku') as string) || '';
    const description = (formData.get('description') as string) || undefined;
    const currency = (formData.get('currency') as string) || 'INR';

    const costPrice = parseFloat(formData.get('costPrice') as string) || 0;
    const sellingPrice = parseFloat(formData.get('sellingPrice') as string) || 0;
    const taxRate = parseFloat(formData.get('taxRate') as string) || 0;

    const isTrackInventory = formData.get('isTrackInventory') === 'on';
    const reorderPoint = parseInt(formData.get('reorderPoint') as string, 10) || 0;

    const length = parseFloat(formData.get('length') as string) || 0;
    const breadth = parseFloat(formData.get('breadth') as string) || 0;
    const height = parseFloat(formData.get('height') as string) || 0;
    const volume = parseFloat(formData.get('volume') as string) || 0;
    const grossWeight = parseFloat(formData.get('grossWeight') as string) || 0;
    const netWeight = parseFloat(formData.get('netWeight') as string) || 0;

    const hsnSac = (formData.get('hsnSac') as string) || undefined;
    const itemTypeRaw = formData.get('itemType') as string | null;
    const itemType = itemTypeRaw === 'service' ? 'service' : 'goods';
    const batchTracking = formData.get('batchTracking') === 'on';

    const supplierName = (formData.get('supplierName') as string) || undefined;
    const supplierContact = (formData.get('supplierContact') as string) || undefined;
    const supplierLeadTime = parseInt(formData.get('supplierLeadTime') as string, 10) || undefined;

    const categoryIdRaw = formData.get('categoryId') as string | null;
    const brandIdRaw = formData.get('brandId') as string | null;
    const unitIdRaw = formData.get('unitId') as string | null;
    const categoryId =
        categoryIdRaw && categoryIdRaw !== 'none' ? categoryIdRaw : undefined;
    const brandId = brandIdRaw && brandIdRaw !== 'none' ? brandIdRaw : undefined;
    const unitId = unitIdRaw && unitIdRaw !== 'none' ? unitIdRaw : undefined;

    // Image handling (data-URI or URL)
    const imageUrl = formData.get('imageUrl') as string | null;
    const imageFile = formData.get('imageFile') as File | null;
    let images: string[] | undefined;
    if (imageFile && imageFile.size > 0) {
        const buffer = Buffer.from(await imageFile.arrayBuffer());
        images = [`data:${imageFile.type};base64,${buffer.toString('base64')}`];
    } else if (imageUrl) {
        images = [imageUrl];
    }

    if (useRustCrm()) {
        try {
            if (isEditing) {
                const updated = await itemApi.update(productId, {
                    name,
                    sku: sku || undefined,
                    description,
                    currency,
                    costPrice,
                    sellingPrice,
                    taxRate,
                    isTrackInventory,
                    hsnSac,
                    itemType,
                    dimensions: { length, breadth, height, volume },
                    weight: { gross: grossWeight, net: netWeight },
                    batchTracking,
                    categoryId,
                    brandId,
                    unitId,
                    ...(images ? { images } : {}),
                });
                revalidatePath('/dashboard/crm/inventory/items');
                return {
                    message: 'Product saved successfully.',
                    newProduct: { ...rustDocToLegacy(updated), _id: productId },
                };
            }

            // Create — gather warehouses to seed inventory like legacy did.
            const { db } = await connectToDatabase();
            const userObjectId = new ObjectId(session.user._id);
            const warehouses = isTrackInventory
                ? await db
                      .collection('crm_warehouses')
                      .find({ userId: userObjectId })
                      .toArray()
                : [];
            const stockInHand = parseInt(formData.get('stockInHand') as string, 10) || 0;
            const inventory = isTrackInventory
                ? warehouses.map((w: any) => ({
                      warehouseId: String(w._id),
                      stock: w.isDefault ? stockInHand : 0,
                      reorderPoint,
                  }))
                : [];
            const totalStock = isTrackInventory ? stockInHand : 0;

            const { id, entity } = await itemApi.create({
                name,
                sku: sku || name,
                description,
                currency,
                costPrice,
                sellingPrice,
                taxRate,
                isTrackInventory,
                hsnSac,
                itemType,
                dimensions: { length, breadth, height, volume },
                weight: { gross: grossWeight, net: netWeight },
                batchTracking,
                categoryId,
                brandId,
                unitId,
                inventory,
                totalStock,
                ...(images ? { images } : {}),
            });
            revalidatePath('/dashboard/crm/inventory/items');
            return {
                message: 'Product saved successfully.',
                newProduct: entity
                    ? { ...rustDocToLegacy(entity), _id: id }
                    : { _id: id, name, sku },
            };
        } catch (e) {
            const msg = e instanceof RustApiError ? e.message : getErrorMessage(e);
            console.error('[saveCrmProduct] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'item', op: isEditing ? 'update' : 'create', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // Surface SKU-uniqueness validation errors cleanly.
            if (e instanceof RustApiError && e.status === 400) {
                return { error: msg || 'Validation failed.' };
            }
            void msg;
            // fall through to legacy on transport errors so users aren't blocked
        }
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const productData: Partial<CrmProduct> & Record<string, unknown> = {
            userId: userObjectId,
            name,
            sku,
            description,
            currency,
            costPrice,
            sellingPrice,
            taxRate,
            isTrackInventory,
            updatedAt: new Date(),
            hsnSac,
            itemType,
            dimensions: { length, breadth, height, volume },
            weight: { gross: grossWeight, net: netWeight },
            batchTracking,
            supplierName,
            supplierContact,
            supplierLeadTime,
        };

        if (categoryId) productData.categoryId = new ObjectId(categoryId);
        if (brandId) productData.brandId = new ObjectId(brandId);
        if (unitId) productData.unitId = new ObjectId(unitId);

        if (images) productData.images = images;

        if (!productData.name) {
            return { error: 'Product name is required.' };
        }

        if (isEditing) {
            await db
                .collection('crm_products')
                .updateOne(
                    { _id: new ObjectId(productId), userId: userObjectId },
                    { $set: productData },
                );

            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'update',
                entityKind: 'item',
                entityId: productId,
            });

            revalidatePath('/dashboard/crm/inventory/items');
            return { message: 'Product saved successfully.' };
        }

        // Check SKU uniqueness
        if (productData.sku) {
            const existing = await db
                .collection('crm_products')
                .findOne({ userId: userObjectId, sku: productData.sku });
            if (existing) {
                return { error: 'SKU already exists.' };
            }
        }

        productData.createdAt = new Date();
        // Initialize default inventory if tracking
        if (productData.isTrackInventory) {
            const warehouses = await db
                .collection('crm_warehouses')
                .find({ userId: userObjectId })
                .toArray();
            const stockInHand = parseInt(formData.get('stockInHand') as string, 10) || 0;

            if (warehouses.length > 0) {
                const defaultWarehouse = warehouses.find((w) => w.isDefault) || warehouses[0];
                productData.inventory = warehouses.map((w) => ({
                    warehouseId: w._id,
                    stock: w._id.equals(defaultWarehouse._id) ? stockInHand : 0,
                    reorderPoint,
                }));
            } else {
                productData.inventory = [];
            }
            productData.totalStock = stockInHand;
        } else {
            productData.inventory = [];
            productData.totalStock = 0;
        }

        const result = await db
            .collection('crm_products')
            .insertOne(productData as CrmProduct);

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'create',
            entityKind: 'item',
            entityId: String(result.insertedId),
        });

        revalidatePath('/dashboard/crm/inventory/items');
        return {
            message: 'Product saved successfully.',
            newProduct: { ...productData, _id: result.insertedId },
        };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

/* ─── getCrmProductKpis ──────────────────────────────────────────────── */

export interface CrmProductKpis {
    total: number;
    inStock: number;
    /** Items with reorder point set whose current stock is below it. */
    lowStock: number;
    outOfStock: number;
    /** Average margin percentage across products with `sellingPrice > 0`. */
    avgMargin: number;
    /** Sum of `totalStock * costPrice` across products. */
    totalValue: number;
}

export async function getCrmProductKpis(): Promise<CrmProductKpis> {
    const empty: CrmProductKpis = {
        total: 0,
        inStock: 0,
        lowStock: 0,
        outOfStock: 0,
        avgMargin: 0,
        totalValue: 0,
    };
    const session = await getSession();
    if (!session?.user) return empty;

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const [total, inStockCount, valueAgg, lowStockAgg, outOfStockCount, marginAgg] =
            await Promise.all([
            db.collection('crm_products').countDocuments({ userId: userObjectId } as any),
            db.collection('crm_products').countDocuments({
                userId: userObjectId,
                $or: [
                    { isTrackInventory: false },
                    { totalStock: { $gt: 0 } },
                ],
            } as any),
            db
                .collection('crm_products')
                .aggregate([
                    { $match: { userId: userObjectId } },
                    {
                        $group: {
                            _id: null,
                            value: {
                                $sum: {
                                    $multiply: [
                                        { $ifNull: ['$totalStock', 0] },
                                        { $ifNull: ['$costPrice', 0] },
                                    ],
                                },
                            },
                        },
                    },
                ])
                .toArray(),
            db
                .collection('crm_products')
                .aggregate([
                    {
                        $match: {
                            userId: userObjectId,
                            isTrackInventory: true,
                        },
                    },
                    { $unwind: { path: '$inventory', preserveNullAndEmptyArrays: true } },
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $gt: [{ $ifNull: ['$inventory.reorderPoint', 0] }, 0] },
                                    {
                                        $lte: [
                                            { $ifNull: ['$inventory.stock', 0] },
                                            { $ifNull: ['$inventory.reorderPoint', 0] },
                                        ],
                                    },
                                ],
                            },
                        },
                    },
                    { $group: { _id: '$_id' } },
                    { $count: 'count' },
                ])
                .toArray(),
            db.collection('crm_products').countDocuments({
                userId: userObjectId,
                isTrackInventory: true,
                $or: [
                    { totalStock: { $lte: 0 } },
                    { totalStock: { $exists: false } },
                ],
            } as any),
            db
                .collection('crm_products')
                .aggregate([
                    {
                        $match: {
                            userId: userObjectId,
                            $expr: {
                                $gt: [{ $ifNull: ['$sellingPrice', 0] }, 0],
                            },
                        },
                    },
                    {
                        $group: {
                            _id: null,
                            avg: {
                                $avg: {
                                    $multiply: [
                                        {
                                            $divide: [
                                                {
                                                    $subtract: [
                                                        { $ifNull: ['$sellingPrice', 0] },
                                                        { $ifNull: ['$costPrice', 0] },
                                                    ],
                                                },
                                                { $ifNull: ['$sellingPrice', 1] },
                                            ],
                                        },
                                        100,
                                    ],
                                },
                            },
                        },
                    },
                ])
                .toArray(),
        ]);

        const totalValue = Number((valueAgg as Array<{ value?: number }>)?.[0]?.value ?? 0);
        const lowStock = Number((lowStockAgg as Array<{ count?: number }>)?.[0]?.count ?? 0);
        const avgMargin = Number((marginAgg as Array<{ avg?: number }>)?.[0]?.avg ?? 0);

        return {
            total,
            inStock: inStockCount,
            lowStock,
            outOfStock: Number(outOfStockCount) || 0,
            avgMargin,
            totalValue,
        };
    } catch (e) {
        console.error('Failed to fetch CRM product KPIs:', e);
        return empty;
    }
}

/* ─── bulkProductAction ──────────────────────────────────────────────── */

export async function bulkProductAction(
    ids: string[],
    op: 'delete',
): Promise<{ success: boolean; processed?: number; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!Array.isArray(ids) || ids.length === 0) return { success: false, error: 'No ids.' };

    const validIds = ids.filter((id) => ObjectId.isValid(id));
    if (validIds.length === 0) return { success: false, error: 'No valid ids.' };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);
        const objectIds = validIds.map((id) => new ObjectId(id));

        if (op === 'delete') {
            const result = await db.collection('crm_products').deleteMany({
                _id: { $in: objectIds },
                userId: userObjectId,
            } as any);
            await db
                .collection('crm_stock_adjustments')
                .deleteMany({ productId: { $in: objectIds } } as any);
            revalidatePath('/dashboard/crm/sales-crm/products');
            return { success: true, processed: result.deletedCount ?? 0 };
        }

        return { success: false, error: 'Unsupported op.' };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/* ─── deleteCrmProduct ───────────────────────────────────────────────── */

export async function deleteCrmProduct(
    productId: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!productId) return { success: false, error: 'Invalid ID.' };

    if (useRustCrm()) {
        try {
            const { deleted } = await itemApi.delete(productId);
            if (!deleted) {
                return { success: false, error: 'Product not found.' };
            }
            // Cleanup stock adjustments — the Rust handler doesn't own this
            // sister collection, so we run the housekeeping query here.
            if (ObjectId.isValid(productId)) {
                try {
                    const { db } = await connectToDatabase();
                    await db
                        .collection('crm_stock_adjustments')
                        .deleteMany({ productId: new ObjectId(productId) });
                } catch (e) {
                    console.error('[deleteCrmProduct] stock-adjustments cleanup failed:', e);
                }
            }
            revalidatePath('/dashboard/crm/inventory/items');
            return { success: true };
        } catch (e) {
            console.error('[deleteCrmProduct] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'item', op: 'delete', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    if (!ObjectId.isValid(productId)) return { success: false, error: 'Invalid ID.' };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_products').deleteOne({
            _id: new ObjectId(productId),
            userId: new ObjectId(session.user._id),
        });

        if (result.deletedCount === 0) {
            return { success: false, error: 'Product not found.' };
        }

        // Cleanup stock adjustments
        await db
            .collection('crm_stock_adjustments')
            .deleteMany({ productId: new ObjectId(productId) });

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'delete',
            entityKind: 'item',
            entityId: productId,
        });

        revalidatePath('/dashboard/crm/inventory/items');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/* ─── updateProductStatus ────────────────────────────────────────────── */

export async function updateProductStatus(
    productId: string,
    status: 'active' | 'archived',
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied' };
    if (!productId) return { success: false, error: 'Invalid ID.' };

    if (useRustCrm()) {
        try {
            await itemApi.update(productId, {
                status,
            } as any);
            revalidatePath('/dashboard/crm/inventory/items');
            return { success: true };
        } catch (e) {
            console.error('[updateProductStatus] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'item',
                op: 'update',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }

    if (!ObjectId.isValid(productId)) return { success: false, error: 'Invalid ID.' };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const result = await db.collection('crm_products').updateOne(
            { _id: new ObjectId(productId), userId: userObjectId },
            { $set: { status, updatedAt: new Date() } },
        );

        if (result.matchedCount === 0) {
            return { success: false, error: 'Product not found.' };
        }

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'update',
            entityKind: 'item',
            entityId: productId,
        });

        revalidatePath('/dashboard/crm/inventory/items');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

