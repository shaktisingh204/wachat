import { NextRequest } from 'next/server';

import { rustClient } from '@/lib/rust-client';
import { RustApiError } from '@/lib/rust-client/fetcher';

/**
 * Start a checkout for a payment link — creates/reuses a `pay_` payment and
 * returns its hosted-checkout URL. The unguessable plink id is the capability.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const session = await rustClient.sabpay.createLinkSession(id);
    return Response.json(session);
  } catch (err) {
    if (err instanceof RustApiError) {
      return Response.json({ error: err.message }, { status: err.status >= 400 ? err.status : 400 });
    }
    return Response.json({ error: 'Could not start the payment.' }, { status: 400 });
  }
}
