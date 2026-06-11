import { NextRequest } from 'next/server';

import { rustClient } from '@/lib/rust-client';
import { RustApiError } from '@/lib/rust-client/fetcher';

/**
 * Start a checkout from a no-code payment page — creates a `pay_` payment
 * (fixed amount or payer-entered for customer-decided pages, plus the submitted
 * custom-field values) and returns its hosted-checkout URL. The page slug is
 * the capability.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  let body: { amount?: number; fields?: Record<string, string> } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  try {
    const session = await rustClient.sabpay.createPageSession(slug, {
      amount: typeof body.amount === 'number' ? body.amount : undefined,
      fields:
        body.fields && typeof body.fields === 'object'
          ? (body.fields as Record<string, string>)
          : undefined,
    });
    return Response.json(session);
  } catch (err) {
    if (err instanceof RustApiError) {
      return Response.json({ error: err.message }, { status: err.status >= 400 ? err.status : 400 });
    }
    return Response.json({ error: 'Could not start the payment.' }, { status: 400 });
  }
}
