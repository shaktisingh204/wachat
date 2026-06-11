import { NextRequest } from 'next/server';

import { rustClient } from '@/lib/rust-client';
import { RustApiError } from '@/lib/rust-client/fetcher';

/**
 * SabPay hosted checkout — TEST-mode simulator.
 *
 * Thin proxy to the Rust engine: test payments never touch PayU. The engine
 * finalizes the payment (succeeded/failed), fans out the webhook, and returns
 * the merchant redirect target. Only test-mode payments still in `created` can
 * be simulated (the engine enforces this).
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: { outcome?: string; name?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const outcome = body.outcome === 'success' ? 'success' : 'failure';

  try {
    const result = await rustClient.sabpay.simulate(id, {
      outcome,
      name: body.name,
      email: body.email,
    });
    return Response.json({
      status: result.status,
      redirect_url: result.redirectUrl ?? null,
    });
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
