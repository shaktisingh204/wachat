'use server';

/**
 * SabPay dashboard — Customers server actions.
 *
 * Thin pass-through to the SabPay router on the Rust engine
 * (`rust/crates/sabpay`, mounted at `/v1/sabpay`). `rustClient.sabpay.*`
 * authenticates as the current SabNode session via the shared-secret JWT, so
 * every read/write is automatically scoped to the signed-in merchant. Mutations
 * return `{ customer, error }` (or `{ ok, error }` for delete) instead of
 * throwing so the client can render inline messages; reads return the data (or
 * `null` on 404) and otherwise surface through the route's error boundary.
 */

import { revalidatePath } from 'next/cache';

import { rustClient } from '@/lib/rust-client';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type {
  SabpayCreateCustomerBody,
  SabpayCustomerListQuery,
  SabpayUpdateCustomerBody,
} from '@/lib/rust-client/sabpay';
import type { SabpayCustomer, SabpayPayment } from '@/lib/sabpay/types';

function errorMessage(err: unknown): string {
  if (err instanceof RustApiError) return err.message;
  return err instanceof Error ? err.message : 'Something went wrong.';
}

/* ── Reads ───────────────────────────────────────────────────────────────── */

export async function getSabpayCustomers(
  query: SabpayCustomerListQuery = {},
): Promise<SabpayCustomer[]> {
  const { customers } = await rustClient.sabpay.listCustomers(query);
  return customers;
}

export async function getSabpayCustomerDetail(
  id: string,
): Promise<SabpayCustomer | null> {
  try {
    return await rustClient.sabpay.getCustomer(id);
  } catch (err) {
    if (err instanceof RustApiError && err.status === 404) return null;
    throw err;
  }
}

export async function getSabpayCustomerPayments(
  id: string,
): Promise<SabpayPayment[]> {
  const { payments } = await rustClient.sabpay.getCustomerPayments(id);
  return payments;
}

/* ── Mutations ───────────────────────────────────────────────────────────── */

export async function createSabpayCustomer(
  input: SabpayCreateCustomerBody,
  idempotencyKey?: string,
): Promise<{ customer?: SabpayCustomer; error?: string }> {
  try {
    const customer = await rustClient.sabpay.createCustomer(
      input,
      idempotencyKey,
    );
    revalidatePath('/sabpay/customers');
    revalidatePath('/sabpay');
    return { customer };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function updateSabpayCustomer(
  id: string,
  patch: SabpayUpdateCustomerBody,
): Promise<{ customer?: SabpayCustomer; error?: string }> {
  try {
    const customer = await rustClient.sabpay.updateCustomer(id, patch);
    revalidatePath('/sabpay/customers');
    revalidatePath(`/sabpay/customers/${id}`);
    revalidatePath('/sabpay');
    return { customer };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function deleteSabpayCustomer(
  id: string,
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const res = await rustClient.sabpay.deleteCustomer(id);
    revalidatePath('/sabpay/customers');
    revalidatePath('/sabpay');
    return { ok: res.success };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}
