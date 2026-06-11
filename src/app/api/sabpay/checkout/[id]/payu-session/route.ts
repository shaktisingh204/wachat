import { NextRequest } from 'next/server';

import {
  getPaymentDocById,
  sabpayAppUrl,
  sabpayPayments,
} from '@/lib/sabpay/db.server';
import {
  buildPayuRequestHash,
  formatPayuAmount,
  getPayuConfig,
} from '@/lib/payu';

/**
 * SabPay hosted checkout — builds the signed PayU form for a LIVE payment.
 *
 * The checkout page collects the customer's name/email/phone (PayU's
 * SHA-512 request hash covers firstname + email, so they must be final
 * before signing), we persist them on the payment, then return the
 * field set the browser auto-submits to secure.payu.in.
 *
 * Public by design: the payment id is a 96-bit random slug, the route
 * only operates on payments still in `created`, and the amount/URLs all
 * come from the server-side payment doc — nothing client-supplied is
 * trusted beyond the customer's own contact fields.
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
  if (payment.status !== 'created') {
    return Response.json(
      { error: 'This payment is already finished.' },
      { status: 409 },
    );
  }
  if (payment.mode !== 'live') {
    return Response.json(
      { error: 'Test payments use the simulator, not PayU.' },
      { status: 400 },
    );
  }

  const payu = getPayuConfig();
  if (!payu) {
    console.error('[sabpay] PayU env not configured for live checkout.');
    return Response.json(
      { error: 'Payments are temporarily unavailable. Please try again later.' },
      { status: 503 },
    );
  }

  let body: { name?: string; email?: string; phone?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const name = (body.name ?? '').trim().slice(0, 60);
  const email = (body.email ?? '').trim().slice(0, 200);
  const phone = (body.phone ?? '').trim().slice(0, 15);
  if (!name) {
    return Response.json({ error: 'Please enter your name.' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: 'Please enter a valid email.' }, { status: 400 });
  }
  if (!/^\d{10}$/.test(phone)) {
    return Response.json(
      { error: 'Please enter a valid 10-digit mobile number.' },
      { status: 400 },
    );
  }

  // Persist the customer on the payment before signing.
  const col = await sabpayPayments();
  await col.updateOne(
    { paymentId: payment.paymentId },
    {
      $set: {
        customerName: name,
        customerEmail: email,
        customerPhone: phone,
        updatedAt: new Date().toISOString(),
      },
    },
  );

  const callbackUrl = `${sabpayAppUrl()}/api/sabpay/callback/payu`;
  // PayU strips characters like | from productinfo into the hash on some
  // rails — keep it conservatively alphanumeric.
  const productinfo = payment.description
    .replace(/[^a-zA-Z0-9 .,-]/g, ' ')
    .trim()
    .slice(0, 100) || 'Payment';

  const fields = {
    key: payu.key,
    txnid: payment.providerTxnId,
    amount: formatPayuAmount(payment.amount / 100),
    productinfo,
    firstname: name,
    email,
    phone,
    surl: callbackUrl,
    furl: callbackUrl,
    udf1: payment.paymentId,
    udf2: 'sabpay',
  };
  const hash = buildPayuRequestHash(fields, payu.salt);

  return Response.json({
    action: payu.action,
    fields: { ...fields, hash },
  });
}
