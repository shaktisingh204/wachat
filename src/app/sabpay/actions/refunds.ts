'use server';

/**
 * SabPay dashboard — Refunds server actions.
 *
 * Thin pass-through to the SabPay router on the Rust engine
 * (`rust/crates/sabpay`, mounted at `/v1/sabpay`). `rustClient.sabpay.*`
 * authenticates as the current SabNode session via the shared-secret JWT, so
 * every read/write is automatically scoped to the signed-in merchant. The
 * create mutation returns `{ refund, error }` instead of throwing so the client
 * can render inline messages; reads return the data (or `null` on 404) and
 * otherwise surface through the route's error boundary.
 *
 * A refund touches the underlying payment (`amountRefunded` / `refundStatus`),
 * so creating one revalidates the refunds list, the payments list, the affected
 * payment's detail page, and the overview.
 */

import { revalidatePath } from 'next/cache';

import { rustClient } from '@/lib/rust-client';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type {
  SabpayCreateRefundBody,
  SabpayStatusListQuery,
} from '@/lib/rust-client/sabpay';
import type { SabpayRefund } from '@/lib/sabpay/types';

function errorMessage(err: unknown): string {
  if (err instanceof RustApiError) return err.message;
  return err instanceof Error ? err.message : 'Something went wrong.';
}

/* ── Reads ───────────────────────────────────────────────────────────────── */

export async function getSabpayRefunds(
  query: SabpayStatusListQuery = {},
): Promise<SabpayRefund[]> {
  const { refunds } = await rustClient.sabpay.listRefunds(query);
  return refunds;
}

export async function getSabpayRefundDetail(
  id: string,
): Promise<SabpayRefund | null> {
  try {
    return await rustClient.sabpay.getRefund(id);
  } catch (err) {
    if (err instanceof RustApiError && err.status === 404) return null;
    throw err;
  }
}

export async function getSabpayPaymentRefunds(
  paymentId: string,
): Promise<SabpayRefund[]> {
  const { refunds } = await rustClient.sabpay.listPaymentRefunds(paymentId);
  return refunds;
}

/* ── Mutations ───────────────────────────────────────────────────────────── */

export async function createSabpayRefund(
  paymentId: string,
  body: SabpayCreateRefundBody = {},
  idempotencyKey?: string,
): Promise<{ refund?: SabpayRefund; error?: string }> {
  try {
    const refund = await rustClient.sabpay.createRefund(
      paymentId,
      body,
      idempotencyKey,
    );
    revalidatePath('/sabpay/refunds');
    revalidatePath('/sabpay/payments');
    revalidatePath(`/sabpay/payments/${paymentId}`);
    revalidatePath('/sabpay');
    return { refund };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}
