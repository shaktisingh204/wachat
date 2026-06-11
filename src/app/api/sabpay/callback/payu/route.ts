import { NextRequest, NextResponse } from 'next/server';

import {
  finalizePayment,
  getPaymentDocByTxnId,
  paymentDocToPayment,
  sabpayAppUrl,
  type SabpayPaymentDoc,
} from '@/lib/sabpay/db.server';
import { dispatchSabpayEvent } from '@/lib/sabpay/webhooks.server';
import {
  getPayuConfig,
  verifyPayuResponseHash,
  type PayuResponseFields,
} from '@/lib/payu';

/**
 * SabPay — PayU success + failure callback (surl/furl).
 *
 * PayU form-POSTs the customer's browser here after the hosted payment
 * page finishes. Mirrors the platform billing callback at
 * /api/payments/payu/callback, but for SabPay merchant payments:
 *
 *   1) recompute + verify the SHA-512 reverse hash (reject tampering),
 *   2) look the payment up by txnid (cookies don't survive cross-origin
 *      POST redirects, so the session is never consulted),
 *   3) finalize it exactly once (idempotent against PayU retries),
 *   4) fire payment.succeeded / payment.failed webhooks (fire-and-forget),
 *   5) 303-redirect the customer to the merchant's success_url /
 *      cancel_url with `sabpay_payment_id` + `sabpay_status` appended —
 *      falling back to our own hosted receipt at /pay/<id>.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

function redirectTo(url: URL): NextResponse {
  // 303 forces a GET even though PayU's callback arrived as a POST.
  return NextResponse.redirect(url, { status: 303 });
}

function merchantRedirect(
  payment: SabpayPaymentDoc,
  succeeded: boolean,
): NextResponse {
  const base = succeeded ? payment.successUrl : payment.cancelUrl;
  const url = base
    ? new URL(base)
    : new URL(`/pay/${payment.paymentId}`, sabpayAppUrl());
  url.searchParams.set('sabpay_payment_id', payment.paymentId);
  url.searchParams.set('sabpay_status', succeeded ? 'succeeded' : 'failed');
  return redirectTo(url);
}

export async function POST(request: NextRequest) {
  const payu = getPayuConfig();
  if (!payu) {
    console.error('[sabpay payu callback] PayU env not configured.');
    return redirectTo(new URL('/pay/error', sabpayAppUrl()));
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch (e) {
    console.error('[sabpay payu callback] Could not parse form body', e);
    return redirectTo(new URL('/pay/error', sabpayAppUrl()));
  }

  const fields = toResponseFields(form);
  if (!fields.txnid) {
    return redirectTo(new URL('/pay/error', sabpayAppUrl()));
  }

  // 1) Reverse-hash verification — reject tampered responses outright.
  if (!verifyPayuResponseHash(fields, payu.salt)) {
    console.error('[sabpay payu callback] Hash mismatch', {
      txnid: fields.txnid,
      status: fields.status,
    });
    return redirectTo(new URL('/pay/error', sabpayAppUrl()));
  }

  // 2) Find the SabPay payment behind this txnid.
  const payment = await getPaymentDocByTxnId(fields.txnid);
  if (!payment) {
    console.error('[sabpay payu callback] Unknown txnid', fields.txnid);
    return redirectTo(new URL('/pay/error', sabpayAppUrl()));
  }

  const succeeded = fields.status.toLowerCase() === 'success';
  const errorMessage =
    (form.get('error_Message') as string | null) ||
    (form.get('error_message') as string | null) ||
    undefined;

  // 3) Finalize exactly once. If PayU retries the callback, the guard in
  //    finalizePayment returns null and we just redirect using the doc's
  //    already-settled status.
  const updated = await finalizePayment(payment.paymentId, {
    succeeded,
    providerPaymentId: (form.get('mihpayid') as string | null) || undefined,
    providerPaymentMode: (form.get('mode') as string | null) || undefined,
    providerBankRefNum: (form.get('bank_ref_num') as string | null) || undefined,
    providerErrorMessage: errorMessage,
    failureReason: succeeded ? undefined : fields.status || 'failed',
  });

  if (updated) {
    // 4) Webhooks — never block the customer's redirect on delivery.
    void dispatchSabpayEvent(
      updated.userId,
      succeeded ? 'payment.succeeded' : 'payment.failed',
      paymentDocToPayment(updated),
    );
    return merchantRedirect(updated, succeeded);
  }

  return merchantRedirect(payment, payment.status === 'succeeded');
}

/** Some PayU configurations send a GET on cancellation. */
export async function GET(request: NextRequest) {
  const txnid = new URL(request.url).searchParams.get('txnid');
  if (txnid) {
    const payment = await getPaymentDocByTxnId(txnid);
    if (payment) {
      return merchantRedirect(payment, payment.status === 'succeeded');
    }
  }
  return redirectTo(new URL('/pay/error', sabpayAppUrl()));
}
