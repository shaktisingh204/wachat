import { NextRequest } from 'next/server';

import {
  finalizePayment,
  getPaymentDocById,
  paymentDocToPayment,
  sabpayPayments,
} from '@/lib/sabpay/db.server';
import { dispatchSabpayEvent } from '@/lib/sabpay/webhooks.server';

/**
 * SabPay hosted checkout — TEST-mode simulator.
 *
 * Test payments never touch PayU. The checkout page shows a
 * "Simulate success / failure" pair instead of the card rail so a
 * merchant can exercise the full loop (create → checkout → webhook →
 * redirect) before going live. Only payments created with an sk_test_
 * key (mode "test") and still in `created` can be simulated.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const payment = await getPaymentDocById(id);
  if (!payment) {
    return Response.json({ error: 'Payment not found.' }, { status: 404 });
  }
  if (payment.mode !== 'test') {
    return Response.json(
      { error: 'Only test payments can be simulated.' },
      { status: 400 },
    );
  }
  if (payment.status !== 'created') {
    return Response.json(
      { error: 'This payment is already finished.' },
      { status: 409 },
    );
  }

  let body: { outcome?: string; name?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const succeeded = body.outcome === 'success';

  // Keep whatever contact details the test customer typed (optional).
  const name = (body.name ?? '').trim().slice(0, 60);
  const email = (body.email ?? '').trim().slice(0, 200);
  if (name || email) {
    const col = await sabpayPayments();
    await col.updateOne(
      { paymentId: payment.paymentId },
      {
        $set: {
          ...(name ? { customerName: name } : {}),
          ...(email ? { customerEmail: email } : {}),
          updatedAt: new Date().toISOString(),
        },
      },
    );
  }

  const updated = await finalizePayment(payment.paymentId, {
    succeeded,
    providerPaymentId: `sim_${payment.providerTxnId}`,
    providerPaymentMode: 'SIMULATED',
    failureReason: succeeded ? undefined : 'simulated_failure',
  });
  if (!updated) {
    return Response.json(
      { error: 'This payment is already finished.' },
      { status: 409 },
    );
  }

  const publicPayment = paymentDocToPayment(updated);
  void dispatchSabpayEvent(
    updated.userId,
    succeeded ? 'payment.succeeded' : 'payment.failed',
    publicPayment,
  );

  const redirectBase = succeeded ? updated.successUrl : updated.cancelUrl;
  let redirectUrl: string | null = null;
  if (redirectBase) {
    const url = new URL(redirectBase);
    url.searchParams.set('sabpay_payment_id', updated.paymentId);
    url.searchParams.set('sabpay_status', updated.status);
    redirectUrl = url.toString();
  }

  return Response.json({
    status: updated.status,
    redirect_url: redirectUrl,
  });
}
