

'use server';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId, WithId } from 'mongodb';
import type { Transaction } from '@/lib/definitions';
import {
  buildPayuRequestHash,
  formatPayuAmount,
  generatePayuTxnId,
  getPayuConfig,
  type PayuRequestFields,
} from '@/lib/payu';

export interface PayuCreditCheckoutPayload {
  action: string;
  params: PayuRequestFields & { hash: string };
}

export interface PayuCreditCheckoutResult {
  success: boolean;
  error?: string;
  payload?: PayuCreditCheckoutPayload;
}

/**
 * Creates a PayU checkout for purchasing credits.
 *
 * Returns form params that the client auto-submits to PayU's hosted
 * payment page. On completion PayU redirects back to the callback
 * route at `/api/payments/payu/callback`.
 */
export async function handleCreatePayuCreditOrder(
  amount: number,
  currency: string = 'INR',
): Promise<PayuCreditCheckoutResult> {
  const session = await getSession();
  if (!session?.user) {
    return { success: false, error: 'Authentication required.' };
  }

  const payu = getPayuConfig();
  if (!payu) {
    return {
      success: false,
      error:
        'Payments are not configured. Please set PAYU_MERCHANT_KEY and PAYU_MERCHANT_SALT.',
    };
  }

  try {
    const formattedAmount = formatPayuAmount(amount);
    const txnid = generatePayuTxnId('crd');
    const productinfo = `${formattedAmount} ${currency} credits`;
    const firstname =
      (session.user.name || 'Customer').split(' ')[0].slice(0, 50) ||
      'Customer';
    const email = session.user.email;

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
      'http://localhost:3002';
    const surl = `${appUrl}/api/payments/payu/callback`;
    const furl = `${appUrl}/api/payments/payu/callback`;

    const udf1 = session.user._id.toString();
    const udf2 = '';
    const udf3 = 'credits';

    const phone =
      (session.user as any)?.phone || undefined;

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

    // Persist pending transaction
    const { db } = await connectToDatabase();
    const transaction: Omit<Transaction, '_id'> = {
      userId: new ObjectId(session.user._id),
      type: 'CREDITS',
      description: productinfo,
      amount: amount * 100, // store in smallest unit (paisa)
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
  } catch (e: any) {
    console.error('PayU credit order creation failed:', e);
    return {
      success: false,
      error: e.message || 'Failed to create PayU order.',
    };
  }
}

export async function getTransactions(): Promise<WithId<Transaction>[]> {
  const session = await getSession();
  if (!session?.user) {
    return [];
  }

  try {
    const { db } = await connectToDatabase();
    const transactions = await db
      .collection<Transaction>('transactions')
      .find({ userId: new ObjectId(session.user._id) })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    return JSON.parse(JSON.stringify(transactions));
  } catch (e) {
    console.error('Failed to fetch transactions:', e);
    return [];
  }
}

/**
 * Assigns a free plan to the user (no payment needed).
 * For paid plans, use createPayuPlanCheckout instead.
 */
export async function handlePlanChange(
  planId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session?.user) {
      return { success: false, error: 'Authentication required.' };
    }

    if (!ObjectId.isValid(planId)) {
      return { success: false, error: 'Invalid plan.' };
    }

    const { db } = await connectToDatabase();
    const plan = await db
      .collection('plans')
      .findOne({ _id: new ObjectId(planId) });
    if (!plan) {
      return { success: false, error: 'Plan not found.' };
    }

    // Only allow free plan changes through this action
    if (plan.price && plan.price > 0) {
      return { success: false, error: 'Paid plans require checkout.' };
    }

    await db.collection('users').updateOne(
      { _id: new ObjectId(session.user._id) },
      { $set: { planId: new ObjectId(planId) } },
    );

    return { success: true };
  } catch (e: any) {
    console.error('handlePlanChange failed:', e);
    return { success: false, error: e.message || 'Failed to change plan.' };
  }
}
