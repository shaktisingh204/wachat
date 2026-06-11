import { NextRequest } from 'next/server';

import {
  fromRustError,
  listQuery,
  parseJsonBody,
  requireSabpayKey,
  withIdempotency,
} from '@/lib/sabpay/api-route-helpers.server';
import { rustClient } from '@/lib/rust-client';
import type { SabpayQrCode } from '@/lib/sabpay/types';

/**
 * SabPay public API — QR codes.
 *
 *   POST /api/sabpay/v1/qr_codes   create a UPI-style collect code
 *   GET  /api/sabpay/v1/qr_codes   list QR codes (newest first)
 *
 * Auth: `Authorization: Bearer sk_test_…` / `sk_live_…`.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function qrCodeResponse(q: SabpayQrCode) {
  return {
    id: q.id,
    object: 'qr_code',
    mode: q.mode,
    name: q.name,
    usage: q.usage,
    fixed_amount: q.fixedAmount,
    amount: q.amount,
    description: q.description,
    status: q.status,
    payload_url: q.payloadUrl,
    payments_count_received: q.paymentsCountReceived,
    payments_amount_received: q.paymentsAmountReceived,
    closed_at: q.closedAt,
    created_at: q.createdAt,
  };
}

export async function POST(req: NextRequest) {
  const auth = await requireSabpayKey(req);
  if ('error' in auth) return auth.error;
  const { ctx } = auth;

  const parsed = await parseJsonBody(req);
  if ('error' in parsed) return parsed.error;
  const { body } = parsed;

  return withIdempotency(req, ctx, body, async () => {
    const qr = await rustClient.sabpay.createQrCodeAs(
      ctx.userId.toHexString(),
      {
        name: typeof body.name === 'string' ? body.name : undefined,
        usage: body.usage as string,
        fixedAmount:
          typeof body.fixed_amount === 'boolean' ? body.fixed_amount : undefined,
        amount: typeof body.amount === 'number' ? body.amount : undefined,
        description:
          typeof body.description === 'string' ? body.description : undefined,
        mode: ctx.mode,
      },
    );
    return { status: 201, body: qrCodeResponse(qr) };
  }, 'Could not create the QR code.');
}

export async function GET(req: NextRequest) {
  const auth = await requireSabpayKey(req);
  if ('error' in auth) return auth.error;
  const { ctx } = auth;

  const { limit, before, status } = listQuery(req);

  try {
    const { qrCodes } = await rustClient.sabpay.listQrCodesAs(
      ctx.userId.toHexString(),
      { mode: ctx.mode, status, limit, before },
    );
    return Response.json({
      object: 'list',
      data: qrCodes.map(qrCodeResponse),
    });
  } catch (err) {
    return fromRustError(err);
  }
}
