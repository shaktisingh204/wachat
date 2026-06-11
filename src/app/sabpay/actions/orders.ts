'use server';

/**
 * SabPay dashboard — Orders server actions.
 *
 * Thin pass-through to the SabPay router on the Rust engine
 * (`rust/crates/sabpay`, mounted at `/v1/sabpay`). `rustClient.sabpay.*`
 * authenticates as the current SabNode session via the shared-secret JWT, so
 * every read/write is automatically scoped to the signed-in merchant. Mutations
 * return `{ order, error }` instead of throwing so the client can render inline
 * messages; reads return the data (or `null` on 404) and otherwise surface
 * through the route's error boundary.
 */

import { revalidatePath } from 'next/cache';

import { rustClient } from '@/lib/rust-client';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type {
  SabpayCreateOrderBody,
  SabpayStatusListQuery,
  SabpayUpdateOrderBody,
} from '@/lib/rust-client/sabpay';
import type { SabpayOrder, SabpayPayment } from '@/lib/sabpay/types';

function errorMessage(err: unknown): string {
  if (err instanceof RustApiError) return err.message;
  return err instanceof Error ? err.message : 'Something went wrong.';
}

/* ── Reads ───────────────────────────────────────────────────────────────── */

export async function getSabpayOrders(
  query: SabpayStatusListQuery = {},
): Promise<SabpayOrder[]> {
  const { orders } = await rustClient.sabpay.listOrders(query);
  return orders;
}

export async function getSabpayOrderDetail(
  id: string,
): Promise<SabpayOrder | null> {
  try {
    return await rustClient.sabpay.getOrder(id);
  } catch (err) {
    if (err instanceof RustApiError && err.status === 404) return null;
    throw err;
  }
}

export async function getSabpayOrderPayments(
  id: string,
): Promise<SabpayPayment[]> {
  const { payments } = await rustClient.sabpay.getOrderPayments(id);
  return payments;
}

/* ── Mutations ───────────────────────────────────────────────────────────── */

export async function createSabpayOrder(
  input: SabpayCreateOrderBody,
  idempotencyKey?: string,
): Promise<{ order?: SabpayOrder; error?: string }> {
  try {
    const order = await rustClient.sabpay.createOrder(input, idempotencyKey);
    revalidatePath('/sabpay/orders');
    revalidatePath('/sabpay');
    return { order };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function updateSabpayOrder(
  id: string,
  patch: SabpayUpdateOrderBody,
): Promise<{ order?: SabpayOrder; error?: string }> {
  try {
    const order = await rustClient.sabpay.updateOrder(id, patch);
    revalidatePath('/sabpay/orders');
    revalidatePath(`/sabpay/orders/${id}`);
    revalidatePath('/sabpay');
    return { order };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}
