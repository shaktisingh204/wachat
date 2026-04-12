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
        const txnid = generatePayuTxnId('pln');
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

        // udf1..udf3 carry context we need in the callback (userId,
        // planId, source) — hashed both ways so PayU can't strip them.
        const udf1 = session.user._id.toString();
        const udf2 = planId;
        const udf3 = 'onboarding';

        // Phone lives on `onboarding.profile.phone` after step 2; fall
        // back to any top-level user.phone field for legacy users.
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

        // Persist a pending transaction keyed by txnid. The callback
        // looks it up to finalize — the session cookie may or may not
        // come along, so we identify by txnid + userId.
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

        // Also stash the pending txnid on the user's onboarding state
        // so a page refresh in the middle of the flow can show a
        // "we're still waiting on your PayU payment" banner.
        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            {
                $set: {
                    'onboarding.checkoutTransactionId': txnid,
                    'onboarding.selectedPlanId': planId,
                },
            }
        );

        return {
            success: true,
            payload: {
                action: payu.action,
                params: { ...fields, hash },
            },
        };
    } catch (e) {
        console.error('[PAYU] createPayuPlanCheckout failed', e);
        return { success: false, error: getErrorMessage(e) };
    }
}
