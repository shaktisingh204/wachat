'use server';

/**
 * Public storefront actions — power the `/store/[tenantSlug]` engine.
 *
 * These actions are tenant-scoped to a storefront by SLUG, not by the
 * caller's user. They are intentionally permissive (no login required)
 * so anonymous shoppers can browse, add to cart, and check out — but
 * every write still resolves the storefront's owning `userId` and
 * tags created carts/orders/checkouts with it for isolation.
 */

import { ObjectId, type Document, type Filter } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import { getErrorMessage } from '@/lib/utils';
import { getPaymentGateway } from '@/lib/sabshop/payment-gateway';

type ActionOk<T> = { ok: true } & T;
type ActionErr = { ok: false; error: string };
type StorefrontResult<T = Record<string, unknown>> = ActionOk<T> | ActionErr;

const COLL = {
    storefronts: 'sabshop_storefronts',
    themes: 'sabshop_themes',
    collections: 'sabshop_collections',
    carts: 'sabshop_carts',
    orders: 'sabshop_orders',
    shippingZones: 'sabshop_shipping_zones',
    taxRules: 'sabshop_tax_rules',
    checkouts: 'sabshop_checkouts',
    products: 'crm_products',
};

function toJson<T>(v: unknown): T {
    return JSON.parse(JSON.stringify(v)) as T;
}

function oidOrNull(id: string | undefined | null): ObjectId | null {
    if (!id || typeof id !== 'string' || !ObjectId.isValid(id)) return null;
    return new ObjectId(id);
}

interface StorefrontShape {
    _id: ObjectId;
    userId: ObjectId;
    slug: string;
    displayName: string;
    description?: string;
    themeId?: ObjectId;
    currency?: string;
    status?: string;
    customCss?: string;
    logoUrl?: string;
    heroImageUrl?: string;
    heroTitle?: string;
    heroSubtitle?: string;
    featuredProductIds?: ObjectId[];
    featuredCollectionIds?: ObjectId[];
    publishedProductIds?: ObjectId[];
}

async function findStorefrontBySlug(slug: string): Promise<StorefrontShape | null> {
    const { db } = await connectToDatabase();
    return (await db
        .collection(COLL.storefronts)
        .findOne({ slug: slug.toLowerCase() } as Filter<Document>)) as StorefrontShape | null;
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Home, product list, PDP                                              */
/* ──────────────────────────────────────────────────────────────────── */

export async function getStorefrontHome(tenantSlug: string): Promise<StorefrontResult<{
    storefront: unknown;
    theme?: unknown;
    featuredProducts: unknown[];
    featuredCollections: unknown[];
}>> {
    try {
        const sf = await findStorefrontBySlug(tenantSlug);
        if (!sf) return { ok: false, error: 'Storefront not found' };
        if (sf.status === 'paused') return { ok: false, error: 'Storefront is paused' };
        const { db } = await connectToDatabase();
        const [theme, featuredProducts, featuredCollections] = await Promise.all([
            sf.themeId ? db.collection(COLL.themes).findOne({ _id: sf.themeId } as Filter<Document>) : Promise.resolve(null),
            sf.featuredProductIds && sf.featuredProductIds.length
                ? db.collection(COLL.products).find({ _id: { $in: sf.featuredProductIds } } as Filter<Document>).toArray()
                : Promise.resolve([]),
            sf.featuredCollectionIds && sf.featuredCollectionIds.length
                ? db.collection(COLL.collections).find({ _id: { $in: sf.featuredCollectionIds } } as Filter<Document>).toArray()
                : Promise.resolve([]),
        ]);
        return {
            ok: true,
            storefront: toJson(sf),
            theme: theme ? toJson(theme) : undefined,
            featuredProducts: toJson(featuredProducts),
            featuredCollections: toJson(featuredCollections),
        };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function listStorefrontProducts(tenantSlug: string): Promise<StorefrontResult<{ items: unknown[]; storefront: unknown }>> {
    try {
        const sf = await findStorefrontBySlug(tenantSlug);
        if (!sf) return { ok: false, error: 'Storefront not found' };
        const { db } = await connectToDatabase();
        const ids = sf.publishedProductIds ?? [];
        const items = ids.length
            ? await db.collection(COLL.products).find({ _id: { $in: ids } } as Filter<Document>).toArray()
            : [];
        return { ok: true, items: toJson(items), storefront: toJson(sf) };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function getStorefrontProduct(tenantSlug: string, productSlugOrId: string): Promise<StorefrontResult<{ product: unknown; storefront: unknown }>> {
    try {
        const sf = await findStorefrontBySlug(tenantSlug);
        if (!sf) return { ok: false, error: 'Storefront not found' };
        const { db } = await connectToDatabase();
        const filter: Filter<Document> = ObjectId.isValid(productSlugOrId)
            ? { _id: new ObjectId(productSlugOrId) }
            : { slug: productSlugOrId };
        const product = await db.collection(COLL.products).findOne(filter);
        if (!product) return { ok: false, error: 'Product not found' };
        return { ok: true, product: toJson(product), storefront: toJson(sf) };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Cart                                                                 */
/* ──────────────────────────────────────────────────────────────────── */

interface CartLineInput {
    productId: string;
    variantId?: string;
    name: string;
    imageUrl?: string;
    unitPrice: number;
    quantity: number;
}

function computeLineTotals(items: CartLineInput[]) {
    return items.map((i) => ({
        ...i,
        productId: i.productId,
        lineTotal: Math.round(i.unitPrice * i.quantity * 100) / 100,
    }));
}

function computeTotals(items: Array<{ lineTotal: number }>) {
    const subtotal = items.reduce((a, b) => a + b.lineTotal, 0);
    return { subtotal, tax: 0, shipping: 0, discount: 0, total: subtotal };
}

export async function getOrCreateCart(input: {
    tenantSlug: string;
    cartId?: string;
    guestSessionId?: string;
    customerId?: string;
}): Promise<StorefrontResult<{ cart: unknown }>> {
    try {
        const sf = await findStorefrontBySlug(input.tenantSlug);
        if (!sf) return { ok: false, error: 'Storefront not found' };
        const { db } = await connectToDatabase();
        if (input.cartId) {
            const oid = oidOrNull(input.cartId);
            if (oid) {
                const c = await db.collection(COLL.carts).findOne({ _id: oid, storefrontId: sf._id } as Filter<Document>);
                if (c) return { ok: true, cart: toJson(c) };
            }
        }
        if (!input.guestSessionId && !input.customerId) {
            return { ok: false, error: 'guestSessionId or customerId is required' };
        }
        const doc = {
            userId: sf.userId,
            storefrontId: sf._id,
            customerId: oidOrNull(input.customerId ?? '') ?? undefined,
            guestSessionId: input.guestSessionId,
            lineItems: [],
            totals: { subtotal: 0, tax: 0, shipping: 0, discount: 0, total: 0 },
            currency: sf.currency ?? 'INR',
            expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            createdAt: new Date(),
        };
        const r = await db.collection(COLL.carts).insertOne(doc as Document);
        const cart = await db.collection(COLL.carts).findOne({ _id: r.insertedId });
        return { ok: true, cart: toJson(cart) };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function updateCartItems(
    cartId: string,
    items: CartLineInput[],
): Promise<StorefrontResult<{ cart: unknown }>> {
    try {
        const oid = oidOrNull(cartId);
        if (!oid) return { ok: false, error: 'Invalid cart id' };
        const { db } = await connectToDatabase();
        const lineItems = computeLineTotals(items).map((i) => ({
            ...i,
            productId: ObjectId.isValid(i.productId) ? new ObjectId(i.productId) : i.productId,
        }));
        const totals = computeTotals(lineItems);
        await db.collection(COLL.carts).updateOne(
            { _id: oid } as Filter<Document>,
            { $set: { lineItems, totals, updatedAt: new Date() } },
        );
        const cart = await db.collection(COLL.carts).findOne({ _id: oid });
        return { ok: true, cart: toJson(cart) };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Checkout                                                             */
/* ──────────────────────────────────────────────────────────────────── */

export async function startCheckout(input: {
    tenantSlug: string;
    cartId: string;
}): Promise<StorefrontResult<{ checkoutId: string }>> {
    try {
        const sf = await findStorefrontBySlug(input.tenantSlug);
        if (!sf) return { ok: false, error: 'Storefront not found' };
        const cartOid = oidOrNull(input.cartId);
        if (!cartOid) return { ok: false, error: 'Invalid cart id' };
        const { db } = await connectToDatabase();
        const r = await db.collection(COLL.checkouts).insertOne({
            userId: sf.userId,
            storefrontId: sf._id,
            cartId: cartOid,
            step: 'address',
            payload: {},
            createdAt: new Date(),
        } as Document);
        return { ok: true, checkoutId: r.insertedId.toHexString() };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function updateCheckout(
    checkoutId: string,
    step: 'address' | 'shipping' | 'payment' | 'review',
    payloadPatch: Record<string, unknown>,
): Promise<StorefrontResult<{ checkout: unknown }>> {
    try {
        const oid = oidOrNull(checkoutId);
        if (!oid) return { ok: false, error: 'Invalid checkout id' };
        const { db } = await connectToDatabase();
        const current = await db.collection(COLL.checkouts).findOne({ _id: oid });
        if (!current) return { ok: false, error: 'Checkout not found' };
        const payload = { ...(current.payload ?? {}), ...payloadPatch };
        await db.collection(COLL.checkouts).updateOne(
            { _id: oid } as Filter<Document>,
            { $set: { step, payload, updatedAt: new Date() } },
        );
        const checkout = await db.collection(COLL.checkouts).findOne({ _id: oid });
        return { ok: true, checkout: toJson(checkout) };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function placeOrder(input: {
    tenantSlug: string;
    checkoutId: string;
}): Promise<StorefrontResult<{ orderId: string; orderCode: string }>> {
    try {
        const sf = await findStorefrontBySlug(input.tenantSlug);
        if (!sf) return { ok: false, error: 'Storefront not found' };
        const oid = oidOrNull(input.checkoutId);
        if (!oid) return { ok: false, error: 'Invalid checkout id' };
        const { db } = await connectToDatabase();
        const checkout = await db.collection(COLL.checkouts).findOne({ _id: oid });
        if (!checkout) return { ok: false, error: 'Checkout not found' };
        const cart = await db.collection(COLL.carts).findOne({ _id: checkout.cartId });
        if (!cart) return { ok: false, error: 'Cart not found' };

        const payload = (checkout.payload ?? {}) as Record<string, unknown>;
        const shippingAddress = (payload.shippingAddress ?? {}) as Record<string, unknown>;
        const billingAddress = (payload.billingAddress ?? shippingAddress) as Record<string, unknown>;

        const orderCode = `CO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 100000)}`;
        const orderDoc = {
            userId: sf.userId,
            storefrontId: sf._id,
            orderCode,
            customerId: cart.customerId,
            lineItems: cart.lineItems ?? [],
            totals: cart.totals ?? { subtotal: 0, tax: 0, shipping: 0, discount: 0, total: 0 },
            paymentStatus: 'unpaid',
            fulfillmentStatus: 'unfulfilled',
            shippingAddress,
            billingAddress,
            currency: cart.currency ?? sf.currency ?? 'INR',
            paymentProvider: 'mock',
            createdAt: new Date(),
        };
        const r = await db.collection(COLL.orders).insertOne(orderDoc as Document);

        // Mark checkout complete + link order.
        await db.collection(COLL.checkouts).updateOne(
            { _id: oid } as Filter<Document>,
            { $set: { step: 'completed', orderId: r.insertedId, updatedAt: new Date() } },
        );

        // Kick the payment gateway (mock auto-succeeds in dev).
        const gateway = getPaymentGateway();
        const intent = await gateway.createIntent({
            orderId: r.insertedId.toHexString(),
            amount: (cart.totals?.total ?? 0) as number,
            currency: (cart.currency ?? sf.currency ?? 'INR') as string,
        });
        const confirm = await gateway.confirm({ intentId: intent.id });
        if (confirm.ok && confirm.status === 'succeeded') {
            await db.collection(COLL.orders).updateOne(
                { _id: r.insertedId } as Filter<Document>,
                { $set: { paymentStatus: 'paid', paymentRef: confirm.paymentRef, updatedAt: new Date() } },
            );
        }

        revalidatePath(`/store/${input.tenantSlug}`);
        return { ok: true, orderId: r.insertedId.toHexString(), orderCode };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function getOrderByCode(tenantSlug: string, orderCode: string): Promise<StorefrontResult<{ order: unknown }>> {
    try {
        const sf = await findStorefrontBySlug(tenantSlug);
        if (!sf) return { ok: false, error: 'Storefront not found' };
        const { db } = await connectToDatabase();
        const row = await db.collection(COLL.orders).findOne({ storefrontId: sf._id, orderCode } as Filter<Document>);
        if (!row) return { ok: false, error: 'Order not found' };
        return { ok: true, order: toJson(row) };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}
