'use server';

/**
 * SabPay dashboard — Invoices server actions.
 *
 * Thin pass-through to the SabPay router on the Rust engine
 * (`rust/crates/sabpay`, mounted at `/v1/sabpay`). `rustClient.sabpay.*`
 * authenticates as the current SabNode session via the shared-secret JWT, so
 * every read/write is automatically scoped to the signed-in merchant. Mutations
 * return `{ error }` instead of throwing so the client can render inline
 * messages; reads return the data (or `null` on 404) / surface through the
 * route's error boundary.
 */

import { revalidatePath } from 'next/cache';

import { rustClient } from '@/lib/rust-client';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type {
  SabpayCreateInvoiceBody,
  SabpayStatusListQuery,
  SabpayUpdateInvoiceBody,
} from '@/lib/rust-client/sabpay';
import type { SabpayInvoice } from '@/lib/sabpay/types';

function errorMessage(err: unknown): string {
  if (err instanceof RustApiError) return err.message;
  return err instanceof Error ? err.message : 'Something went wrong.';
}

/* ── Reads ───────────────────────────────────────────────────────────────── */

export async function getSabpayInvoices(
  query: SabpayStatusListQuery = {},
): Promise<SabpayInvoice[]> {
  const { invoices } = await rustClient.sabpay.listInvoices(query);
  return invoices;
}

export async function getSabpayInvoiceDetail(
  id: string,
): Promise<SabpayInvoice | null> {
  try {
    return await rustClient.sabpay.getInvoice(id);
  } catch (err) {
    if (err instanceof RustApiError && err.status === 404) return null;
    throw err;
  }
}

/* ── Mutations ───────────────────────────────────────────────────────────── */

export async function createSabpayInvoice(
  input: SabpayCreateInvoiceBody,
  idempotencyKey?: string,
): Promise<{ invoice?: SabpayInvoice; error?: string }> {
  try {
    const invoice = await rustClient.sabpay.createInvoice(input, idempotencyKey);
    revalidatePath('/sabpay/invoices');
    revalidatePath('/sabpay');
    return { invoice };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function updateSabpayInvoice(
  id: string,
  patch: SabpayUpdateInvoiceBody,
): Promise<{ invoice?: SabpayInvoice; error?: string }> {
  try {
    const invoice = await rustClient.sabpay.updateInvoice(id, patch);
    revalidatePath('/sabpay/invoices');
    revalidatePath(`/sabpay/invoices/${id}`);
    return { invoice };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function deleteSabpayInvoice(
  id: string,
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const res = await rustClient.sabpay.deleteInvoice(id);
    revalidatePath('/sabpay/invoices');
    revalidatePath(`/sabpay/invoices/${id}`);
    revalidatePath('/sabpay');
    return { ok: res.success };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function issueSabpayInvoice(
  id: string,
): Promise<{ invoice?: SabpayInvoice; error?: string }> {
  try {
    const invoice = await rustClient.sabpay.issueInvoice(id);
    revalidatePath('/sabpay/invoices');
    revalidatePath(`/sabpay/invoices/${id}`);
    revalidatePath('/sabpay');
    return { invoice };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function cancelSabpayInvoice(
  id: string,
): Promise<{ invoice?: SabpayInvoice; error?: string }> {
  try {
    const invoice = await rustClient.sabpay.cancelInvoice(id);
    revalidatePath('/sabpay/invoices');
    revalidatePath(`/sabpay/invoices/${id}`);
    revalidatePath('/sabpay');
    return { invoice };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}
