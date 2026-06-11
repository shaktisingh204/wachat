import { NextRequest, NextResponse } from 'next/server';

import { rustClient } from '@/lib/rust-client';
import { RustApiError } from '@/lib/rust-client/fetcher';

/**
 * SabPay — PayU success + failure callback (surl/furl).
 *
 * PayU form-POSTs the customer's browser here after the hosted payment page
 * finishes. We forward the posted fields to the Rust engine, which:
 *   1) recomputes + verifies the SHA-512 reverse hash (rejects tampering),
 *   2) finalizes the payment exactly once (idempotent against PayU retries),
 *   3) fans out the payment.succeeded / payment.failed webhooks,
 *   4) returns the merchant redirect target.
 * We then 303-redirect the customer there (or to our hosted receipt).
 *
 * The verification is keyed on `txnid`, not the session cookie, because some
 * browsers strip cookies on cross-origin POST redirects.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3002';

function redirectTo(target: string): NextResponse {
  // 303 forces a GET even though PayU's callback arrived as a POST.
  return NextResponse.redirect(new URL(target, APP_URL), { status: 303 });
}

export async function POST(request: NextRequest) {
  let fields: Record<string, string> = {};
  try {
    const form = await request.formData();
    for (const [k, v] of form.entries()) {
      if (typeof v === 'string') fields[k] = v;
    }
  } catch (e) {
    console.error('[sabpay payu callback] could not parse form body', e);
    return redirectTo('/pay/error');
  }

  try {
    const result = await rustClient.sabpay.payuCallback(fields);
    const target = result.redirectUrl || `${APP_URL}/pay/${result.paymentId}`;
    return redirectTo(target);
  } catch (err) {
    if (err instanceof RustApiError) {
      console.error('[sabpay payu callback] rust rejected:', err.code, err.message);
    } else {
      console.error('[sabpay payu callback] failed', err);
    }
    return redirectTo('/pay/error');
  }
}

/** Some PayU configurations send a GET on cancellation. */
export async function GET() {
  return redirectTo('/pay/error');
}
