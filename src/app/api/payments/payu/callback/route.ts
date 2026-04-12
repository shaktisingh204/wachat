import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import {
    buildPayuResponseHash,
    getPayuConfig,
    verifyPayuResponseHash,
    type PayuResponseFields,
} from '@/lib/payu';
import type { Transaction } from '@/lib/definitions';

/**
 * PayU success + failure callback.
 *
 * PayU redirects the user's browser here via an HTML form POST after
 * the hosted payment page finishes. We:
 *   1) parse the form body,
 *   2) recompute the SHA-512 response hash with our salt and compare,
 *   3) look the pending Transaction up by `txnid`,
 *   4) on success → mark txn SUCCESS, assign plan, complete onboarding,
 *      on failure → mark txn FAILED,
 *   5) 303-redirect the user back to /onboarding with a status param.
 *
 * We key everything off `txnid` (not the session cookie) because some
 * browsers strip cookies on cross-origin POST redirects.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const APP_URL = (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    'http://localhost:3002'
);

function redirectBack(query: Record<string, string>, source?: string): NextResponse {
    // Route back to the appropriate page based on source
    let target = '/onboarding';
    if (source === 'billing') {
        target = '/dashboard/user/billing';
    } else if (source === 'wallet') {
        target = '/dashboard/user/billing';
    }

    const url = new URL(target, APP_URL);
    for (const [k, v] of Object.entries(query)) {
        url.searchParams.set(k, v);
    }
    // 303 forces the browser to issue a GET for the new URL even
    // though PayU's callback arrived as a POST.
    return NextResponse.redirect(url, { status: 303 });
}

function toResponseFields(form: FormData): PayuResponseFields & { hash: string } {
    const get = (k: string) => (form.get(k) as string | null) ?? '';
    return {
        status: get('status'),
        key: get('key'),
        txnid: get('txnid'),
        amount: get('amount'),
        productinfo: get('productinfo'),
        firstname: get('firstname'),
        email: get('email'),
        udf1: get('udf1'),
        udf2: get('udf2'),
        udf3: get('udf3'),
        udf4: get('udf4'),
        udf5: get('udf5'),
        udf6: get('udf6'),
        udf7: get('udf7'),
        udf8: get('udf8'),
        udf9: get('udf9'),
        udf10: get('udf10'),
        hash: get('hash'),
    };
}

export async function POST(request: NextRequest) {
    const payu = getPayuConfig();
    if (!payu) {
        console.error('[PAYU CALLBACK] PayU env not configured.');
        return redirectBack({
            payment: 'failed',
            reason: 'payu-not-configured',
        });
    }

    let form: FormData;
    try {
        form = await request.formData();
    } catch (e) {
        console.error('[PAYU CALLBACK] Could not parse form body', e);
        return redirectBack({ payment: 'failed', reason: 'bad-request' });
    }

    const fields = toResponseFields(form);
    const { status, txnid, udf1: userIdStr, udf2: udf2Str, udf3: source } = fields;

    if (!txnid) {
        return redirectBack({ payment: 'failed', reason: 'missing-txnid' }, source);
    }

    // 1) Verify reverse hash — reject any tampered response immediately.
    const hashOk = verifyPayuResponseHash(fields, payu.salt);
    if (!hashOk) {
        console.error('[PAYU CALLBACK] Hash mismatch', {
            txnid,
            status,
            expected: buildPayuResponseHash(fields, payu.salt),
            received: fields.hash,
        });
        return redirectBack({
            payment: 'failed',
            reason: 'hash-mismatch',
            txn: txnid,
        }, source);
    }

    try {
        const { db } = await connectToDatabase();

        // 2) Look up the pending transaction we inserted at checkout time.
        const txn = await db
            .collection<Transaction>('transactions')
            .findOne({ providerOrderId: txnid, provider: 'payu' });
        if (!txn) {
            console.error('[PAYU CALLBACK] Unknown txnid', txnid);
            return redirectBack({
                payment: 'failed',
                reason: 'unknown-txn',
                txn: txnid,
            }, source);
        }

        const isSuccess = status?.toLowerCase() === 'success';
        const paymentId =
            (form.get('mihpayid') as string | null) || undefined;
        const mode = (form.get('mode') as string | null) || undefined;
        const bankRefNum =
            (form.get('bank_ref_num') as string | null) || undefined;
        const errorMessage =
            (form.get('error_Message') as string | null) ||
            (form.get('error_message') as string | null) ||
            undefined;

        // 3) Update the transaction row.
        await db.collection('transactions').updateOne(
            { _id: txn._id },
            {
                $set: {
                    status: isSuccess ? 'SUCCESS' : 'FAILED',
                    providerTransactionId: paymentId,
                    updatedAt: new Date(),
                    payuMeta: {
                        mode,
                        bankRefNum,
                        errorMessage,
                        rawStatus: status,
                    },
                } as any,
            }
        );

        if (!isSuccess) {
            return redirectBack({
                payment: 'failed',
                reason: status || 'cancelled',
                txn: txnid,
            }, source);
        }

        // 4) Success — route to the right finalization based on source.
        const userId = userIdStr && ObjectId.isValid(userIdStr)
            ? new ObjectId(userIdStr)
            : txn.userId;

        if (source === 'wallet') {
            // ── Wallet top-up: credit the user's wallet balance ──
            const topupAmount = parseInt(udf2Str || '0', 10);
            const amountPaisa = topupAmount * 100; // store in paisa

            await db.collection('users').updateOne(
                { _id: userId },
                {
                    $inc: { 'wallet.balance': amountPaisa },
                    $set: { 'wallet.currency': 'INR' },
                    $push: {
                        'wallet.transactions': {
                            _id: new ObjectId(),
                            type: 'CREDIT',
                            amount: amountPaisa,
                            reason: `PayU top-up ₹${topupAmount}`,
                            status: 'SUCCESS',
                            createdAt: new Date(),
                        },
                    } as any,
                }
            );

            return redirectBack({
                payment: 'success',
                txn: txnid,
                type: 'wallet',
            }, source);
        }

        // ── Plan purchase (onboarding or billing) ──
        const planIdStr = udf2Str;
        const planId =
            planIdStr && ObjectId.isValid(planIdStr)
                ? new ObjectId(planIdStr)
                : (txn.planId as ObjectId | undefined);

        const userUpdate: any = {};

        if (planId) {
            userUpdate.planId = planId;
        }

        if (source === 'onboarding') {
            userUpdate['onboarding.status'] = 'complete';
            userUpdate['onboarding.completedAt'] = new Date();
            userUpdate['onboarding.checkoutTransactionId'] = txnid;
            if (planId) {
                userUpdate['onboarding.selectedPlanId'] = planId.toString();
            }
        }

        if (Object.keys(userUpdate).length > 0) {
            await db
                .collection('users')
                .updateOne({ _id: userId }, { $set: userUpdate });
        }

        return redirectBack({
            payment: 'success',
            txn: txnid,
        }, source);
    } catch (e) {
        console.error('[PAYU CALLBACK] Failed to finalize', e);
        return redirectBack({
            payment: 'failed',
            reason: 'server-error',
            txn: txnid,
        }, source);
    }
}

/**
 * Some PayU configurations send a GET for cancellations. We just
 * redirect to the onboarding page so the user lands somewhere sane.
 */
export async function GET() {
    return redirectBack({ payment: 'failed', reason: 'cancelled' });
}
