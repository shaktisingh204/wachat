'use server';

/**
 * SabPay dashboard — Payment Page server actions.
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
  SabpayCreatePaymentPageBody,
  SabpayListQuery,
  SabpayUpdatePaymentPageBody,
} from '@/lib/rust-client/sabpay';
import type { SabpayPaymentPage } from '@/lib/sabpay/types';

function errorMessage(err: unknown): string {
  if (err instanceof RustApiError) return err.message;
  return err instanceof Error ? err.message : 'Something went wrong.';
}

/* ── Reads ───────────────────────────────────────────────────────────────── */

export async function getSabpayPaymentPages(
  query: SabpayListQuery = {},
): Promise<SabpayPaymentPage[]> {
  const { pages } = await rustClient.sabpay.listPaymentPages(query);
  return pages;
}

export async function getSabpayPaymentPageDetail(
  id: string,
): Promise<SabpayPaymentPage | null> {
  try {
    return await rustClient.sabpay.getPaymentPage(id);
  } catch (err) {
    if (err instanceof RustApiError && err.status === 404) return null;
    throw err;
  }
}

/**
 * Live slug-availability check for the create form. A read, so it throws on
 * failure rather than returning an `{ error }` envelope.
 */
export async function checkSabpaySlugAvailable(slug: string): Promise<boolean> {
  const { available } = await rustClient.sabpay.checkPageSlug(slug);
  return available;
}

/* ── Mutations ───────────────────────────────────────────────────────────── */

export async function createSabpayPaymentPage(
  input: SabpayCreatePaymentPageBody,
  idempotencyKey?: string,
): Promise<{ page?: SabpayPaymentPage; error?: string }> {
  try {
    const page = await rustClient.sabpay.createPaymentPage(input, idempotencyKey);
    revalidatePath('/sabpay');
    revalidatePath('/sabpay/payment-pages');
    return { page };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function updateSabpayPaymentPage(
  id: string,
  patch: SabpayUpdatePaymentPageBody,
): Promise<{ page?: SabpayPaymentPage; error?: string }> {
  try {
    const page = await rustClient.sabpay.updatePaymentPage(id, patch);
    revalidatePath('/sabpay/payment-pages');
    revalidatePath(`/sabpay/payment-pages/${id}`);
    return { page };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function deleteSabpayPaymentPage(
  id: string,
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const res = await rustClient.sabpay.deletePaymentPage(id);
    revalidatePath('/sabpay');
    revalidatePath('/sabpay/payment-pages');
    revalidatePath(`/sabpay/payment-pages/${id}`);
    return { ok: res.success };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}
