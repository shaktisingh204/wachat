/**
 * Order lifecycle.
 *
 * createOrder converts a checked-out cart into an immutable Order document.
 * cancelOrder + refundOrder produce side-effects (refund records, shipment cancel,
 * inventory release) but never mutate Order.items in place — they append to
 * `refunds[]` and adjust `status`.
 */

import 'server-only';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import type {
    Address,
    Cart,
    Order,
    OrderItem,
    Payment,
    Refund,
} from './types';

const COLLECTION = 'commerce_orders';

function nowIso(): string {
    return new Date().toISOString();
}

function generateOrderNumber(): string {
    const yr = new Date().getUTCFullYear();
    const rand = Math.floor(Math.random() * 1_000_000)
        .toString()
        .padStart(6, '0');
    return `ORD-${yr}-${rand}`;
}

export interface CustomerInput {
    customerId?: string;
    email: string;
    shippingAddress?: Address;
    billingAddress?: Address;
}

export async function createOrder(
    cart: Cart,
    customer: CustomerInput,
    payment?: Payment,
): Promise<Order> {
    if (cart.items.length === 0) throw new Error('Cart is empty');
    if (!customer.email) throw new Error('Customer email required');

    const items: OrderItem[] = cart.items.map((line) => ({
        ...line,
        fulfilledQuantity: 0,
        refundedQuantity: 0,
    }));

    const order: Order = {
        tenantId: cart.tenantId,
        number: generateOrderNumber(),
        customerId: customer.customerId,
        email: customer.email,
        currency: cart.currency,
        items,
        subtotalCents: cart.subtotalCents,
        discountCents: cart.discountCents,
        taxCents: cart.taxCents,
        shippingCents: cart.shippingCents,
        totalCents: cart.totalCents,
        couponCode: cart.couponCode,
        shippingAddress: customer.shippingAddress ?? cart.shippingAddress,
        billingAddress: customer.billingAddress ?? cart.billingAddress,
        status: payment?.status === 'captured' ? 'paid' : 'pending',
        payment,
        refunds: [],
        shipments: [],
        placedAt: nowIso(),
        updatedAt: nowIso(),
    };

    const { db } = await connectToDatabase();
    const res = await db.collection(COLLECTION).insertOne(order as unknown as Record<string, unknown>);
    order._id = res.insertedId.toString();

    // Burn the cart so it cannot be ordered twice.
    if (cart._id && ObjectId.isValid(cart._id)) {
        await db.collection('commerce_carts').deleteOne({ _id: new ObjectId(cart._id) });
    }
    return order;
}

export async function getOrder(tenantId: string, id: string): Promise<Order | null> {
    if (!ObjectId.isValid(id)) return null;
    const { db } = await connectToDatabase();
    const doc = await db.collection(COLLECTION).findOne({ _id: new ObjectId(id), tenantId });
    if (!doc) return null;
    const { _id, ...rest } = doc as unknown as Order & { _id: ObjectId };
    return { ...(rest as Order), _id: _id.toString() };
}

export async function getOrderByNumber(
    tenantId: string,
    number: string,
): Promise<Order | null> {
    const { db } = await connectToDatabase();
    const doc = await db.collection(COLLECTION).findOne({ tenantId, number });
    if (!doc) return null;
    const { _id, ...rest } = doc as unknown as Order & { _id: ObjectId };
    return { ...(rest as Order), _id: _id.toString() };
}

export async function listOrders(
    tenantId: string,
    opts: { customerId?: string; status?: Order['status']; limit?: number } = {},
): Promise<Order[]> {
    const { db } = await connectToDatabase();
    const filter: Record<string, unknown> = { tenantId };
    if (opts.customerId) filter.customerId = opts.customerId;
    if (opts.status) filter.status = opts.status;
    const docs = await db
        .collection(COLLECTION)
        .find(filter)
        .sort({ placedAt: -1 })
        .limit(Math.min(Math.max(opts.limit ?? 50, 1), 200))
        .toArray();
    return docs.map((d) => {
        const { _id, ...rest } = d as unknown as Order & { _id: ObjectId };
        return { ...(rest as Order), _id: _id.toString() };
    });
}

export async function cancelOrder(
    tenantId: string,
    orderId: string,
    reason?: string,
): Promise<Order | null> {
    if (!ObjectId.isValid(orderId)) return null;
    const { db } = await connectToDatabase();
    const res = await db.collection(COLLECTION).findOneAndUpdate(
        {
            _id: new ObjectId(orderId),
            tenantId,
            status: { $in: ['pending', 'paid', 'fulfilling'] },
        },
        {
            $set: {
                status: 'cancelled',
                cancelledAt: nowIso(),
                updatedAt: nowIso(),
                notes: reason,
            },
        },
        { returnDocument: 'after' },
    );
    if (!res) return null;
    const { _id, ...rest } = res as unknown as Order & { _id: ObjectId };
    return { ...(rest as Order), _id: _id.toString() };
}

export interface RefundOrderInput {
    paymentId: string;
    amountCents: number;
    reason?: string;
    providerRefundId?: string;
}

export async function refundOrder(
    tenantId: string,
    orderId: string,
    input: RefundOrderInput,
): Promise<Order | null> {
    if (!ObjectId.isValid(orderId)) return null;
    const { db } = await connectToDatabase();
    const order = await getOrder(tenantId, orderId);
    if (!order) return null;
    if (input.amountCents <= 0) throw new Error('refund amount must be > 0');
    const previouslyRefunded = order.refunds.reduce((sum, r) => sum + r.amountCents, 0);
    if (previouslyRefunded + input.amountCents > order.totalCents) {
        throw new Error('Refund exceeds order total');
    }

    const refund: Refund = {
        tenantId,
        orderId,
        paymentId: input.paymentId,
        amountCents: input.amountCents,
        currency: order.currency,
        reason: input.reason,
        status: input.providerRefundId ? 'succeeded' : 'pending',
        providerRefundId: input.providerRefundId,
        createdAt: nowIso(),
        settledAt: input.providerRefundId ? nowIso() : undefined,
    };

    const newTotal = previouslyRefunded + input.amountCents;
    const status: Order['status'] =
        newTotal >= order.totalCents ? 'refunded' : 'partially_refunded';

    const res = await db.collection(COLLECTION).findOneAndUpdate(
        { _id: new ObjectId(orderId), tenantId },
        {
            $push: { refunds: refund } as never,
            $set: { status, updatedAt: nowIso() },
        },
        { returnDocument: 'after' },
    );
    if (!res) return null;
    const { _id, ...rest } = res as unknown as Order & { _id: ObjectId };
    return { ...(rest as Order), _id: _id.toString() };
}

export async function markFulfilled(
    tenantId: string,
    orderId: string,
): Promise<Order | null> {
    if (!ObjectId.isValid(orderId)) return null;
    const { db } = await connectToDatabase();
    const res = await db.collection(COLLECTION).findOneAndUpdate(
        { _id: new ObjectId(orderId), tenantId },
        { $set: { status: 'fulfilled', updatedAt: nowIso() } },
        { returnDocument: 'after' },
    );
    if (!res) return null;
    const { _id, ...rest } = res as unknown as Order & { _id: ObjectId };
    return { ...(rest as Order), _id: _id.toString() };
}
