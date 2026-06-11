'use server';

/**
 * SabPay dashboard — server actions.
 *
 * These are a thin pass-through to the SabPay router on the Rust engine
 * (`rust/crates/sabpay`, mounted at `/v1/sabpay`). `rustClient.sabpay.*`
 * authenticates as the current SabNode session via the shared-secret JWT, so
 * every read/write is automatically scoped to the signed-in merchant. Mutations
 * return `{ error }` instead of throwing so the client can render inline
 * messages; reads surface through the route's error boundary.
 */

import { revalidatePath } from 'next/cache';

import { rustClient } from '@/lib/rust-client';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type {
  SabpayUpdateMerchantBody,
} from '@/lib/rust-client/sabpay';
import type {
  SabpayApiKey,
  SabpayMerchant,
  SabpayMode,
  SabpayPayment,
  SabpayPaymentStatus,
  SabpayStats,
  SabpayWebhookDelivery,
  SabpayWebhookEndpoint,
  SabpayWebhookEvent,
} from '@/lib/sabpay/types';

function errorMessage(err: unknown): string {
  if (err instanceof RustApiError) return err.message;
  return err instanceof Error ? err.message : 'Something went wrong.';
}

/* ── Overview ────────────────────────────────────────────────────────────── */

export interface SabpayOverviewData {
  merchant: SabpayMerchant;
  stats: SabpayStats;
  recent: SabpayPayment[];
}

export async function getSabpayOverview(): Promise<SabpayOverviewData> {
  return rustClient.sabpay.getOverview();
}

export async function getSabpayStats(): Promise<SabpayStats> {
  return rustClient.sabpay.getStats();
}

/* ── Payments ────────────────────────────────────────────────────────────── */

export async function getSabpayPayments(query: {
  status?: SabpayPaymentStatus;
  before?: string;
  limit?: number;
}): Promise<{ merchant: SabpayMerchant; payments: SabpayPayment[] }> {
  return rustClient.sabpay.listPayments({
    status: query.status,
    before: query.before,
    limit: query.limit ?? 50,
  });
}

export async function getSabpayPaymentDetail(
  id: string,
): Promise<SabpayPayment | null> {
  try {
    return await rustClient.sabpay.getPayment(id);
  } catch (err) {
    if (err instanceof RustApiError && err.status === 404) return null;
    throw err;
  }
}

export async function createSabpayPayment(input: {
  amount: number;
  description?: string;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<{ payment?: SabpayPayment; error?: string }> {
  try {
    const payment = await rustClient.sabpay.createPayment({
      amount: input.amount,
      description: input.description,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
    });
    revalidatePath('/sabpay');
    revalidatePath('/sabpay/payments');
    return { payment };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

/* ── API keys ────────────────────────────────────────────────────────────── */

export async function getSabpayKeys(): Promise<SabpayApiKey[]> {
  return rustClient.sabpay.listKeys();
}

export async function createSabpayKey(input: {
  name: string;
  mode: SabpayMode;
}): Promise<{ key?: SabpayApiKey; error?: string }> {
  try {
    const key = await rustClient.sabpay.createKey(input);
    revalidatePath('/sabpay/developers');
    return { key };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function revokeSabpayKey(
  keyId: string,
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const res = await rustClient.sabpay.revokeKey(keyId);
    revalidatePath('/sabpay/developers');
    return { ok: res.success };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

/* ── Webhooks ────────────────────────────────────────────────────────────── */

export interface SabpayWebhookData {
  endpoints: SabpayWebhookEndpoint[];
  deliveries: SabpayWebhookDelivery[];
}

export async function getSabpayWebhookData(): Promise<SabpayWebhookData> {
  return rustClient.sabpay.getWebhookData();
}

export async function createSabpayWebhook(input: {
  url: string;
  events: SabpayWebhookEvent[];
  description?: string;
}): Promise<{ endpoint?: SabpayWebhookEndpoint; error?: string }> {
  try {
    const endpoint = await rustClient.sabpay.createWebhook(input);
    revalidatePath('/sabpay/webhooks');
    return { endpoint };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function updateSabpayWebhook(
  id: string,
  patch: {
    active?: boolean;
    url?: string;
    events?: SabpayWebhookEvent[];
    description?: string;
  },
): Promise<{ endpoint?: SabpayWebhookEndpoint; error?: string }> {
  try {
    const endpoint = await rustClient.sabpay.updateWebhook(id, patch);
    revalidatePath('/sabpay/webhooks');
    return { endpoint };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function rotateSabpayWebhookSecret(
  id: string,
): Promise<{ endpoint?: SabpayWebhookEndpoint; error?: string }> {
  try {
    const endpoint = await rustClient.sabpay.rotateWebhook(id);
    revalidatePath('/sabpay/webhooks');
    return { endpoint };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function deleteSabpayWebhook(
  id: string,
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const res = await rustClient.sabpay.deleteWebhook(id);
    revalidatePath('/sabpay/webhooks');
    return { ok: res.success };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

/* ── Settings ────────────────────────────────────────────────────────────── */

export async function getSabpaySettings(): Promise<SabpayMerchant> {
  return rustClient.sabpay.getMerchant();
}

export async function saveSabpaySettings(
  patch: SabpayUpdateMerchantBody,
): Promise<{ merchant?: SabpayMerchant; error?: string }> {
  try {
    const merchant = await rustClient.sabpay.updateMerchant(patch);
    revalidatePath('/sabpay');
    revalidatePath('/sabpay/settings');
    return { merchant };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}
