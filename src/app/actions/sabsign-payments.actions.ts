'use server';

import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { createSabpayPayment } from '@/app/sabpay/actions';
import { getKycByUser } from '@/lib/sabpay/kyc';

/**
 * SabSign ↔ SabPay payments. An envelope can require a payment (collected via
 * SabPay) before signing completes. The requirement is stored in
 * `esign_payments` (keyed by envelopeId); the SabPay payment is created under
 * the SENDER's merchant account — which must be KYC-verified (ties SabSign
 * payments to the SabPay onboarding gate).
 */

const PAID_STATUSES = new Set(['paid', 'captured', 'success', 'succeeded', 'completed']);

async function requireUserId(): Promise<string> {
  const session = await getSession();
  const id = (session?.user as { _id?: unknown } | undefined)?._id;
  if (!id) throw new Error('Unauthorized');
  return String(id);
}

export interface EnvelopePaymentView {
  required: boolean;
  amount?: number;
  currency?: string;
  checkoutUrl?: string;
  paid: boolean;
}

/**
 * Require a payment on an envelope. Creates a SabPay payment under the
 * sender's (verified) merchant account and records it. Authed — only the
 * envelope owner, and only with a verified SabPay account.
 */
export async function setEnvelopePaymentRequirement(
  envelopeId: string,
  amount: number,
  description?: string,
): Promise<{ ok: boolean; checkoutUrl?: string; error?: string }> {
  const userId = await requireUserId();
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Enter a valid amount.' };
  }

  // Gate on SabPay KYC — you cannot collect payments until verified.
  const kyc = await getKycByUser(userId);
  if (kyc?.status !== 'verified') {
    return {
      ok: false,
      error: 'Complete SabPay onboarding (KYC) before collecting payments on documents.',
    };
  }

  const res = await createSabpayPayment({
    amount,
    description: description || `SabSign document ${envelopeId}`,
  });
  if (res.error || !res.payment) {
    return { ok: false, error: res.error || 'Could not create payment.' };
  }

  const { db } = await connectToDatabase();
  const now = new Date().toISOString();
  await db.collection('esign_payments').updateOne(
    { envelopeId },
    {
      $set: {
        envelopeId,
        userId,
        paymentId: res.payment.id,
        checkoutUrl: res.payment.checkoutUrl,
        amount: res.payment.amount ?? amount,
        currency: (res.payment as { currency?: string }).currency ?? 'INR',
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
  revalidatePath('/sabsign');
  return { ok: true, checkoutUrl: res.payment.checkoutUrl };
}

export async function clearEnvelopePaymentRequirement(
  envelopeId: string,
): Promise<{ ok: boolean }> {
  await requireUserId();
  const { db } = await connectToDatabase();
  await db.collection('esign_payments').deleteOne({ envelopeId });
  revalidatePath('/sabsign');
  return { ok: true };
}

/**
 * Public — the signer portal reads the payment requirement + live paid status
 * (status comes from the SabPay payment doc). No session.
 */
export async function getEnvelopePaymentPublic(
  envelopeId: string,
): Promise<EnvelopePaymentView> {
  const { db } = await connectToDatabase();
  const req = await db.collection('esign_payments').findOne({ envelopeId });
  if (!req) return { required: false, paid: false };

  let paid = false;
  if (req.paymentId) {
    const pay = await db
      .collection('sabpay_payments')
      .findOne({ paymentId: req.paymentId }, { projection: { status: 1 } });
    paid = !!pay && PAID_STATUSES.has(String(pay.status).toLowerCase());
  }
  return {
    required: true,
    amount: req.amount,
    currency: req.currency,
    checkoutUrl: req.checkoutUrl,
    paid,
  };
}
