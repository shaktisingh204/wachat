'use server';

import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { getErrorMessage } from '@/lib/utils';
import type { Plan, Transaction } from '@/lib/definitions';
import {
    buildPayuRequestHash,
    formatPayuAmount,
    generatePayuTxnId,
    getPayuConfig,
    type PayuRequestFields,
} from '@/lib/payu';

export interface PayuCheckoutPayload {
    action: string;
    params: PayuRequestFields & { hash: string };
}

export interface PayuCheckoutResult {
    success: boolean;
    error?: string;
    payload?: PayuCheckoutPayload;
}

/**
 * Shared helper that builds PayU form payload for any plan purchase.
 * Both onboarding and billing flows call this.
 */
async function buildPlanCheckout(
    planId: string,
    source: 'onboarding' | 'billing',
): Promise<PayuCheckoutResult> {
    const session = await getSession();
    if (!session?.user) {
        return { success: false, error: 'Authentication required.' };
    }

    if (!ObjectId.isValid(planId)) {
        return { success: false, error: 'Invalid plan.' };
    }

    const payu = getPayuConfig();
    if (!payu) {
        return {
            success: false,
            error: 'Payments are not configured. Please set PAYU_MERCHANT_KEY and PAYU_MERCHANT_SALT.',
        };
    }

    const { db } = await connectToDatabase();
    const plan = (await db
        .collection<Plan>('plans')
        .findOne({ _id: new ObjectId(planId) })) as WithId<Plan> | null;
    if (!plan) return { success: false, error: 'Plan not found.' };

    if (!plan.price || plan.price <= 0) {
        return {
            success: false,
            error: 'Selected plan is free — no payment required.',
        };
    }

    const amount = formatPayuAmount(plan.price);
    const txnid = generatePayuTxnId(source === 'onboarding' ? 'pln' : 'upg');
    const productinfo = `${plan.name} subscription`;
    const firstname = (session.user.name || 'Customer')
        .split(' ')[0]
        .slice(0, 50) || 'Customer';
    const email = session.user.email;

    const appUrl =
        process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
        'http://localhost:3002';
    const surl = `${appUrl}/api/payments/payu/callback`;
    const furl = `${appUrl}/api/payments/payu/callback`;

    const udf1 = session.user._id.toString();
    const udf2 = planId;
    const udf3 = source;

    const phone =
        (session.user as any)?.onboarding?.profile?.phone ||
        (session.user as any)?.phone ||
        undefined;

    const fields: PayuRequestFields = {
        key: payu.key,
        txnid,
        amount,
        productinfo,
        firstname,
        email,
        phone,
        surl,
        furl,
        udf1,
        udf2,
        udf3,
    };

    const hash = buildPayuRequestHash(fields, payu.salt);

    const transaction: Omit<Transaction, '_id'> = {
        userId: new ObjectId(session.user._id),
        type: 'PLAN',
        description: `${plan.name} (${plan.currency || 'INR'} ${plan.price})`,
        planId: plan._id,
        amount: plan.price,
        status: 'PENDING',
        provider: 'payu',
        providerOrderId: txnid,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    await db.collection('transactions').insertOne(transaction as any);

    if (source === 'onboarding') {
        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            {
                $set: {
                    'onboarding.checkoutTransactionId': txnid,
                    'onboarding.selectedPlanId': planId,
                },
            }
        );
    }

    return {
        success: true,
        payload: {
            action: payu.action,
            params: { ...fields, hash },
        },
    };
}

/**
 * Builds a PayU form-POST payload for an onboarding plan purchase.
 *
 * Called by the onboarding Plan step. The client takes the returned
 * `action` URL + `params` and auto-submits a hidden form so the
 * browser is redirected into PayU's hosted payment page.
 *
 * A pending Transaction row is created up front so the callback route
 * (`/api/payments/payu/callback`) can look it up and finalize the
 * user's plan and onboarding status by `txnid` alone.
 */
export async function createPayuPlanCheckout(
    planId: string
): Promise<PayuCheckoutResult> {
    try {
        return await buildPlanCheckout(planId, 'onboarding');
    } catch (e) {
        console.error('[PAYU] createPayuPlanCheckout failed', e);
        return { success: false, error: getErrorMessage(e) };
    }
}

/**
 * Builds a PayU form-POST payload for a plan upgrade from the billing page.
 *
 * Same flow as onboarding checkout but the callback redirects back to
 * /dashboard/user/billing instead of /onboarding.
 */
export async function createPayuPlanUpgrade(
    planId: string
): Promise<PayuCheckoutResult> {
    try {
        return await buildPlanCheckout(planId, 'billing');
    } catch (e) {
        console.error('[PAYU] createPayuPlanUpgrade failed', e);
        return { success: false, error: getErrorMessage(e) };
    }
}

/**
 * Builds a PayU form-POST payload for a wallet/credits top-up.
 *
 * Accepts an amount in INR. The callback handler checks udf3='wallet'
 * and credits the user's wallet.balance on success.
 */
export async function createPayuWalletTopup(
    amount: number
): Promise<PayuCheckoutResult> {
    try {
        const session = await getSession();
        if (!session?.user) {
            return { success: false, error: 'Authentication required.' };
        }

        if (!amount || amount < 100) {
            return { success: false, error: 'Minimum top-up is ₹100.' };
        }
        if (amount > 100000) {
            return { success: false, error: 'Maximum top-up is ₹1,00,000.' };
        }

        const payu = getPayuConfig();
        if (!payu) {
            return {
                success: false,
                error: 'Payments are not configured.',
            };
        }

        const { db } = await connectToDatabase();

        const formattedAmount = formatPayuAmount(amount);
        const txnid = generatePayuTxnId('wal');
        const productinfo = `Wallet top-up ₹${amount}`;
        const firstname = (session.user.name || 'Customer')
            .split(' ')[0]
            .slice(0, 50) || 'Customer';
        const email = session.user.email;

        const appUrl =
            process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
            'http://localhost:3002';
        const surl = `${appUrl}/api/payments/payu/callback`;
        const furl = `${appUrl}/api/payments/payu/callback`;

        const udf1 = session.user._id.toString();
        const udf2 = String(amount); // amount for callback
        const udf3 = 'wallet';

        const phone =
            (session.user as any)?.onboarding?.profile?.phone ||
            (session.user as any)?.phone ||
            undefined;

        const fields: PayuRequestFields = {
            key: payu.key,
            txnid,
            amount: formattedAmount,
            productinfo,
            firstname,
            email,
            phone,
            surl,
            furl,
            udf1,
            udf2,
            udf3,
        };

        const hash = buildPayuRequestHash(fields, payu.salt);

        const transaction: Omit<Transaction, '_id'> = {
            userId: new ObjectId(session.user._id),
            type: 'CREDITS',
            description: `Wallet top-up ₹${amount}`,
            amount: amount,
            status: 'PENDING',
            provider: 'payu',
            providerOrderId: txnid,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await db.collection('transactions').insertOne(transaction as any);

        return {
            success: true,
            payload: {
                action: payu.action,
                params: { ...fields, hash },
            },
        };
    } catch (e) {
        console.error('[PAYU] createPayuWalletTopup failed', e);
        return { success: false, error: getErrorMessage(e) };
    }
}
