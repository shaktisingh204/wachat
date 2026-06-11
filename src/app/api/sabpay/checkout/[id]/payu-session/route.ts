import { NextRequest } from 'next/server';

import { rustClient } from '@/lib/rust-client';
import { RustApiError } from '@/lib/rust-client/fetcher';

/**
 * SabPay hosted checkout — build the signed PayU form for a LIVE payment.
 *
 * Thin proxy to the Rust engine, which collects the customer's contact
 * details, persists them, computes the PayU SHA-512 request hash, and returns
 * the field set the browser auto-submits to secure.payu.in. The payment id is
 * the capability; nothing else is trusted from the client.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: { name?: string; email?: string; phone?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  try {
    const session = await rustClient.sabpay.payuSession(id, {
      name: (body.name ?? '').trim(),
      email: (body.email ?? '').trim(),
      phone: (body.phone ?? '').trim(),
    });
    return Response.json(session);
  } catch (err) {
    if (err instanceof RustApiError) {
      return Response.json(
        { error: err.message },
        { status: err.status >= 400 ? err.status : 400 },
      );
    }
    return Response.json(
      { error: 'Could not reach the payment service. Please try again.' },
      { status: 500 },
    );
  }
}
