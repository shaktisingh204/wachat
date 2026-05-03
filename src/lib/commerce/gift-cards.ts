/**
 * Gift cards: issue / redeem / balance.
 *
 * Codes are 16-char base32 (Crockford alphabet, sans I/L/O/U). Redemption is
 * race-safe via a conditional `findOneAndUpdate` with `balanceCents >= amount`.
 */

import 'server-only';
import crypto from 'crypto';
import { connectToDatabase } from '@/lib/mongodb';
import type { CommerceCurrency, GiftCard } from './types';

const COLLECTION = 'commerce_gift_cards';
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function nowIso(): string {
    return new Date().toISOString();
}

export function generateGiftCardCode(): string {
    const bytes = crypto.randomBytes(16);
    let out = '';
    for (let i = 0; i < 16; i++) {
        out += ALPHABET[bytes[i] % ALPHABET.length];
    }
    return `GC-${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}-${out.slice(12, 16)}`;
}

export interface IssueGiftCardInput {
    tenantId: string;
    initialBalanceCents: number;
    currency: CommerceCurrency;
    issuedTo?: string;
    issuedBy?: string;
    expiresAt?: string;
    /** Pre-supplied code (else auto-generated). */
    code?: string;
}

export async function issue(input: IssueGiftCardInput): Promise<GiftCard> {
    if (input.initialBalanceCents <= 0) throw new Error('initial balance must be > 0');
    const { db } = await connectToDatabase();
    const code = input.code ?? generateGiftCardCode();
    // Enforce code uniqueness per tenant.
    const dup = await db.collection(COLLECTION).findOne({ tenantId: input.tenantId, code });
    if (dup) throw new Error('Gift card code already exists');
    const card: GiftCard = {
        tenantId: input.tenantId,
        code,
        initialBalanceCents: input.initialBalanceCents,
        balanceCents: input.initialBalanceCents,
        currency: input.currency,
        issuedTo: input.issuedTo,
        issuedBy: input.issuedBy,
        expiresAt: input.expiresAt,
        redemptions: [],
        status: 'active',
        createdAt: nowIso(),
    };
    const res = await db.collection(COLLECTION).insertOne(card as unknown as Record<string, unknown>);
    card._id = res.insertedId.toString();
    return card;
}

export async function getByCode(tenantId: string, code: string): Promise<GiftCard | null> {
    const { db } = await connectToDatabase();
    const doc = await db.collection(COLLECTION).findOne({ tenantId, code });
    return (doc as unknown as GiftCard) ?? null;
}

export async function getBalance(tenantId: string, code: string): Promise<number> {
    const card = await getByCode(tenantId, code);
    if (!card) return 0;
    if (card.status !== 'active') return 0;
    if (card.expiresAt && card.expiresAt <= nowIso()) return 0;
    return card.balanceCents;
}

export interface RedeemInput {
    tenantId: string;
    code: string;
    orderId: string;
    amountCents: number;
}

export async function redeem(input: RedeemInput): Promise<GiftCard | null> {
    if (input.amountCents <= 0) throw new Error('amount must be > 0');
    const { db } = await connectToDatabase();
    const redemption = {
        orderId: input.orderId,
        amountCents: input.amountCents,
        redeemedAt: nowIso(),
    };
    // Atomic decrement guarded by sufficient balance + active status.
    const res = await db.collection(COLLECTION).findOneAndUpdate(
        {
            tenantId: input.tenantId,
            code: input.code,
            status: 'active',
            balanceCents: { $gte: input.amountCents },
            $or: [
                { expiresAt: { $exists: false } },
                { expiresAt: { $gt: nowIso() } },
            ],
        },
        {
            $inc: { balanceCents: -input.amountCents },
            $push: { redemptions: redemption } as never,
        },
        { returnDocument: 'after' },
    );
    if (!res) return null;
    const card = res as unknown as GiftCard;
    if (card.balanceCents === 0) {
        await db.collection(COLLECTION).updateOne(
            { tenantId: card.tenantId, code: card.code },
            { $set: { status: 'redeemed' } },
        );
        card.status = 'redeemed';
    }
    return card;
}

export async function cancel(tenantId: string, code: string): Promise<boolean> {
    const { db } = await connectToDatabase();
    const res = await db.collection(COLLECTION).updateOne(
        { tenantId, code, status: 'active' },
        { $set: { status: 'cancelled', balanceCents: 0 } },
    );
    return res.modifiedCount === 1;
}

export async function expireDue(tenantId: string, asOf: string = nowIso()): Promise<number> {
    const { db } = await connectToDatabase();
    const res = await db.collection(COLLECTION).updateMany(
        { tenantId, status: 'active', expiresAt: { $lte: asOf } },
        { $set: { status: 'expired', balanceCents: 0 } },
    );
    return res.modifiedCount;
}
