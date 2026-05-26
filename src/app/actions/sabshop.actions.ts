'use server';

/**
 * SabShop — admin server actions.
 *
 * Owns the 8 collections introduced by the SabShop storefront engine:
 *   - sabshop_storefronts
 *   - sabshop_themes
 *   - sabshop_collections
 *   - sabshop_carts
 *   - sabshop_orders
 *   - sabshop_shipping_zones
 *   - sabshop_tax_rules
 *   - sabshop_checkouts
 *
 * All actions are tenant-scoped on `userId` (the session user that
 * owns the workspace) and degrade to direct-Mongo when the Rust BFF
 * is unreachable.
 *
 * Public storefront actions live in `storefront.actions.ts`.
 *
 * TODO(sabshop): register `sabshop` permission key in
 * `permission-modules.ts` for RBAC gating; today actions only require
 * a logged-in user.
 */

import { ObjectId, type Filter, type WithId, type Document } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { getErrorMessage } from '@/lib/utils';

type ActionOk<T> = { ok: true } & T;
type ActionErr = { ok: false; error: string };
export type SabshopActionResult<T = Record<string, unknown>> = ActionOk<T> | ActionErr;

const COLL = {
    storefronts: 'sabshop_storefronts',
    themes: 'sabshop_themes',
    collections: 'sabshop_collections',
    carts: 'sabshop_carts',
    orders: 'sabshop_orders',
    shippingZones: 'sabshop_shipping_zones',
    taxRules: 'sabshop_tax_rules',
    checkouts: 'sabshop_checkouts',
} as const;

function toJson<T>(doc: unknown): T {
    return JSON.parse(JSON.stringify(doc)) as T;
}

async function requireUserId(): Promise<ObjectId> {
    const session = await getSession();
    const userId = (session as { user?: { _id?: string } } | null)?.user?._id;
    if (!userId) throw new Error('Not authenticated');
    return new ObjectId(userId);
}

function parseOidOrNull(v: unknown): ObjectId | null {
    if (typeof v !== 'string' || !ObjectId.isValid(v)) return null;
    return new ObjectId(v);
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Storefronts                                                          */
/* ──────────────────────────────────────────────────────────────────── */

export async function listStorefronts(): Promise<SabshopActionResult<{ items: unknown[] }>> {
    try {
        const userId = await requireUserId();
        const { db } = await connectToDatabase();
        const rows = await db
            .collection(COLL.storefronts)
            .find({ userId } as Filter<Document>)
            .sort({ createdAt: -1 })
            .toArray();
        return { ok: true, items: toJson(rows) };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function getStorefront(id: string): Promise<SabshopActionResult<{ item: unknown }>> {
    try {
        const userId = await requireUserId();
        const oid = parseOidOrNull(id);
        if (!oid) return { ok: false, error: 'Invalid storefront id' };
        const { db } = await connectToDatabase();
        const row = await db.collection(COLL.storefronts).findOne({ _id: oid, userId } as Filter<Document>);
        if (!row) return { ok: false, error: 'Storefront not found' };
        return { ok: true, item: toJson(row) };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function getStorefrontBySlug(slug: string): Promise<SabshopActionResult<{ item: unknown }>> {
    try {
        const userId = await requireUserId();
        const { db } = await connectToDatabase();
        const row = await db.collection(COLL.storefronts).findOne({ slug: slug.toLowerCase(), userId } as Filter<Document>);
        if (!row) return { ok: false, error: 'Storefront not found' };
        return { ok: true, item: toJson(row) };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export interface StorefrontCreateData {
    slug: string;
    displayName: string;
    description?: string;
    currency?: string;
    themeId?: string;
}

export async function createStorefront(input: StorefrontCreateData): Promise<SabshopActionResult<{ id: string }>> {
    try {
        if (!input.slug?.trim()) return { ok: false, error: 'Slug is required' };
        if (!input.displayName?.trim()) return { ok: false, error: 'Display name is required' };
        const userId = await requireUserId();
        const { db } = await connectToDatabase();
        const slug = input.slug.trim().toLowerCase();
        const exists = await db.collection(COLL.storefronts).findOne({ slug, userId } as Filter<Document>);
        if (exists) return { ok: false, error: 'A storefront with that slug already exists' };
        const doc = {
            userId,
            slug,
            displayName: input.displayName.trim(),
            description: input.description ?? '',
            currency: input.currency ?? 'INR',
            themeId: parseOidOrNull(input.themeId ?? '') ?? undefined,
            status: 'draft' as const,
            shippingZoneIds: [],
            taxRuleIds: [],
            featuredProductIds: [],
            featuredCollectionIds: [],
            publishedProductIds: [],
            createdAt: new Date(),
        };
        const r = await db.collection(COLL.storefronts).insertOne(doc as Document);
        revalidatePath('/dashboard/sabshop');
        return { ok: true, id: r.insertedId.toHexString() };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function updateStorefront(
    id: string,
    patch: Record<string, unknown>,
): Promise<SabshopActionResult> {
    try {
        const userId = await requireUserId();
        const oid = parseOidOrNull(id);
        if (!oid) return { ok: false, error: 'Invalid storefront id' };
        const { db } = await connectToDatabase();
        const set: Record<string, unknown> = { updatedAt: new Date() };
        for (const k of [
            'slug', 'displayName', 'description', 'currency', 'status', 'customCss',
            'logoUrl', 'faviconUrl', 'heroImageUrl', 'heroTitle', 'heroSubtitle',
        ]) {
            if (k in patch) set[k] = patch[k];
        }
        if (patch.themeId && typeof patch.themeId === 'string') {
            const t = parseOidOrNull(patch.themeId);
            if (t) set.themeId = t;
        }
        for (const k of [
            'shippingZoneIds', 'taxRuleIds', 'featuredProductIds',
            'featuredCollectionIds', 'publishedProductIds',
        ]) {
            if (Array.isArray(patch[k])) {
                set[k] = (patch[k] as unknown[])
                    .filter((v): v is string => typeof v === 'string' && ObjectId.isValid(v))
                    .map((v) => new ObjectId(v));
            }
        }
        if (typeof set.slug === 'string') set.slug = (set.slug as string).toLowerCase();
        const r = await db.collection(COLL.storefronts).updateOne(
            { _id: oid, userId } as Filter<Document>,
            { $set: set },
        );
        if (!r.matchedCount) return { ok: false, error: 'Storefront not found' };
        revalidatePath('/dashboard/sabshop');
        revalidatePath(`/dashboard/sabshop/${id}`);
        return { ok: true };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function deleteStorefront(id: string): Promise<SabshopActionResult> {
    try {
        const userId = await requireUserId();
        const oid = parseOidOrNull(id);
        if (!oid) return { ok: false, error: 'Invalid storefront id' };
        const { db } = await connectToDatabase();
        await db.collection(COLL.storefronts).deleteOne({ _id: oid, userId } as Filter<Document>);
        revalidatePath('/dashboard/sabshop');
        return { ok: true };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Themes                                                               */
/* ──────────────────────────────────────────────────────────────────── */

export async function listThemes(): Promise<SabshopActionResult<{ items: unknown[] }>> {
    try {
        const userId = await requireUserId();
        const { db } = await connectToDatabase();
        const rows = await db.collection(COLL.themes)
            .find({ $or: [{ userId }, { system: true }] } as Filter<Document>)
            .sort({ system: -1, createdAt: -1 }).toArray();
        return { ok: true, items: toJson(rows) };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function createTheme(input: { name: string; description?: string; configJson?: unknown }): Promise<SabshopActionResult<{ id: string }>> {
    try {
        if (!input.name?.trim()) return { ok: false, error: 'Theme name is required' };
        const userId = await requireUserId();
        const { db } = await connectToDatabase();
        const r = await db.collection(COLL.themes).insertOne({
            userId,
            name: input.name.trim(),
            description: input.description ?? '',
            configJson: input.configJson ?? {},
            system: false,
            createdAt: new Date(),
        } as Document);
        return { ok: true, id: r.insertedId.toHexString() };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function updateTheme(id: string, patch: Record<string, unknown>): Promise<SabshopActionResult> {
    try {
        const userId = await requireUserId();
        const oid = parseOidOrNull(id);
        if (!oid) return { ok: false, error: 'Invalid theme id' };
        const { db } = await connectToDatabase();
        const set: Record<string, unknown> = { updatedAt: new Date() };
        for (const k of ['name', 'description', 'configJson']) if (k in patch) set[k] = patch[k];
        await db.collection(COLL.themes).updateOne({ _id: oid, userId } as Filter<Document>, { $set: set });
        return { ok: true };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function deleteTheme(id: string): Promise<SabshopActionResult> {
    try {
        const userId = await requireUserId();
        const oid = parseOidOrNull(id);
        if (!oid) return { ok: false, error: 'Invalid theme id' };
        const { db } = await connectToDatabase();
        await db.collection(COLL.themes).deleteOne({ _id: oid, userId, system: { $ne: true } } as Filter<Document>);
        return { ok: true };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Collections                                                          */
/* ──────────────────────────────────────────────────────────────────── */

export async function listCollections(storefrontId: string): Promise<SabshopActionResult<{ items: unknown[] }>> {
    try {
        const userId = await requireUserId();
        const sf = parseOidOrNull(storefrontId);
        if (!sf) return { ok: false, error: 'Invalid storefrontId' };
        const { db } = await connectToDatabase();
        const rows = await db.collection(COLL.collections)
            .find({ userId, storefrontId: sf } as Filter<Document>)
            .sort({ createdAt: -1 }).toArray();
        return { ok: true, items: toJson(rows) };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function createCollection(input: {
    storefrontId: string;
    name: string;
    slug: string;
    description?: string;
    imageUrl?: string;
    productIds?: string[];
    published?: boolean;
}): Promise<SabshopActionResult<{ id: string }>> {
    try {
        if (!input.name?.trim()) return { ok: false, error: 'Name is required' };
        if (!input.slug?.trim()) return { ok: false, error: 'Slug is required' };
        const userId = await requireUserId();
        const sf = parseOidOrNull(input.storefrontId);
        if (!sf) return { ok: false, error: 'Invalid storefrontId' };
        const { db } = await connectToDatabase();
        const r = await db.collection(COLL.collections).insertOne({
            userId,
            storefrontId: sf,
            name: input.name.trim(),
            slug: input.slug.trim().toLowerCase(),
            description: input.description ?? '',
            imageUrl: input.imageUrl ?? '',
            productIds: (input.productIds ?? [])
                .filter((v) => ObjectId.isValid(v))
                .map((v) => new ObjectId(v)),
            published: input.published ?? false,
            createdAt: new Date(),
        } as Document);
        return { ok: true, id: r.insertedId.toHexString() };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function updateCollection(id: string, patch: Record<string, unknown>): Promise<SabshopActionResult> {
    try {
        const userId = await requireUserId();
        const oid = parseOidOrNull(id);
        if (!oid) return { ok: false, error: 'Invalid collection id' };
        const { db } = await connectToDatabase();
        const set: Record<string, unknown> = { updatedAt: new Date() };
        for (const k of ['name', 'slug', 'description', 'imageUrl', 'published']) if (k in patch) set[k] = patch[k];
        if (typeof set.slug === 'string') set.slug = (set.slug as string).toLowerCase();
        if (Array.isArray(patch.productIds)) {
            set.productIds = (patch.productIds as unknown[])
                .filter((v): v is string => typeof v === 'string' && ObjectId.isValid(v))
                .map((v) => new ObjectId(v));
        }
        await db.collection(COLL.collections).updateOne({ _id: oid, userId } as Filter<Document>, { $set: set });
        return { ok: true };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function deleteCollection(id: string): Promise<SabshopActionResult> {
    try {
        const userId = await requireUserId();
        const oid = parseOidOrNull(id);
        if (!oid) return { ok: false, error: 'Invalid collection id' };
        const { db } = await connectToDatabase();
        await db.collection(COLL.collections).deleteOne({ _id: oid, userId } as Filter<Document>);
        return { ok: true };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Products (publish/unpublish on storefront)                           */
/* ──────────────────────────────────────────────────────────────────── */

export async function listAvailableProducts(): Promise<SabshopActionResult<{ items: unknown[] }>> {
    try {
        const userId = await requireUserId();
        const { db } = await connectToDatabase();
        // Reuse CRM products collection.
        const rows = await db.collection('crm_products')
            .find({ userId } as Filter<Document>)
            .project({ name: 1, sku: 1, price: 1, salePrice: 1, imageUrls: 1, images: 1, status: 1, description: 1 })
            .limit(500)
            .toArray();
        return { ok: true, items: toJson(rows) };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function setPublishedProducts(
    storefrontId: string,
    productIds: string[],
): Promise<SabshopActionResult> {
    try {
        const userId = await requireUserId();
        const sf = parseOidOrNull(storefrontId);
        if (!sf) return { ok: false, error: 'Invalid storefrontId' };
        const { db } = await connectToDatabase();
        const ids = productIds.filter((v) => ObjectId.isValid(v)).map((v) => new ObjectId(v));
        await db.collection(COLL.storefronts).updateOne(
            { _id: sf, userId } as Filter<Document>,
            { $set: { publishedProductIds: ids, updatedAt: new Date() } },
        );
        revalidatePath(`/dashboard/sabshop/${storefrontId}/products`);
        return { ok: true };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Orders                                                               */
/* ──────────────────────────────────────────────────────────────────── */

export async function listOrders(storefrontId?: string): Promise<SabshopActionResult<{ items: unknown[] }>> {
    try {
        const userId = await requireUserId();
        const { db } = await connectToDatabase();
        const filter: Filter<Document> = { userId };
        if (storefrontId) {
            const sf = parseOidOrNull(storefrontId);
            if (sf) (filter as Record<string, unknown>).storefrontId = sf;
        }
        const rows = await db.collection(COLL.orders).find(filter).sort({ createdAt: -1 }).limit(200).toArray();
        return { ok: true, items: toJson(rows) };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function getOrder(id: string): Promise<SabshopActionResult<{ item: unknown }>> {
    try {
        const userId = await requireUserId();
        const oid = parseOidOrNull(id);
        if (!oid) return { ok: false, error: 'Invalid order id' };
        const { db } = await connectToDatabase();
        const row = await db.collection(COLL.orders).findOne({ _id: oid, userId } as Filter<Document>);
        if (!row) return { ok: false, error: 'Order not found' };
        return { ok: true, item: toJson(row) };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function updateOrder(id: string, patch: Record<string, unknown>): Promise<SabshopActionResult> {
    try {
        const userId = await requireUserId();
        const oid = parseOidOrNull(id);
        if (!oid) return { ok: false, error: 'Invalid order id' };
        const { db } = await connectToDatabase();
        const set: Record<string, unknown> = { updatedAt: new Date() };
        for (const k of ['paymentStatus', 'fulfillmentStatus', 'paymentRef', 'notes', 'shippingAddress', 'billingAddress']) {
            if (k in patch) set[k] = patch[k];
        }
        await db.collection(COLL.orders).updateOne({ _id: oid, userId } as Filter<Document>, { $set: set });
        revalidatePath(`/dashboard/sabshop`);
        return { ok: true };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Shipping zones                                                       */
/* ──────────────────────────────────────────────────────────────────── */

export async function listShippingZones(storefrontId: string): Promise<SabshopActionResult<{ items: unknown[] }>> {
    try {
        const userId = await requireUserId();
        const sf = parseOidOrNull(storefrontId);
        if (!sf) return { ok: false, error: 'Invalid storefrontId' };
        const { db } = await connectToDatabase();
        const rows = await db.collection(COLL.shippingZones)
            .find({ userId, storefrontId: sf } as Filter<Document>).sort({ createdAt: -1 }).toArray();
        return { ok: true, items: toJson(rows) };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function upsertShippingZone(zone: {
    _id?: string;
    storefrontId: string;
    name: string;
    regions: string[];
    rates: Array<{ name: string; kind: 'flat' | 'per_kg' | 'free'; flatPrice?: number; perKg?: number; minTotal?: number }>;
    active?: boolean;
}): Promise<SabshopActionResult<{ id: string }>> {
    try {
        const userId = await requireUserId();
        const sf = parseOidOrNull(zone.storefrontId);
        if (!sf) return { ok: false, error: 'Invalid storefrontId' };
        const { db } = await connectToDatabase();
        if (zone._id) {
            const oid = parseOidOrNull(zone._id);
            if (!oid) return { ok: false, error: 'Invalid zone id' };
            await db.collection(COLL.shippingZones).updateOne(
                { _id: oid, userId } as Filter<Document>,
                {
                    $set: {
                        name: zone.name,
                        regions: zone.regions,
                        rates: zone.rates,
                        active: zone.active ?? true,
                        updatedAt: new Date(),
                    },
                },
            );
            return { ok: true, id: zone._id };
        }
        const r = await db.collection(COLL.shippingZones).insertOne({
            userId,
            storefrontId: sf,
            name: zone.name,
            regions: zone.regions,
            rates: zone.rates,
            active: zone.active ?? true,
            createdAt: new Date(),
        } as Document);
        return { ok: true, id: r.insertedId.toHexString() };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function deleteShippingZone(id: string): Promise<SabshopActionResult> {
    try {
        const userId = await requireUserId();
        const oid = parseOidOrNull(id);
        if (!oid) return { ok: false, error: 'Invalid zone id' };
        const { db } = await connectToDatabase();
        await db.collection(COLL.shippingZones).deleteOne({ _id: oid, userId } as Filter<Document>);
        return { ok: true };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Tax rules                                                            */
/* ──────────────────────────────────────────────────────────────────── */

export async function listTaxRules(storefrontId: string): Promise<SabshopActionResult<{ items: unknown[] }>> {
    try {
        const userId = await requireUserId();
        const sf = parseOidOrNull(storefrontId);
        if (!sf) return { ok: false, error: 'Invalid storefrontId' };
        const { db } = await connectToDatabase();
        const rows = await db.collection(COLL.taxRules)
            .find({ userId, storefrontId: sf } as Filter<Document>).sort({ createdAt: -1 }).toArray();
        return { ok: true, items: toJson(rows) };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function upsertTaxRule(rule: {
    _id?: string;
    storefrontId: string;
    name: string;
    region: string;
    rate: number;
    inclusive?: boolean;
    productCategoryIds?: string[];
    active?: boolean;
}): Promise<SabshopActionResult<{ id: string }>> {
    try {
        if (rule.rate < 0 || rule.rate > 1.5) return { ok: false, error: 'Rate must be between 0 and 1.5' };
        const userId = await requireUserId();
        const sf = parseOidOrNull(rule.storefrontId);
        if (!sf) return { ok: false, error: 'Invalid storefrontId' };
        const { db } = await connectToDatabase();
        const productCategoryIds = (rule.productCategoryIds ?? [])
            .filter((v) => ObjectId.isValid(v)).map((v) => new ObjectId(v));
        const set = {
            name: rule.name,
            region: rule.region.toUpperCase(),
            rate: rule.rate,
            inclusive: !!rule.inclusive,
            productCategoryIds,
            active: rule.active ?? true,
            updatedAt: new Date(),
        };
        if (rule._id) {
            const oid = parseOidOrNull(rule._id);
            if (!oid) return { ok: false, error: 'Invalid rule id' };
            await db.collection(COLL.taxRules).updateOne(
                { _id: oid, userId } as Filter<Document>,
                { $set: set },
            );
            return { ok: true, id: rule._id };
        }
        const r = await db.collection(COLL.taxRules).insertOne({
            userId, storefrontId: sf, ...set, createdAt: new Date(),
        } as Document);
        return { ok: true, id: r.insertedId.toHexString() };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function deleteTaxRule(id: string): Promise<SabshopActionResult> {
    try {
        const userId = await requireUserId();
        const oid = parseOidOrNull(id);
        if (!oid) return { ok: false, error: 'Invalid rule id' };
        const { db } = await connectToDatabase();
        await db.collection(COLL.taxRules).deleteOne({ _id: oid, userId } as Filter<Document>);
        return { ok: true };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}
