'use server';

/**
 * SabPay dashboard — Payment Link server actions.
 *
 * Thin pass-through to the SabPay router on the Rust engine
 * (`rust/crates/sabpay`, mounted at `/v1/sabpay`). `rustClient.sabpay.*`
 * authenticates as the current SabNode session via the shared-secret JWT, so
 * every read/write is automatically scoped to the signed-in merchant. Mutations
 * return `{ error }` instead of throwing so the client can render inline
 * messages; reads return the data (or `null` on 404) or surface through the
 * route's error boundary.
 */

import { revalidatePath } from 'next/cache';

import { rustClient } from '@/lib/rust-client';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type {
  SabpayCreatePaymentLinkBody,
  SabpayStatusListQuery,
  SabpayUpdatePaymentLinkBody,
} from '@/lib/rust-client/sabpay';
import type { SabpayPaymentLink } from '@/lib/sabpay/types';

function errorMessage(err: unknown): string {
  if (err instanceof RustApiError) return err.message;
  return err instanceof Error ? err.message : 'Something went wrong.';
}

/* ── Reads ───────────────────────────────────────────────────────────────── */

export async function getSabpayPaymentLinks(
  query: SabpayStatusListQuery = {},
): Promise<SabpayPaymentLink[]> {
  const { paymentLinks } = await rustClient.sabpay.listPaymentLinks(query);
  return paymentLinks;
}

export async function getSabpayPaymentLinkDetail(
  id: string,
): Promise<SabpayPaymentLink | null> {
  try {
    return await rustClient.sabpay.getPaymentLink(id);
  } catch (err) {
    if (err instanceof RustApiError && err.status === 404) return null;
    throw err;
  }
}

/* ── Mutations ───────────────────────────────────────────────────────────── */

export async function createSabpayPaymentLink(
  input: SabpayCreatePaymentLinkBody,
  idempotencyKey?: string,
): Promise<{ paymentLink?: SabpayPaymentLink; error?: string }> {
  try {
    const paymentLink = await rustClient.sabpay.createPaymentLink(input, idempotencyKey);
    revalidatePath('/sabpay');
    revalidatePath('/sabpay/payment-links');
    return { paymentLink };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function updateSabpayPaymentLink(
  id: string,
  patch: SabpayUpdatePaymentLinkBody,
): Promise<{ paymentLink?: SabpayPaymentLink; error?: string }> {
  try {
    const paymentLink = await rustClient.sabpay.updatePaymentLink(id, patch);
    revalidatePath('/sabpay/payment-links');
    revalidatePath(`/sabpay/payment-links/${id}`);
    return { paymentLink };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function cancelSabpayPaymentLink(
  id: string,
): Promise<{ paymentLink?: SabpayPaymentLink; error?: string }> {
  try {
    const paymentLink = await rustClient.sabpay.cancelPaymentLink(id);
    revalidatePath('/sabpay');
    revalidatePath('/sabpay/payment-links');
    revalidatePath(`/sabpay/payment-links/${id}`);
    return { paymentLink };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}
