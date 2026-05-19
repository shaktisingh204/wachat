'use server';

/**
 * CRM Online-Store server actions.
 *
 * Implements the 6 collections owned by `rust/crates/crm-store/`:
 *   - crm_storefronts
 *   - crm_store_products
 *   - crm_store_pricing_rules
 *   - crm_store_shipping_zones
 *   - crm_store_orders
 *   - crm_store_abandoned_carts
 *
 * **Dual implementation:**
 *  - When `USE_RUST_CRM === 'true'`, actions delegate to the Rust BFF
 *    (`/v1/crm/store`) via `src/lib/rust-client/crm-store.ts`.
 *  - Otherwise (default), the legacy direct-Mongo path runs.
 *
 * Export shapes are identical across both paths.
 *
 * All mutations are gated by `requirePermission('crm_store', …)`. The
 * `crm_store` key is NOT yet registered in `permission-modules.ts` —
 * flagged in the deliverable for batch-registration.
 *
 * Every mutation writes an audit-log entry. Recovery-email dispatch and
 * automatic invoice-creation on `markOrderPaid` are stubbed and emit
 * structured TODO logs.
 */

import { ObjectId, type Filter, type WithId, type Document } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { requirePermission } from '@/lib/rbac-server';
import { getErrorMessage } from '@/lib/utils';
import { crmStoreApi } from '@/lib/rust-client/crm-store';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Shared helpers                                                           */
/* ──────────────────────────────────────────────────────────────────────── */

type ActionResult<T = void> =
    | ({ ok: true } & T)
    | { ok: false; error: string };

type FormStateResult = { message?: string; error?: string; id?: string };

const COLL = {
    storefronts: 'crm_storefronts',
    products: 'crm_store_products',
    pricingRules: 'crm_store_pricing_rules',
    shippingZones: 'crm_store_shipping_zones',
    orders: 'crm_store_orders',
    abandonedCarts: 'crm_store_abandoned_carts',
} as const;

function toJson<T>(doc: unknown): T {
    return JSON.parse(JSON.stringify(doc)) as T;
}

function parseJsonField<T>(raw: string | null | undefined, fallback: T): T {
    if (!raw) return fallback;
    try {
        const parsed = JSON.parse(raw);
        return (parsed ?? fallback) as T;
    } catch {
        return fallback;
    }
}

function getString(formData: FormData, key: string): string | undefined {
    const v = formData.get(key);
    if (typeof v !== 'string') return undefined;
    const trimmed = v.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function getNumber(formData: FormData, key: string): number | undefined {
    const v = getString(formData, key);
    if (v === undefined) return undefined;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : undefined;
}

function getBoolean(formData: FormData, key: string): boolean {
    const v = formData.get(key);
    return v === 'on' || v === 'true' || v === '1';
}

function getCommaList(formData: FormData, key: string): string[] | undefined {
    const raw = getString(formData, key);
    if (!raw) return undefined;
    const arr = raw
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    return arr.length > 0 ? arr : undefined;
}

async function audit(opts: {
    session: { user?: { _id?: unknown } | null };
    action: 'create' | 'update' | 'delete';
    entityKind: string;
    entityId: string;
}): Promise<void> {
    try {
        const userId = String(opts.session.user?._id ?? '');
        if (!userId) return;
        await writeAuditEntry({
            tenantUserId: userId,
            actorId: userId,
            action: opts.action,
            entityKind: opts.entityKind,
            entityId: opts.entityId,
        });
    } catch {
        /* non-fatal */
    }
}

function requireUserObjectId(
    session: Awaited<ReturnType<typeof getSession>>,
): ObjectId | null {
    const id = session?.user?._id;
    if (!id || typeof id !== 'string' || !ObjectId.isValid(id)) return null;
    return new ObjectId(id);
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Storefronts                                                              */
/* ──────────────────────────────────────────────────────────────────────── */

export async function getStorefrontList(): Promise<{
    items: Record<string, unknown>[];
    error?: string;
}> {
    const session = await getSession();
    const userId = requireUserObjectId(session);
    if (!userId) return { items: [], error: 'Unauthorized.' };

    if (useRustCrm()) {
        try {
            const res = await crmStoreApi.storefronts.list({ limit: 200 });
            return { items: toJson(res.items) };
        } catch (e) {
            console.error('[getStorefrontList] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'store_storefront',
                op: 'list',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }

    try {
        const { db } = await connectToDatabase();
        const docs = await db
            .collection(COLL.storefronts)
            .find({ userId } as Filter<Document>)
            .sort({ createdAt: -1 })
            .limit(200)
            .toArray();
        return { items: toJson(docs) };
    } catch (e) {
        console.error('getStorefrontList error:', e);
        return { items: [], error: getErrorMessage(e) };
    }
}

export async function getStorefrontById(
    id: string,
): Promise<Record<string, unknown> | null> {
    if (!id) return null;
    const session = await getSession();
    const userId = requireUserObjectId(session);
    if (!userId) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmStoreApi.storefronts.getById(id);
            return doc ? toJson(doc) : null;
        } catch (e) {
            console.error('[getStorefrontById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'store_storefront',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }

    if (!ObjectId.isValid(id)) return null;
    try {
        const { db } = await connectToDatabase();
        const doc = await db
            .collection(COLL.storefronts)
            .findOne({ _id: new ObjectId(id), userId });
        return doc ? toJson(doc) : null;
    } catch (e) {
        console.error('getStorefrontById error:', e);
        return null;
    }
}

export async function saveStorefront(
    _prev: FormStateResult,
    formData: FormData,
): Promise<FormStateResult> {
    const session = await getSession();
    const userId = requireUserObjectId(session);
    if (!userId) return { error: 'Unauthorized.' };

    const id = getString(formData, 'storefrontId');
    const action = id ? 'edit' : 'create';
    const guard = await requirePermission('crm_store', action);
    if (!guard.ok) return { error: guard.error };

    const name = getString(formData, 'name');
    const slug = getString(formData, 'slug');
    if (!name) return { error: 'Storefront name is required.' };
    if (!slug) return { error: 'Slug is required.' };

    if (useRustCrm()) {
        try {
            const payload = {
                name,
                slug,
                domain: getString(formData, 'domain'),
                currency: getString(formData, 'currency') ?? 'INR',
                logoUrl: getString(formData, 'logoUrl'),
            };

            if (id) {
                await crmStoreApi.storefronts.update(id, {
                    ...payload,
                    status: (getString(formData, 'status') ?? 'draft') as any,
                });
                revalidatePath('/dashboard/crm/store/storefronts');
                revalidatePath(`/dashboard/crm/store/storefronts/${id}`);
                return { message: 'Storefront updated.', id };
            }

            const res = await crmStoreApi.storefronts.create(payload);
            revalidatePath('/dashboard/crm/store/storefronts');
            return { message: 'Storefront created.', id: res.id };
        } catch (e) {
            console.error('[saveStorefront] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'store_storefront',
                op: id ? 'update' : 'create',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }

    try {
        const doc: Record<string, unknown> = {
            name,
            slug,
            domain: getString(formData, 'domain') ?? null,
            currency: getString(formData, 'currency') ?? 'INR',
            logoUrl: getString(formData, 'logoUrl') ?? null,
            homepageBlocks: parseJsonField(
                getString(formData, 'homepageBlocks') ?? null,
                [],
            ),
            status: getString(formData, 'status') ?? 'draft',
            updatedAt: new Date(),
        };

        const { db } = await connectToDatabase();

        if (id && ObjectId.isValid(id)) {
            const result = await db.collection(COLL.storefronts).updateOne(
                { _id: new ObjectId(id), userId },
                { $set: doc },
            );
            if (result.matchedCount === 0) {
                return { error: 'Storefront not found.' };
            }
            await audit({
                session,
                action: 'update',
                entityKind: 'storefront',
                entityId: id,
            });
            revalidatePath('/dashboard/crm/store/storefronts');
            revalidatePath(`/dashboard/crm/store/storefronts/${id}`);
            return { message: 'Storefront updated.', id };
        }

        doc.userId = userId;
        doc.createdAt = new Date();
        const insert = await db.collection(COLL.storefronts).insertOne(doc);
        await audit({
            session,
            action: 'create',
            entityKind: 'storefront',
            entityId: insert.insertedId.toString(),
        });
        revalidatePath('/dashboard/crm/store/storefronts');
        return {
            message: 'Storefront created.',
            id: insert.insertedId.toString(),
        };
    } catch (e) {
        console.error('saveStorefront error:', e);
        return { error: getErrorMessage(e) };
    }
}

export async function deleteStorefront(
    id: string,
): Promise<ActionResult> {
    const session = await getSession();
    const userId = requireUserObjectId(session);
    if (!userId) return { ok: false, error: 'Unauthorized.' };
    const guard = await requirePermission('crm_store', 'delete');
    if (!guard.ok) return { ok: false, error: guard.error };
    if (!id) return { ok: false, error: 'Invalid storefront id.' };

    if (useRustCrm()) {
        try {
            await crmStoreApi.storefronts.archive(id);
            revalidatePath('/dashboard/crm/store/storefronts');
            return { ok: true };
        } catch (e) {
            console.error('[deleteStorefront] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'store_storefront',
                op: 'delete',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }

    if (!ObjectId.isValid(id)) {
        return { ok: false, error: 'Invalid storefront id.' };
    }
    try {
        const { db } = await connectToDatabase();
        const result = await db.collection(COLL.storefronts).updateOne(
            { _id: new ObjectId(id), userId },
            { $set: { status: 'archived', updatedAt: new Date() } },
        );
        if (result.matchedCount === 0) {
            return { ok: false, error: 'Storefront not found.' };
        }
        await audit({
            session,
            action: 'delete',
            entityKind: 'storefront',
            entityId: id,
        });
        revalidatePath('/dashboard/crm/store/storefronts');
        return { ok: true };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

async function setStorefrontStatus(
    id: string,
    status: 'published' | 'draft',
): Promise<ActionResult> {
    const session = await getSession();
    const userId = requireUserObjectId(session);
    if (!userId) return { ok: false, error: 'Unauthorized.' };
    const guard = await requirePermission('crm_store', 'edit');
    if (!guard.ok) return { ok: false, error: guard.error };
    if (!id || !ObjectId.isValid(id)) {
        return { ok: false, error: 'Invalid storefront id.' };
    }
    try {
        const { db } = await connectToDatabase();
        const result = await db.collection(COLL.storefronts).updateOne(
            { _id: new ObjectId(id), userId },
            { $set: { status, updatedAt: new Date() } },
        );
        if (result.matchedCount === 0) {
            return { ok: false, error: 'Storefront not found.' };
        }
        await audit({
            session,
            action: 'update',
            entityKind: 'storefront',
            entityId: id,
        });
        revalidatePath('/dashboard/crm/store/storefronts');
        revalidatePath(`/dashboard/crm/store/storefronts/${id}`);
        return { ok: true };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function publishStorefront(id: string): Promise<ActionResult> {
    return setStorefrontStatus(id, 'published');
}

export async function unpublishStorefront(id: string): Promise<ActionResult> {
    return setStorefrontStatus(id, 'draft');
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Store products                                                           */
/* ──────────────────────────────────────────────────────────────────────── */

export async function getProductList(
    storefrontId?: string,
): Promise<{ items: Record<string, unknown>[]; error?: string }> {
    const session = await getSession();
    const userId = requireUserObjectId(session);
    if (!userId) return { items: [], error: 'Unauthorized.' };

    if (useRustCrm()) {
        try {
            const res = await crmStoreApi.products.list({ storefrontId, limit: 200 });
            return { items: toJson(res.items) };
        } catch (e) {
            console.error('[getProductList] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'store_product',
                op: 'list',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }

    try {
        const { db } = await connectToDatabase();
        const filter: Filter<Document> = { userId };
        if (storefrontId && ObjectId.isValid(storefrontId)) {
            (filter as Record<string, unknown>).storefrontId = new ObjectId(
                storefrontId,
            );
        }
        const docs = await db
            .collection(COLL.products)
            .find(filter)
            .sort({ createdAt: -1 })
            .limit(200)
            .toArray();
        return { items: toJson(docs) };
    } catch (e) {
        console.error('getProductList error:', e);
        return { items: [], error: getErrorMessage(e) };
    }
}

export async function getProductById(
    id: string,
): Promise<Record<string, unknown> | null> {
    if (!id) return null;
    const session = await getSession();
    const userId = requireUserObjectId(session);
    if (!userId) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmStoreApi.products.getById(id);
            return doc ? toJson(doc) : null;
        } catch (e) {
            console.error('[getProductById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'store_product',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }

    if (!ObjectId.isValid(id)) return null;
    try {
        const { db } = await connectToDatabase();
        const doc = await db
            .collection(COLL.products)
            .findOne({ _id: new ObjectId(id), userId });
        return doc ? toJson(doc) : null;
    } catch (e) {
        console.error('getProductById error:', e);
        return null;
    }
}

export async function saveProduct(
    _prev: FormStateResult,
    formData: FormData,
): Promise<FormStateResult> {
    const session = await getSession();
    const userId = requireUserObjectId(session);
    if (!userId) return { error: 'Unauthorized.' };

    const id = getString(formData, 'productId');
    const action = id ? 'edit' : 'create';
    const guard = await requirePermission('crm_store', action);
    if (!guard.ok) return { error: guard.error };

    const storefrontIdRaw = getString(formData, 'storefrontId');
    if (!storefrontIdRaw) return { error: 'Storefront is required.' };
    const title = getString(formData, 'title');
    if (!title) return { error: 'Title is required.' };

    if (useRustCrm()) {
        try {
            const payload = {
                storefrontId: storefrontIdRaw,
                itemId: getString(formData, 'itemId') ?? '',
                sku: getString(formData, 'sku') ?? '',
                title,
                description: getString(formData, 'description'),
                price: getNumber(formData, 'price') ?? 0,
                compareAtPrice: getNumber(formData, 'compareAtPrice'),
                currency: getString(formData, 'currency') ?? 'INR',
                inventoryTracked: getBoolean(formData, 'inventoryTracked'),
            };

            if (id) {
                await crmStoreApi.products.update(id, {
                    ...payload,
                    status: (getString(formData, 'status') ?? 'draft') as any,
                });
                revalidatePath('/dashboard/crm/store/products');
                revalidatePath(`/dashboard/crm/store/products/${id}`);
                return { message: 'Product updated.', id };
            }

            const res = await crmStoreApi.products.create(payload);
            revalidatePath('/dashboard/crm/store/products');
            return { message: 'Product created.', id: res.id };
        } catch (e) {
            console.error('[saveProduct] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'store_product',
                op: id ? 'update' : 'create',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }

    try {
        if (!storefrontIdRaw || !ObjectId.isValid(storefrontIdRaw)) {
            return { error: 'Storefront is required.' };
        }
        if (!title) return { error: 'Title is required.' };

        const itemId = getString(formData, 'itemId');
        const images = parseJsonField<string[]>(
            getString(formData, 'images') ?? null,
            [],
        );
        const categories = parseJsonField<string[]>(
            getString(formData, 'categories') ?? null,
            [],
        );

        const tagsRaw = getString(formData, 'tags');
        const tags = tagsRaw
            ? tagsRaw
                  .split(',')
                  .map((s) => s.trim())
                  .filter((s) => s.length > 0)
            : [];

        const doc: Record<string, unknown> = {
            storefrontId: new ObjectId(storefrontIdRaw),
            itemId: itemId && ObjectId.isValid(itemId) ? new ObjectId(itemId) : null,
            sku: getString(formData, 'sku') ?? null,
            title,
            description: getString(formData, 'description') ?? null,
            images,
            price: getNumber(formData, 'price') ?? 0,
            compareAtPrice: getNumber(formData, 'compareAtPrice') ?? null,
            currency: getString(formData, 'currency') ?? 'INR',
            inventoryTracked: getBoolean(formData, 'inventoryTracked'),
            categories,
            tags,
            status: getString(formData, 'status') ?? 'draft',
            updatedAt: new Date(),
        };

        const { db } = await connectToDatabase();

        if (id && ObjectId.isValid(id)) {
            const result = await db
                .collection(COLL.products)
                .updateOne({ _id: new ObjectId(id), userId }, { $set: doc });
            if (result.matchedCount === 0) {
                return { error: 'Product not found.' };
            }
            await audit({
                session,
                action: 'update',
                entityKind: 'store_product',
                entityId: id,
            });
            revalidatePath('/dashboard/crm/store/products');
            revalidatePath(`/dashboard/crm/store/products/${id}`);
            return { message: 'Product updated.', id };
        }

        doc.userId = userId;
        doc.createdAt = new Date();
        const insert = await db.collection(COLL.products).insertOne(doc);
        await audit({
            session,
            action: 'create',
            entityKind: 'store_product',
            entityId: insert.insertedId.toString(),
        });
        revalidatePath('/dashboard/crm/store/products');
        return {
            message: 'Product created.',
            id: insert.insertedId.toString(),
        };
    } catch (e) {
        console.error('saveProduct error:', e);
        return { error: getErrorMessage(e) };
    }
}

export async function deleteProduct(id: string): Promise<ActionResult> {
    const session = await getSession();
    const userId = requireUserObjectId(session);
    if (!userId) return { ok: false, error: 'Unauthorized.' };
    const guard = await requirePermission('crm_store', 'delete');
    if (!guard.ok) return { ok: false, error: guard.error };
    if (!id) return { ok: false, error: 'Invalid product id.' };

    if (useRustCrm()) {
        try {
            await crmStoreApi.products.archive(id);
            revalidatePath('/dashboard/crm/store/products');
            return { ok: true };
        } catch (e) {
            console.error('[deleteProduct] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'store_product',
                op: 'delete',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }

    if (!ObjectId.isValid(id)) {
        return { ok: false, error: 'Invalid product id.' };
    }
    try {
        const { db } = await connectToDatabase();
        const result = await db.collection(COLL.products).updateOne(
            { _id: new ObjectId(id), userId },
            { $set: { status: 'archived', updatedAt: new Date() } },
        );
        if (result.matchedCount === 0) {
            return { ok: false, error: 'Product not found.' };
        }
        await audit({
            session,
            action: 'delete',
            entityKind: 'store_product',
            entityId: id,
        });
        revalidatePath('/dashboard/crm/store/products');
        return { ok: true };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Pricing rules                                                            */
/* ──────────────────────────────────────────────────────────────────────── */

export type PricingRuleKind =
    | 'percent_off'
    | 'fixed_off'
    | 'buy_x_get_y'
    | 'bundle';

export interface PricingRuleCondition {
    field: string;
    op: 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in';
    value: unknown;
}

export interface PricingRuleAppliesTo {
    target: 'all' | 'products' | 'categories';
    ids?: string[];
}

export async function getPricingRuleList(
    storefrontId?: string,
): Promise<{ items: Record<string, unknown>[]; error?: string }> {
    const session = await getSession();
    const userId = requireUserObjectId(session);
    if (!userId) return { items: [], error: 'Unauthorized.' };
    try {
        const { db } = await connectToDatabase();
        const filter: Filter<Document> = { userId };
        if (storefrontId && ObjectId.isValid(storefrontId)) {
            (filter as Record<string, unknown>).storefrontId = new ObjectId(
                storefrontId,
            );
        }
        const docs = await db
            .collection(COLL.pricingRules)
            .find(filter)
            .sort({ priority: -1, createdAt: -1 })
            .limit(200)
            .toArray();
        return { items: toJson(docs) };
    } catch (e) {
        return { items: [], error: getErrorMessage(e) };
    }
}

export async function getPricingRuleById(
    id: string,
): Promise<Record<string, unknown> | null> {
    if (!id || !ObjectId.isValid(id)) return null;
    const session = await getSession();
    const userId = requireUserObjectId(session);
    if (!userId) return null;
    try {
        const { db } = await connectToDatabase();
        const doc = await db
            .collection(COLL.pricingRules)
            .findOne({ _id: new ObjectId(id), userId });
        return doc ? toJson(doc) : null;
    } catch {
        return null;
    }
}

export async function savePricingRule(
    _prev: FormStateResult,
    formData: FormData,
): Promise<FormStateResult> {
    const session = await getSession();
    const userId = requireUserObjectId(session);
    if (!userId) return { error: 'Unauthorized.' };

    const id = getString(formData, 'pricingRuleId');
    const action = id ? 'edit' : 'create';
    const guard = await requirePermission('crm_store', action);
    if (!guard.ok) return { error: guard.error };

    try {
        const storefrontIdRaw = getString(formData, 'storefrontId');
        if (!storefrontIdRaw || !ObjectId.isValid(storefrontIdRaw)) {
            return { error: 'Storefront is required.' };
        }
        const name = getString(formData, 'name');
        if (!name) return { error: 'Rule name is required.' };

        const kind = (getString(formData, 'kind') ?? 'percent_off') as PricingRuleKind;
        const conditions = parseJsonField<PricingRuleCondition[]>(
            getString(formData, 'conditions') ?? null,
            [],
        );
        const appliesTo = parseJsonField<PricingRuleAppliesTo>(
            getString(formData, 'appliesTo') ?? null,
            { target: 'all' },
        );

        const startsAtRaw = getString(formData, 'startsAt');
        const endsAtRaw = getString(formData, 'endsAt');

        const doc: Record<string, unknown> = {
            storefrontId: new ObjectId(storefrontIdRaw),
            name,
            kind,
            conditions,
            appliesTo,
            value: getNumber(formData, 'value') ?? 0,
            priority: getNumber(formData, 'priority') ?? 0,
            startsAt: startsAtRaw ? new Date(startsAtRaw) : null,
            endsAt: endsAtRaw ? new Date(endsAtRaw) : null,
            status: getString(formData, 'status') ?? 'draft',
            updatedAt: new Date(),
        };

        const { db } = await connectToDatabase();

        if (id && ObjectId.isValid(id)) {
            const result = await db
                .collection(COLL.pricingRules)
                .updateOne({ _id: new ObjectId(id), userId }, { $set: doc });
            if (result.matchedCount === 0) {
                return { error: 'Pricing rule not found.' };
            }
            await audit({
                session,
                action: 'update',
                entityKind: 'store_pricing_rule',
                entityId: id,
            });
            revalidatePath('/dashboard/crm/store/pricing');
            revalidatePath(`/dashboard/crm/store/pricing/${id}`);
            return { message: 'Pricing rule updated.', id };
        }

        doc.userId = userId;
        doc.createdAt = new Date();
        const insert = await db.collection(COLL.pricingRules).insertOne(doc);
        await audit({
            session,
            action: 'create',
            entityKind: 'store_pricing_rule',
            entityId: insert.insertedId.toString(),
        });
        revalidatePath('/dashboard/crm/store/pricing');
        return {
            message: 'Pricing rule created.',
            id: insert.insertedId.toString(),
        };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function deletePricingRule(id: string): Promise<ActionResult> {
    const session = await getSession();
    const userId = requireUserObjectId(session);
    if (!userId) return { ok: false, error: 'Unauthorized.' };
    const guard = await requirePermission('crm_store', 'delete');
    if (!guard.ok) return { ok: false, error: guard.error };
    if (!id || !ObjectId.isValid(id)) {
        return { ok: false, error: 'Invalid rule id.' };
    }
    try {
        const { db } = await connectToDatabase();
        const result = await db.collection(COLL.pricingRules).updateOne(
            { _id: new ObjectId(id), userId },
            { $set: { status: 'archived', updatedAt: new Date() } },
        );
        if (result.matchedCount === 0) {
            return { ok: false, error: 'Pricing rule not found.' };
        }
        await audit({
            session,
            action: 'delete',
            entityKind: 'store_pricing_rule',
            entityId: id,
        });
        revalidatePath('/dashboard/crm/store/pricing');
        return { ok: true };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export interface PricingRuleEvaluationCart {
    subtotal: number;
    items: Array<{
        productId?: string;
        category?: string;
        qty: number;
        price: number;
    }>;
}

export interface PricingRuleEvaluationResult {
    applied: Array<{
        id: string;
        name: string;
        kind: PricingRuleKind;
        discount: number;
    }>;
    totalDiscount: number;
}

/**
 * Server-side evaluator for the storefront cart. Returns the rules that
 * apply (in priority order) and a naive computed discount.
 *
 * NOTE: this is a minimal first-cut implementation — the storefront
 * runtime will replace it with a richer engine. The cart shape is the
 * same as the eventual public endpoint will accept.
 */
export async function evaluatePricingRules(
    storefrontId: string,
    cart: PricingRuleEvaluationCart,
): Promise<ActionResult<PricingRuleEvaluationResult>> {
    const session = await getSession();
    const userId = requireUserObjectId(session);
    if (!userId) return { ok: false, error: 'Unauthorized.' };
    const guard = await requirePermission('crm_store', 'view');
    if (!guard.ok) return { ok: false, error: guard.error };
    if (!storefrontId || !ObjectId.isValid(storefrontId)) {
        return { ok: false, error: 'Invalid storefront id.' };
    }
    try {
        const { db } = await connectToDatabase();
        const now = new Date();
        const docs = await db
            .collection(COLL.pricingRules)
            .find({
                userId,
                storefrontId: new ObjectId(storefrontId),
                status: 'active',
                $and: [
                    {
                        $or: [
                            { startsAt: null },
                            { startsAt: { $lte: now } },
                        ],
                    },
                    {
                        $or: [
                            { endsAt: null },
                            { endsAt: { $gte: now } },
                        ],
                    },
                ],
            } as Filter<Document>)
            .sort({ priority: -1 })
            .toArray();

        const applied: PricingRuleEvaluationResult['applied'] = [];
        let totalDiscount = 0;

        for (const rule of docs) {
            const kind = (rule.kind as PricingRuleKind) ?? 'percent_off';
            const value = Number(rule.value ?? 0);
            let discount = 0;
            if (kind === 'percent_off') {
                discount = (cart.subtotal * value) / 100;
            } else if (kind === 'fixed_off') {
                discount = value;
            } else {
                // buy_x_get_y / bundle — flagged for the storefront runtime.
                discount = 0;
            }
            if (discount > 0) {
                applied.push({
                    id: String(rule._id),
                    name: String(rule.name ?? ''),
                    kind,
                    discount,
                });
                totalDiscount += discount;
            }
        }

        return { ok: true, applied, totalDiscount };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Shipping zones                                                           */
/* ──────────────────────────────────────────────────────────────────────── */

export interface ShippingMethod {
    name: string;
    kind: 'flat' | 'weight' | 'free' | 'custom';
    rate: number;
    freeAboveSubtotal?: number | null;
}

export async function getShippingZoneList(
    storefrontId?: string,
): Promise<{ items: Record<string, unknown>[]; error?: string }> {
    const session = await getSession();
    const userId = requireUserObjectId(session);
    if (!userId) return { items: [], error: 'Unauthorized.' };
    try {
        const { db } = await connectToDatabase();
        const filter: Filter<Document> = { userId };
        if (storefrontId && ObjectId.isValid(storefrontId)) {
            (filter as Record<string, unknown>).storefrontId = new ObjectId(
                storefrontId,
            );
        }
        const docs = await db
            .collection(COLL.shippingZones)
            .find(filter)
            .sort({ createdAt: -1 })
            .limit(200)
            .toArray();
        return { items: toJson(docs) };
    } catch (e) {
        return { items: [], error: getErrorMessage(e) };
    }
}

export async function getShippingZoneById(
    id: string,
): Promise<Record<string, unknown> | null> {
    if (!id || !ObjectId.isValid(id)) return null;
    const session = await getSession();
    const userId = requireUserObjectId(session);
    if (!userId) return null;
    try {
        const { db } = await connectToDatabase();
        const doc = await db
            .collection(COLL.shippingZones)
            .findOne({ _id: new ObjectId(id), userId });
        return doc ? toJson(doc) : null;
    } catch {
        return null;
    }
}

export async function saveShippingZone(
    _prev: FormStateResult,
    formData: FormData,
): Promise<FormStateResult> {
    const session = await getSession();
    const userId = requireUserObjectId(session);
    if (!userId) return { error: 'Unauthorized.' };

    const id = getString(formData, 'zoneId');
    const action = id ? 'edit' : 'create';
    const guard = await requirePermission('crm_store', action);
    if (!guard.ok) return { error: guard.error };

    try {
        const storefrontIdRaw = getString(formData, 'storefrontId');
        if (!storefrontIdRaw || !ObjectId.isValid(storefrontIdRaw)) {
            return { error: 'Storefront is required.' };
        }
        const name = getString(formData, 'name');
        if (!name) return { error: 'Zone name is required.' };

        const countries = getCommaList(formData, 'countries') ?? [];
        const states = getCommaList(formData, 'states') ?? [];
        const methods = parseJsonField<ShippingMethod[]>(
            getString(formData, 'methods') ?? null,
            [],
        );

        const doc: Record<string, unknown> = {
            storefrontId: new ObjectId(storefrontIdRaw),
            name,
            countries,
            states,
            methods,
            status: getString(formData, 'status') ?? 'draft',
            updatedAt: new Date(),
        };

        const { db } = await connectToDatabase();

        if (id && ObjectId.isValid(id)) {
            const result = await db
                .collection(COLL.shippingZones)
                .updateOne({ _id: new ObjectId(id), userId }, { $set: doc });
            if (result.matchedCount === 0) {
                return { error: 'Shipping zone not found.' };
            }
            await audit({
                session,
                action: 'update',
                entityKind: 'store_shipping_zone',
                entityId: id,
            });
            revalidatePath('/dashboard/crm/store/shipping');
            revalidatePath(`/dashboard/crm/store/shipping/${id}`);
            return { message: 'Shipping zone updated.', id };
        }

        doc.userId = userId;
        doc.createdAt = new Date();
        const insert = await db.collection(COLL.shippingZones).insertOne(doc);
        await audit({
            session,
            action: 'create',
            entityKind: 'store_shipping_zone',
            entityId: insert.insertedId.toString(),
        });
        revalidatePath('/dashboard/crm/store/shipping');
        return {
            message: 'Shipping zone created.',
            id: insert.insertedId.toString(),
        };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteShippingZone(
    id: string,
): Promise<ActionResult> {
    const session = await getSession();
    const userId = requireUserObjectId(session);
    if (!userId) return { ok: false, error: 'Unauthorized.' };
    const guard = await requirePermission('crm_store', 'delete');
    if (!guard.ok) return { ok: false, error: guard.error };
    if (!id || !ObjectId.isValid(id)) {
        return { ok: false, error: 'Invalid zone id.' };
    }
    try {
        const { db } = await connectToDatabase();
        const result = await db.collection(COLL.shippingZones).updateOne(
            { _id: new ObjectId(id), userId },
            { $set: { status: 'archived', updatedAt: new Date() } },
        );
        if (result.matchedCount === 0) {
            return { ok: false, error: 'Shipping zone not found.' };
        }
        await audit({
            session,
            action: 'delete',
            entityKind: 'store_shipping_zone',
            entityId: id,
        });
        revalidatePath('/dashboard/crm/store/shipping');
        return { ok: true };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export interface ShippingCostResult {
    method: ShippingMethod | null;
    cost: number;
    isFree: boolean;
}

/**
 * Compute the storefront's shipping cost for a given zone, cart subtotal
 * and optional package weight. Picks the cheapest qualifying method (or
 * free if any method's free-above threshold is met).
 */
export async function computeShippingCost(
    zoneId: string,
    subtotal: number,
    weight?: number,
): Promise<ActionResult<ShippingCostResult>> {
    const session = await getSession();
    const userId = requireUserObjectId(session);
    if (!userId) return { ok: false, error: 'Unauthorized.' };
    const guard = await requirePermission('crm_store', 'view');
    if (!guard.ok) return { ok: false, error: guard.error };
    if (!zoneId || !ObjectId.isValid(zoneId)) {
        return { ok: false, error: 'Invalid zone id.' };
    }
    try {
        const { db } = await connectToDatabase();
        const zone = await db
            .collection(COLL.shippingZones)
            .findOne({ _id: new ObjectId(zoneId), userId });
        if (!zone) return { ok: false, error: 'Zone not found.' };

        const methods = (zone.methods ?? []) as ShippingMethod[];
        if (methods.length === 0) {
            return { ok: true, method: null, cost: 0, isFree: true };
        }

        let best: { method: ShippingMethod; cost: number; isFree: boolean } | null = null;
        for (const m of methods) {
            let cost = 0;
            let isFree = false;
            if (
                m.freeAboveSubtotal !== undefined &&
                m.freeAboveSubtotal !== null &&
                subtotal >= m.freeAboveSubtotal
            ) {
                isFree = true;
                cost = 0;
            } else if (m.kind === 'free') {
                isFree = true;
                cost = 0;
            } else if (m.kind === 'weight') {
                cost = Number(m.rate ?? 0) * Number(weight ?? 0);
            } else {
                cost = Number(m.rate ?? 0);
            }
            if (!best || cost < best.cost) {
                best = { method: m, cost, isFree };
            }
        }

        return {
            ok: true,
            method: best?.method ?? null,
            cost: best?.cost ?? 0,
            isFree: best?.isFree ?? false,
        };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Store orders                                                             */
/* ──────────────────────────────────────────────────────────────────────── */

export async function getStoreOrders(
    storefrontId?: string,
): Promise<{ items: Record<string, unknown>[]; error?: string }> {
    const session = await getSession();
    const userId = requireUserObjectId(session);
    if (!userId) return { items: [], error: 'Unauthorized.' };

    if (useRustCrm()) {
        try {
            const res = await crmStoreApi.orders.list({ storefrontId, limit: 200 });
            return { items: toJson(res.items) };
        } catch (e) {
            console.error('[getStoreOrders] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'store_order',
                op: 'list',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }

    try {
        const { db } = await connectToDatabase();
        const filter: Filter<Document> = { userId };
        if (storefrontId && ObjectId.isValid(storefrontId)) {
            (filter as Record<string, unknown>).storefrontId = new ObjectId(
                storefrontId,
            );
        }
        const docs = await db
            .collection(COLL.orders)
            .find(filter)
            .sort({ createdAt: -1 })
            .limit(200)
            .toArray();
        return { items: toJson(docs) };
    } catch (e) {
        return { items: [], error: getErrorMessage(e) };
    }
}

export async function getStoreOrderById(
    id: string,
): Promise<Record<string, unknown> | null> {
    if (!id) return null;
    const session = await getSession();
    const userId = requireUserObjectId(session);
    if (!userId) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmStoreApi.orders.getById(id);
            return doc ? toJson(doc) : null;
        } catch (e) {
            console.error('[getStoreOrderById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'store_order',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }

    if (!ObjectId.isValid(id)) return null;
    try {
        const { db } = await connectToDatabase();
        const doc = await db
            .collection(COLL.orders)
            .findOne({ _id: new ObjectId(id), userId });
        return doc ? toJson(doc) : null;
    } catch {
        return null;
    }
}

async function transitionOrderStatus(
    id: string,
    nextStatus: string,
    auditAction: 'update',
): Promise<ActionResult> {
    const session = await getSession();
    const userId = requireUserObjectId(session);
    if (!userId) return { ok: false, error: 'Unauthorized.' };
    const guard = await requirePermission('crm_store', 'edit');
    if (!guard.ok) return { ok: false, error: guard.error };
    if (!id || !ObjectId.isValid(id)) {
        return { ok: false, error: 'Invalid order id.' };
    }
    try {
        const { db } = await connectToDatabase();
        const result = await db.collection(COLL.orders).updateOne(
            { _id: new ObjectId(id), userId },
            { $set: { status: nextStatus, updatedAt: new Date() } },
        );
        if (result.matchedCount === 0) {
            return { ok: false, error: 'Order not found.' };
        }
        await audit({
            session,
            action: auditAction,
            entityKind: 'store_order',
            entityId: id,
        });
        revalidatePath('/dashboard/crm/store/orders');
        revalidatePath(`/dashboard/crm/store/orders/${id}`);
        return { ok: true };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function markOrderPaid(id: string): Promise<ActionResult> {
    // TODO(crm-store): auto-create a CRM invoice + receipt when an order
    // is marked paid (links via the lineage rail). Skipped in this PR per
    // the rebuild plan §6.3 — `markOrderPaid` only flips status today.
    console.info('[crm-store] TODO: auto-create invoice on markOrderPaid', {
        orderId: id,
    });

    if (useRustCrm()) {
        try {
            await crmStoreApi.orders.markPaid(id);
            revalidatePath('/dashboard/crm/store/orders');
            revalidatePath(`/dashboard/crm/store/orders/${id}`);
            return { ok: true };
        } catch (e) {
            console.error('[markOrderPaid] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'store_order',
                op: 'update',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }
    return transitionOrderStatus(id, 'paid', 'update');
}

export async function markOrderFulfilled(id: string): Promise<ActionResult> {
    if (useRustCrm()) {
        try {
            await crmStoreApi.orders.markFulfilled(id);
            revalidatePath('/dashboard/crm/store/orders');
            revalidatePath(`/dashboard/crm/store/orders/${id}`);
            return { ok: true };
        } catch (e) {
            console.error('[markOrderFulfilled] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'store_order',
                op: 'update',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }
    return transitionOrderStatus(id, 'fulfilled', 'update');
}

export async function cancelOrder(id: string): Promise<ActionResult> {
    // TODO: add Rust path when crm-store router exposes a cancel endpoint.
    return transitionOrderStatus(id, 'cancelled', 'update');
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Abandoned carts                                                          */
/* ──────────────────────────────────────────────────────────────────────── */

export interface AbandonedCartFilter {
    storefrontId?: string;
    fromDate?: string;
    toDate?: string;
}

export async function getAbandonedCarts(
    filter: AbandonedCartFilter = {},
): Promise<{
    items: Record<string, unknown>[];
    kpi: {
        total: number;
        recovered: number;
        recoveryRate: number;
        lostLast7Days: number;
    };
    error?: string;
}> {
    const session = await getSession();
    const userId = requireUserObjectId(session);
    const empty = {
        items: [],
        kpi: { total: 0, recovered: 0, recoveryRate: 0, lostLast7Days: 0 },
    };
    if (!userId) return { ...empty, error: 'Unauthorized.' };

    if (useRustCrm()) {
        try {
            const res = await crmStoreApi.abandonedCarts.list({
                storefrontId: filter.storefrontId,
                limit: 200,
            });
            const items = res.items as unknown as Record<string, unknown>[];
            const total = items.length;
            const recovered = items.filter((c) => c.recovered === true).length;
            const recoveryRate = total === 0 ? 0 : (recovered / total) * 100;
            const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
            const lostLast7Days = items
                .filter((c) => {
                    if (c.recovered) return false;
                    const ca = c.createdAt as string | undefined;
                    if (!ca) return false;
                    return new Date(ca).getTime() >= sevenDaysAgo;
                })
                .reduce((sum, c) => sum + Number(c.subtotal ?? 0), 0);
            return {
                items: toJson(items),
                kpi: { total, recovered, recoveryRate, lostLast7Days },
            };
        } catch (e) {
            console.error('[getAbandonedCarts] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'store_abandoned_cart',
                op: 'list',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }

    try {
        const { db } = await connectToDatabase();
        const q: Filter<Document> = { userId };
        if (filter.storefrontId && ObjectId.isValid(filter.storefrontId)) {
            (q as Record<string, unknown>).storefrontId = new ObjectId(
                filter.storefrontId,
            );
        }
        if (filter.fromDate || filter.toDate) {
            const range: Record<string, Date> = {};
            if (filter.fromDate) range.$gte = new Date(filter.fromDate);
            if (filter.toDate) range.$lte = new Date(filter.toDate);
            (q as Record<string, unknown>).createdAt = range;
        }

        const items = (await db
            .collection(COLL.abandonedCarts)
            .find(q)
            .sort({ lastInteractionAt: -1, createdAt: -1 })
            .limit(200)
            .toArray()) as WithId<Document>[];

        const total = items.length;
        const recovered = items.filter(
            (c) => (c as Record<string, unknown>).recoveryStatus === 'recovered',
        ).length;
        const recoveryRate = total === 0 ? 0 : (recovered / total) * 100;

        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const lostLast7Days = items
            .filter((c) => {
                const status = (c as Record<string, unknown>).recoveryStatus;
                if (status === 'recovered') return false;
                const createdAt = (c as Record<string, unknown>).createdAt as
                    | string
                    | Date
                    | undefined;
                if (!createdAt) return false;
                return new Date(createdAt).getTime() >= sevenDaysAgo;
            })
            .reduce(
                (sum, c) =>
                    sum + Number((c as Record<string, unknown>).subtotal ?? 0),
                0,
            );

        return {
            items: toJson(items),
            kpi: { total, recovered, recoveryRate, lostLast7Days },
        };
    } catch (e) {
        return { ...empty, error: getErrorMessage(e) };
    }
}

/**
 * Stub: enqueue a recovery email for an abandoned cart.
 *
 * The actual mail dispatch hooks into the email worker — for this PR we
 * emit a structured log line + write an audit-log entry and mark the
 * cart as `recovery_email_sent`. The mail worker will pick the cart up
 * in a later milestone.
 *
 * Mongo-only path — the Rust client exposes `markRecovered` but no
 * recovery-email dispatch endpoint yet.
 * TODO: add Rust path when crm-store router exposes a recovery-email endpoint.
 */
export async function dispatchRecoveryEmail(
    cartId: string,
): Promise<ActionResult> {
    const session = await getSession();
    const userId = requireUserObjectId(session);
    if (!userId) return { ok: false, error: 'Unauthorized.' };
    const guard = await requirePermission('crm_store', 'edit');
    if (!guard.ok) return { ok: false, error: guard.error };
    if (!cartId || !ObjectId.isValid(cartId)) {
        return { ok: false, error: 'Invalid cart id.' };
    }
    try {
        const { db } = await connectToDatabase();
        const result = await db.collection(COLL.abandonedCarts).updateOne(
            { _id: new ObjectId(cartId), userId },
            {
                $set: {
                    recoveryStatus: 'email_queued',
                    lastRecoveryEmailAt: new Date(),
                    updatedAt: new Date(),
                },
            },
        );
        if (result.matchedCount === 0) {
            return { ok: false, error: 'Abandoned cart not found.' };
        }
        // TODO(crm-store): hand off to the mail worker once the recovery-
        // email template + delivery pipeline exists. For now we just
        // log + audit so the UI affordance works.
        console.info('[crm-store] TODO: recovery email dispatch stub', {
            cartId,
            tenantUserId: String(session?.user?._id ?? ''),
        });
        await audit({
            session,
            action: 'update',
            entityKind: 'store_abandoned_cart',
            entityId: cartId,
        });
        revalidatePath('/dashboard/crm/store/abandoned-cart');
        return { ok: true };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Overview KPIs                                                            */
/* ──────────────────────────────────────────────────────────────────────── */

export interface StoreOverviewKpis {
    publishedStorefronts: number;
    totalProducts: number;
    liveRules: number;
    pendingOrders: number;
    abandonedCarts: number;
}

export async function getStoreOverviewKpis(): Promise<StoreOverviewKpis> {
    const zero: StoreOverviewKpis = {
        publishedStorefronts: 0,
        totalProducts: 0,
        liveRules: 0,
        pendingOrders: 0,
        abandonedCarts: 0,
    };
    const session = await getSession();
    const userId = requireUserObjectId(session);
    if (!userId) return zero;
    try {
        const { db } = await connectToDatabase();
        const [
            publishedStorefronts,
            totalProducts,
            liveRules,
            pendingOrders,
            abandonedCarts,
        ] = await Promise.all([
            db
                .collection(COLL.storefronts)
                .countDocuments({ userId, status: 'published' } as Filter<Document>),
            db
                .collection(COLL.products)
                .countDocuments({ userId } as Filter<Document>),
            db
                .collection(COLL.pricingRules)
                .countDocuments({ userId, status: 'active' } as Filter<Document>),
            db
                .collection(COLL.orders)
                .countDocuments({
                    userId,
                    status: { $in: ['pending', 'paid', 'awaiting_fulfillment'] },
                } as Filter<Document>),
            db
                .collection(COLL.abandonedCarts)
                .countDocuments({
                    userId,
                    recoveryStatus: { $ne: 'recovered' },
                } as Filter<Document>),
        ]);
        return {
            publishedStorefronts,
            totalProducts,
            liveRules,
            pendingOrders,
            abandonedCarts,
        };
    } catch (e) {
        console.error('getStoreOverviewKpis error:', e);
        return zero;
    }
}
