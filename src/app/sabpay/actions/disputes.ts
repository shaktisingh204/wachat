'use server';

/**
 * SabPay dashboard — Disputes server actions.
 *
 * Thin pass-through to the SabPay router on the Rust engine
 * (`rust/crates/sabpay`, mounted at `/v1/sabpay`) via `rustClient.sabpay.*`.
 * Reads return the data (or `null` on a 404, like `getSabpayPaymentDetail`);
 * lifecycle mutations return `{ dispute?, error? }` and revalidate every
 * affected path. A dispute resolution moves money, so it also revalidates the
 * linked payment, the payments list, and the overview.
 */

import { revalidatePath } from 'next/cache';

import { rustClient } from '@/lib/rust-client';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type {
  SabpayContestDisputeBody,
  SabpayCreateTestDisputeBody,
  SabpayDisputesList,
} from '@/lib/rust-client/sabpay';
import type { SabpayDispute } from '@/lib/sabpay/types';

function errorMessage(err: unknown): string {
  if (err instanceof RustApiError) return err.message;
  return err instanceof Error ? err.message : 'Something went wrong.';
}

/** Revalidate every surface a dispute resolution touches. */
function revalidateDispute(dispute?: SabpayDispute): void {
  revalidatePath('/sabpay/disputes');
  if (dispute) {
    revalidatePath(`/sabpay/disputes/${dispute.id}`);
    revalidatePath(`/sabpay/payments/${dispute.paymentId}`);
  }
  revalidatePath('/sabpay/payments');
  revalidatePath('/sabpay');
}

export async function getSabpayDisputes(
  query: { status?: string; before?: string; limit?: number } = {},
): Promise<SabpayDisputesList> {
  return rustClient.sabpay.listDisputes({
    status: query.status,
    before: query.before,
    limit: query.limit ?? 50,
  });
}

export async function getSabpayDisputeDetail(
  id: string,
): Promise<SabpayDispute | null> {
  try {
    return await rustClient.sabpay.getDispute(id);
  } catch (err) {
    if (err instanceof RustApiError && err.status === 404) return null;
    throw err;
  }
}

export async function acceptSabpayDispute(
  id: string,
): Promise<{ dispute?: SabpayDispute; error?: string }> {
  try {
    const dispute = await rustClient.sabpay.acceptDispute(id);
    revalidateDispute(dispute);
    return { dispute };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function contestSabpayDispute(
  id: string,
  body: SabpayContestDisputeBody,
): Promise<{ dispute?: SabpayDispute; error?: string }> {
  try {
    const dispute = await rustClient.sabpay.contestDispute(id, body);
    revalidateDispute(dispute);
    return { dispute };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function createSabpayTestDispute(
  body: SabpayCreateTestDisputeBody,
): Promise<{ dispute?: SabpayDispute; error?: string }> {
  try {
    const dispute = await rustClient.sabpay.createTestDispute(body);
    revalidateDispute(dispute);
    return { dispute };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}
