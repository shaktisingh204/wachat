'use server';

/**
 * SabPay dashboard — Subscriptions server actions.
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
  SabpayCreateSubscriptionBody,
  SabpayStatusListQuery,
  SabpayUpdateSubscriptionBody,
} from '@/lib/rust-client/sabpay';
import type { SabpaySubscription } from '@/lib/sabpay/types';

function errorMessage(err: unknown): string {
  if (err instanceof RustApiError) return err.message;
  return err instanceof Error ? err.message : 'Something went wrong.';
}

/* ── Reads ───────────────────────────────────────────────────────────────── */

export async function getSabpaySubscriptions(
  query: SabpayStatusListQuery = {},
): Promise<SabpaySubscription[]> {
  const { subscriptions } = await rustClient.sabpay.listSubscriptions(query);
  return subscriptions;
}

export async function getSabpaySubscriptionDetail(
  id: string,
): Promise<SabpaySubscription | null> {
  try {
    return await rustClient.sabpay.getSubscription(id);
  } catch (err) {
    if (err instanceof RustApiError && err.status === 404) return null;
    throw err;
  }
}

/* ── Mutations ───────────────────────────────────────────────────────────── */

export async function createSabpaySubscription(
  input: SabpayCreateSubscriptionBody,
  idempotencyKey?: string,
): Promise<{ subscription?: SabpaySubscription; error?: string }> {
  try {
    const subscription = await rustClient.sabpay.createSubscription(
      input,
      idempotencyKey,
    );
    revalidatePath('/sabpay/subscriptions');
    revalidatePath('/sabpay');
    return { subscription };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function updateSabpaySubscription(
  id: string,
  patch: SabpayUpdateSubscriptionBody,
): Promise<{ subscription?: SabpaySubscription; error?: string }> {
  try {
    const subscription = await rustClient.sabpay.updateSubscription(id, patch);
    revalidatePath('/sabpay/subscriptions');
    revalidatePath(`/sabpay/subscriptions/${id}`);
    return { subscription };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function cancelSabpaySubscription(
  id: string,
  atCycleEnd = false,
): Promise<{ subscription?: SabpaySubscription; error?: string }> {
  try {
    const subscription = await rustClient.sabpay.cancelSubscription(
      id,
      atCycleEnd,
    );
    revalidatePath('/sabpay/subscriptions');
    revalidatePath(`/sabpay/subscriptions/${id}`);
    revalidatePath('/sabpay');
    return { subscription };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function pauseSabpaySubscription(
  id: string,
): Promise<{ subscription?: SabpaySubscription; error?: string }> {
  try {
    const subscription = await rustClient.sabpay.pauseSubscription(id);
    revalidatePath('/sabpay/subscriptions');
    revalidatePath(`/sabpay/subscriptions/${id}`);
    return { subscription };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function resumeSabpaySubscription(
  id: string,
): Promise<{ subscription?: SabpaySubscription; error?: string }> {
  try {
    const subscription = await rustClient.sabpay.resumeSubscription(id);
    revalidatePath('/sabpay/subscriptions');
    revalidatePath(`/sabpay/subscriptions/${id}`);
    return { subscription };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}
