/**
 * Cart operations.
 *
 * Carts are persisted in `commerce_carts`. Totals are recomputed deterministically
 * from line items + coupon + shipping + tax classes.
 */

import 'server-only';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import type { Cart, CartTotals, CommerceCurrency, Coupon, LineItem, Tax } from './types';

const COLLECTION = 'commerce_carts';

function nowIso(): string {
    return new Date().toISOString();
}

async function loadCart(tenantId: string, cartId: string): Promise<Cart | null> {
    if (!ObjectId.isValid(cartId)) return null;
    const { db } = await connectToDatabase();
    const doc = await db.collection(COLLECTION).findOne({ _id: new ObjectId(cartId), tenantId });
    if (!doc) return null;
    const { _id, ...rest } = doc as unknown as Cart & { _id: ObjectId };
    return { ...(rest as Cart), _id: _id.toString() };
}

async function saveCart(cart: Cart): Promise<Cart> {
    const { db } = await connectToDatabase();
    cart.updatedAt = nowIso();
    if (cart._id) {
        const _id = new ObjectId(cart._id);
        const { _id: _ignore, ...rest } = cart;
        void _ignore;
        await db.collection(COLLECTION).updateOne({ _id }, { $set: rest });
        return cart;
    }
    cart.createdAt = nowIso();
    const res = await db.collection(COLLECTION).insertOne(cart as unknown as Record<string, unknown>);
    cart._id = res.insertedId.toString();
    return cart;
}

export interface CreateCartInput {
    tenantId: string;
    customerId?: string;
    sessionId?: string;
    currency: CommerceCurrency;
}

export async function createCart(input: CreateCartInput): Promise<Cart> {
    const cart: Cart = {
        tenantId: input.tenantId,
        customerId: input.customerId,
        sessionId: input.sessionId,
        currency: input.currency,
        items: [],
        discountCents: 0,
        subtotalCents: 0,
        taxCents: 0,
        shippingCents: 0,
        totalCents: 0,
        createdAt: nowIso(),
        updatedAt: nowIso(),
    };
    return saveCart(cart);
}

export interface AddToCartInput {
    productId: string;
    variantId?: string;
    sku: string;
    title: string;
    unitPriceCents: number;
    quantity: number;
    imageUrl?: string;
    taxClassId?: string;
}

export async function addToCart(
    tenantId: string,
    cartId: string,
    item: AddToCartInput,
): Promise<Cart | null> {
    if (item.quantity <= 0) throw new Error('quantity must be > 0');
    const cart = await loadCart(tenantId, cartId);
    if (!cart) return null;

    const existing = cart.items.find(
        (i) => i.productId === item.productId && i.variantId === item.variantId,
    );
    if (existing) {
        existing.quantity += item.quantity;
    } else {
        const line: LineItem = {
            productId: item.productId,
            variantId: item.variantId,
            sku: item.sku,
            title: item.title,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            discountCents: 0,
            taxCents: 0,
            totalCents: item.unitPriceCents * item.quantity,
            imageUrl: item.imageUrl,
            taxClassId: item.taxClassId,
        };
        cart.items.push(line);
    }
    return saveCart(await recomputeTotals(cart));
}

export async function removeFromCart(
    tenantId: string,
    cartId: string,
    productId: string,
    variantId?: string,
): Promise<Cart | null> {
    const cart = await loadCart(tenantId, cartId);
    if (!cart) return null;
    cart.items = cart.items.filter(
        (i) => !(i.productId === productId && i.variantId === variantId),
    );
    return saveCart(await recomputeTotals(cart));
}

export async function updateQuantity(
    tenantId: string,
    cartId: string,
    productId: string,
    variantId: string | undefined,
    quantity: number,
): Promise<Cart | null> {
    const cart = await loadCart(tenantId, cartId);
    if (!cart) return null;
    const line = cart.items.find(
        (i) => i.productId === productId && i.variantId === variantId,
    );
    if (!line) return cart;
    if (quantity <= 0) {
        cart.items = cart.items.filter((i) => i !== line);
    } else {
        line.quantity = quantity;
    }
    return saveCart(await recomputeTotals(cart));
}

export async function applyCoupon(
    tenantId: string,
    cartId: string,
    code: string,
): Promise<Cart | null> {
    const cart = await loadCart(tenantId, cartId);
    if (!cart) return null;
    const coupon = await loadCoupon(tenantId, code);
    if (!coupon || !coupon.active) {
        throw new Error('Coupon not active');
    }
    cart.couponCode = coupon.code;
    return saveCart(await recomputeTotals(cart));
}

export async function removeCoupon(
    tenantId: string,
    cartId: string,
): Promise<Cart | null> {
    const cart = await loadCart(tenantId, cartId);
    if (!cart) return null;
    cart.couponCode = undefined;
    return saveCart(await recomputeTotals(cart));
}

export async function setShippingRate(
    tenantId: string,
    cartId: string,
    rateId: string,
    costCents: number,
): Promise<Cart | null> {
    const cart = await loadCart(tenantId, cartId);
    if (!cart) return null;
    cart.shippingRateId = rateId;
    cart.shippingCents = costCents;
    return saveCart(await recomputeTotals(cart));
}

async function loadCoupon(tenantId: string, code: string): Promise<Coupon | null> {
    const { db } = await connectToDatabase();
    const doc = await db.collection('commerce_coupons').findOne({ tenantId, code });
    return (doc as unknown as Coupon) ?? null;
}

async function loadTaxClass(tenantId: string, classId: string): Promise<Tax | null> {
    const { db } = await connectToDatabase();
    const doc = await db.collection('commerce_tax_classes').findOne({ tenantId, classId });
    return (doc as unknown as Tax) ?? null;
}

export function computeCouponDiscount(coupon: Coupon, subtotalCents: number): number {
    if (coupon.minSubtotalCents && subtotalCents < coupon.minSubtotalCents) return 0;
    switch (coupon.discountType) {
        case 'percent':
            return Math.floor((subtotalCents * Math.min(coupon.value, 100)) / 100);
        case 'fixed':
            return Math.min(coupon.value, subtotalCents);
        case 'free_shipping':
            return 0; // applied to shipping field separately
        case 'bxgy': {
            // Naive BXGY: discount applied as percent off cheapest "get" units.
            const cfg = coupon.bxgy;
            if (!cfg) return 0;
            return Math.floor(
                (subtotalCents * Math.min(cfg.getDiscountPercent, 100)) / 100 / 4,
            );
        }
        default:
            return 0;
    }
}

async function recomputeTotals(cart: Cart): Promise<Cart> {
    let subtotal = 0;
    for (const line of cart.items) {
        line.discountCents = 0;
        line.taxCents = 0;
        line.totalCents = line.unitPriceCents * line.quantity;
        subtotal += line.totalCents;
    }

    let discount = 0;
    if (cart.couponCode) {
        const coupon = await loadCoupon(cart.tenantId, cart.couponCode);
        if (coupon && coupon.active) {
            discount = computeCouponDiscount(coupon, subtotal);
            if (coupon.discountType === 'free_shipping') {
                cart.shippingCents = 0;
            }
        } else {
            cart.couponCode = undefined;
        }
    }
    if (discount > subtotal) discount = subtotal;

    // Tax — per-line via tax class lookup.
    let taxTotal = 0;
    const taxableBase = Math.max(subtotal - discount, 0);
    for (const line of cart.items) {
        if (!line.taxClassId) continue;
        const cls = await loadTaxClass(cart.tenantId, line.taxClassId);
        if (!cls) continue;
        const lineShare = subtotal === 0 ? 0 : line.totalCents / subtotal;
        const taxableLine = Math.floor(taxableBase * lineShare);
        const tax = cls.inclusive
            ? Math.floor(taxableLine - taxableLine / (1 + cls.rate))
            : Math.floor(taxableLine * cls.rate);
        line.taxCents = tax;
        taxTotal += tax;
    }

    const shipping = cart.shippingCents ?? 0;
    cart.subtotalCents = subtotal;
    cart.discountCents = discount;
    cart.taxCents = taxTotal;
    cart.shippingCents = shipping;
    cart.totalCents = Math.max(subtotal - discount + taxTotal + shipping, 0);
    return cart;
}

export async function getCart(tenantId: string, cartId: string): Promise<Cart | null> {
    return loadCart(tenantId, cartId);
}

export async function getCartTotals(
    tenantId: string,
    cartId: string,
): Promise<CartTotals | null> {
    const cart = await loadCart(tenantId, cartId);
    if (!cart) return null;
    const recomputed = await recomputeTotals(cart);
    return {
        subtotalCents: recomputed.subtotalCents,
        discountCents: recomputed.discountCents,
        taxCents: recomputed.taxCents,
        shippingCents: recomputed.shippingCents,
        totalCents: recomputed.totalCents,
        lines: recomputed.items,
    };
}

export async function clearCart(tenantId: string, cartId: string): Promise<boolean> {
    if (!ObjectId.isValid(cartId)) return false;
    const { db } = await connectToDatabase();
    const res = await db.collection(COLLECTION).deleteOne({
        _id: new ObjectId(cartId),
        tenantId,
    });
    return res.deletedCount === 1;
}
