import { NextRequest } from 'next/server';

import { rustClient } from '@/lib/rust-client';
import { RustApiError } from '@/lib/rust-client/fetcher';

/**
 * Start a checkout for a QR code — creates a `pay_` payment (using the QR's
 * fixed amount, or the payer-entered amount for open QRs) and returns its
 * hosted-checkout URL. The unguessable QR id is the capability.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: { amount?: number } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  try {
    const session = await rustClient.sabpay.createQrSession(id, {
      amount: typeof body.amount === 'number' ? body.amount : undefined,
    });
    return Response.json(session);
  } catch (err) {
    if (err instanceof RustApiError) {
      return Response.json({ error: err.message }, { status: err.status >= 400 ? err.status : 400 });
    }
    return Response.json({ error: 'Could not start the payment.' }, { status: 400 });
  }
}
