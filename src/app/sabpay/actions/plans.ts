'use server';

/**
 * SabPay dashboard — Plans server actions.
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
  SabpayCreatePlanBody,
  SabpayListQuery,
} from '@/lib/rust-client/sabpay';
import type { SabpayPlan } from '@/lib/sabpay/types';

function errorMessage(err: unknown): string {
  if (err instanceof RustApiError) return err.message;
  return err instanceof Error ? err.message : 'Something went wrong.';
}

/* ── Reads ───────────────────────────────────────────────────────────────── */

export async function getSabpayPlans(
  query: SabpayListQuery = {},
): Promise<SabpayPlan[]> {
  const { plans } = await rustClient.sabpay.listPlans(query);
  return plans;
}

export async function getSabpayPlanDetail(
  id: string,
): Promise<SabpayPlan | null> {
  try {
    return await rustClient.sabpay.getPlan(id);
  } catch (err) {
    if (err instanceof RustApiError && err.status === 404) return null;
    throw err;
  }
}

/* ── Mutations ───────────────────────────────────────────────────────────── */

export async function createSabpayPlan(
  input: SabpayCreatePlanBody,
  idempotencyKey?: string,
): Promise<{ plan?: SabpayPlan; error?: string }> {
  try {
    const plan = await rustClient.sabpay.createPlan(input, idempotencyKey);
    revalidatePath('/sabpay/plans');
    revalidatePath('/sabpay');
    return { plan };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function deleteSabpayPlan(
  id: string,
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const res = await rustClient.sabpay.deletePlan(id);
    revalidatePath('/sabpay/plans');
    revalidatePath(`/sabpay/plans/${id}`);
    revalidatePath('/sabpay');
    return { ok: res.success };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}
